package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/samber/do/v2"

	"metis/internal/llm"
	"metis/internal/pkg/crypto"
	"metis/internal/scheduler"
)

type KnowledgeCompileService struct {
	kbRepo       *KnowledgeBaseRepo
	sourceRepo   *KnowledgeSourceRepo
	graphRepo    *KnowledgeGraphRepo
	logRepo      *KnowledgeLogRepo
	modelRepo    *ModelRepo
	embeddingSvc *KnowledgeEmbeddingService
	encKey       crypto.EncryptionKey
	engine       *scheduler.Engine
}

func NewKnowledgeCompileService(i do.Injector) (*KnowledgeCompileService, error) {
	return &KnowledgeCompileService{
		kbRepo:       do.MustInvoke[*KnowledgeBaseRepo](i),
		sourceRepo:   do.MustInvoke[*KnowledgeSourceRepo](i),
		graphRepo:    do.MustInvoke[*KnowledgeGraphRepo](i),
		logRepo:      do.MustInvoke[*KnowledgeLogRepo](i),
		modelRepo:    do.MustInvoke[*ModelRepo](i),
		embeddingSvc: do.MustInvoke[*KnowledgeEmbeddingService](i),
		encKey:       do.MustInvoke[crypto.EncryptionKey](i),
		engine:       do.MustInvoke[*scheduler.Engine](i),
	}, nil
}

// --- LLM Output Schema ---

type compileOutput struct {
	Nodes        []compileNodeOutput `json:"nodes"`
	UpdatedNodes []compileNodeOutput `json:"updated_nodes"`
}

type compileNodeOutput struct {
	Title        string            `json:"title"`
	Summary      string            `json:"summary"`
	Content      *string           `json:"content"`
	Related      []compileRelation `json:"related"`
	Sources      []string          `json:"sources"`
	UpdateReason string            `json:"update_reason,omitempty"`
}

type compileRelation struct {
	Concept  string `json:"concept"`
	Relation string `json:"relation"`
}

type compilePayload struct {
	KbID      uint `json:"kbId"`
	Recompile bool `json:"recompile"`
}

// HandleCompile is the scheduler handler for knowledge compilation.
func (s *KnowledgeCompileService) HandleCompile(ctx context.Context, payload json.RawMessage) error {
	var p compilePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	kb, err := s.kbRepo.FindByID(p.KbID)
	if err != nil {
		return fmt.Errorf("find kb %d: %w", p.KbID, err)
	}

	// If recompile, delete the entire FalkorDB graph
	if p.Recompile {
		if err := s.graphRepo.DeleteGraph(kb.ID); err != nil {
			return fmt.Errorf("delete graph for kb %d: %w", kb.ID, err)
		}
	}

	// Get completed sources
	sources, err := s.sourceRepo.FindCompletedByKbID(kb.ID)
	if err != nil {
		return fmt.Errorf("find sources: %w", err)
	}
	if len(sources) == 0 {
		kb.CompileStatus = CompileStatusError
		if updateErr := s.kbRepo.Update(kb); updateErr != nil {
			slog.Error("failed to update kb status", "kb_id", kb.ID, "error", updateErr)
		}
		return fmt.Errorf("no completed sources to compile")
	}

	// Get existing nodes for incremental compilation (from FalkorDB)
	existingNodes, _ := s.graphRepo.FindAllNodes(kb.ID)

	// Drop vector index before writing (avoid HNSW concurrent write bug)
	if err := s.graphRepo.DropVectorIndex(kb.ID); err != nil {
		slog.Warn("failed to drop vector index", "kb_id", kb.ID, "error", err)
	}

	// Resolve the LLM client from the configured model
	llmClient, modelIDStr, err := s.resolveLLMClient(kb)
	if err != nil {
		kb.CompileStatus = CompileStatusError
		if updateErr := s.kbRepo.Update(kb); updateErr != nil {
			slog.Error("failed to update kb status", "kb_id", kb.ID, "error", updateErr)
		}
		return fmt.Errorf("resolve LLM client: %w", err)
	}

	// Build the compilation prompt
	prompt := s.buildCompilePrompt(sources, existingNodes)

	// Call LLM
	slog.Info("knowledge compile: calling LLM", "kb_id", kb.ID, "sources", len(sources), "existing_nodes", len(existingNodes))

	resp, err := llmClient.Chat(ctx, llm.ChatRequest{
		Model: modelIDStr,
		Messages: []llm.Message{
			{Role: llm.RoleSystem, Content: compileSystemPrompt},
			{Role: llm.RoleUser, Content: prompt},
		},
	})
	if err != nil {
		kb.CompileStatus = CompileStatusError
		if updateErr := s.kbRepo.Update(kb); updateErr != nil {
			slog.Error("failed to update kb status", "kb_id", kb.ID, "error", updateErr)
		}
		s.logRepo.Create(&KnowledgeLog{
			KbID:         kb.ID,
			Action:       KnowledgeLogCompile,
			ModelID:      modelIDStr,
			ErrorMessage: err.Error(),
		})
		return fmt.Errorf("LLM call: %w", err)
	}

	// Parse LLM output
	output, err := s.parseLLMOutput(resp.Content)
	if err != nil {
		kb.CompileStatus = CompileStatusError
		if updateErr := s.kbRepo.Update(kb); updateErr != nil {
			slog.Error("failed to update kb status", "kb_id", kb.ID, "error", updateErr)
		}
		s.logRepo.Create(&KnowledgeLog{
			KbID:         kb.ID,
			Action:       KnowledgeLogCompile,
			ModelID:      modelIDStr,
			ErrorMessage: "parse LLM output: " + err.Error(),
		})
		return fmt.Errorf("parse output: %w", err)
	}

	// Write nodes and edges to FalkorDB
	stats, err := s.writeCompileOutput(kb.ID, output, sources)
	if err != nil {
		kb.CompileStatus = CompileStatusError
		if updateErr := s.kbRepo.Update(kb); updateErr != nil {
			slog.Error("failed to update kb status", "kb_id", kb.ID, "error", updateErr)
		}
		return fmt.Errorf("write output: %w", err)
	}

	// Generate index node
	s.generateIndexNode(kb.ID)

	// Create full-text index
	if err := s.graphRepo.CreateFullTextIndex(kb.ID); err != nil {
		slog.Warn("failed to create full-text index", "kb_id", kb.ID, "error", err)
	}

	// Generate embeddings and rebuild vector index
	if err := s.embeddingSvc.GenerateEmbeddings(ctx, kb.ID); err != nil {
		slog.Error("failed to generate embeddings", "kb_id", kb.ID, "error", err)
	}

	// Run lint
	lintIssues := s.runLint(kb.ID)

	// Update KB status
	now := time.Now()
	kb.CompileStatus = CompileStatusCompleted
	kb.CompiledAt = &now
	if err := s.kbRepo.Update(kb); err != nil {
		slog.Error("failed to update kb status after compile", "kb_id", kb.ID, "error", err)
	}
	if err := s.kbRepo.UpdateSourceCount(kb.ID); err != nil {
		slog.Error("failed to update kb source count", "kb_id", kb.ID, "error", err)
	}

	// Write log
	action := KnowledgeLogCompile
	if p.Recompile {
		action = KnowledgeLogRecompile
	}
	s.logRepo.Create(&KnowledgeLog{
		KbID:         kb.ID,
		Action:       action,
		ModelID:      modelIDStr,
		NodesCreated: stats.created,
		NodesUpdated: stats.updated,
		EdgesCreated: stats.edges,
		LintIssues:   lintIssues,
	})

	slog.Info("knowledge compile: done", "kb_id", kb.ID, "created", stats.created, "updated", stats.updated, "edges", stats.edges, "lint", lintIssues)
	return nil
}

// resolveLLMClient looks up the model and provider configured for the KB,
// then builds an llm.Client using the provider credentials.
func (s *KnowledgeCompileService) resolveLLMClient(kb *KnowledgeBase) (llm.Client, string, error) {
	var m *AIModel
	var err error

	if kb.CompileModelID != nil {
		m, err = s.modelRepo.FindByID(*kb.CompileModelID)
	} else {
		m, err = s.modelRepo.FindDefaultByType(ModelTypeLLM)
	}
	if err != nil {
		return nil, "", fmt.Errorf("find LLM model: %w", err)
	}
	if m.Provider == nil {
		return nil, "", fmt.Errorf("model has no provider loaded")
	}

	apiKey, err := decryptAPIKey(m.Provider.APIKeyEncrypted, s.encKey)
	if err != nil {
		return nil, "", fmt.Errorf("decrypt api key: %w", err)
	}

	client, err := llm.NewClient(m.Provider.Protocol, m.Provider.BaseURL, apiKey)
	if err != nil {
		return nil, "", fmt.Errorf("create LLM client: %w", err)
	}

	return client, m.ModelID, nil
}

type compileStats struct {
	created int
	updated int
	edges   int
}

func (s *KnowledgeCompileService) writeCompileOutput(kbID uint, output *compileOutput, sources []KnowledgeSource) (*compileStats, error) {
	stats := &compileStats{}
	now := time.Now().Unix()

	// Build source title → ID map
	sourceMap := make(map[string]uint)
	for _, src := range sources {
		sourceMap[src.Title] = src.ID
	}

	// Process new nodes — upsert by title into FalkorDB
	for _, n := range output.Nodes {
		node := &KnowledgeNode{
			Title:      n.Title,
			Summary:    n.Summary,
			Content:    n.Content,
			NodeType:   NodeTypeConcept,
			SourceIDs:  resolveSourceIDsJSON(n.Sources, sourceMap),
			CompiledAt: now,
		}
		if err := s.graphRepo.UpsertNodeByTitle(kbID, node); err != nil {
			slog.Error("failed to upsert node", "title", n.Title, "error", err)
			continue
		}
		stats.created++
	}

	// Process updated nodes
	for _, n := range output.UpdatedNodes {
		node := &KnowledgeNode{
			Title:      n.Title,
			Summary:    n.Summary,
			Content:    n.Content,
			NodeType:   NodeTypeConcept,
			SourceIDs:  resolveSourceIDsJSON(n.Sources, sourceMap),
			CompiledAt: now,
		}
		if err := s.graphRepo.UpsertNodeByTitle(kbID, node); err != nil {
			slog.Error("failed to upsert updated node", "title", n.Title, "error", err)
			continue
		}
		stats.updated++
	}

	// Resolve edges from all nodes (new + updated)
	allNodeOutputs := append(output.Nodes, output.UpdatedNodes...)
	for _, n := range allNodeOutputs {
		for _, rel := range n.Related {
			// Ensure target node exists (create empty concept if not)
			if _, err := s.graphRepo.FindNodeByTitle(kbID, rel.Concept); err != nil {
				emptyNode := &KnowledgeNode{
					Title:      rel.Concept,
					NodeType:   NodeTypeConcept,
					CompiledAt: now,
				}
				if err := s.graphRepo.UpsertNodeByTitle(kbID, emptyNode); err != nil {
					continue
				}
				stats.created++
			}

			if err := s.graphRepo.CreateEdge(kbID, n.Title, rel.Concept, rel.Relation, ""); err != nil {
				slog.Error("failed to create edge", "from", n.Title, "to", rel.Concept, "error", err)
				continue
			}
			stats.edges++
		}
	}

	return stats, nil
}

func (s *KnowledgeCompileService) generateIndexNode(kbID uint) {
	nodes, err := s.graphRepo.FindAllNodes(kbID)
	if err != nil {
		return
	}

	var sb strings.Builder
	sb.WriteString("# Knowledge Index\n\n")
	sb.WriteString("| Concept | Summary |\n")
	sb.WriteString("|---------|--------|\n")
	conceptCount := 0
	for _, n := range nodes {
		if n.NodeType == NodeTypeIndex {
			continue
		}
		hasContent := "✓"
		if n.Content == nil || *n.Content == "" {
			hasContent = "—"
		}
		sb.WriteString(fmt.Sprintf("| %s %s | %s |\n", n.Title, hasContent, n.Summary))
		conceptCount++
	}

	indexContent := sb.String()
	summary := fmt.Sprintf("Index of %d concepts", conceptCount)

	node := &KnowledgeNode{
		Title:      "Knowledge Index",
		Summary:    summary,
		Content:    &indexContent,
		NodeType:   NodeTypeIndex,
		CompiledAt: time.Now().Unix(),
	}
	if err := s.graphRepo.UpsertNodeByTitle(kbID, node); err != nil {
		slog.Error("failed to upsert index node", "kb_id", kbID, "error", err)
	}
}

func (s *KnowledgeCompileService) runLint(kbID uint) int {
	issues := 0

	orphans, _ := s.graphRepo.CountOrphanNodes(kbID)
	issues += int(orphans)

	sparse, _ := s.graphRepo.CountSparseNodes(kbID)
	issues += int(sparse)

	contradictions, _ := s.graphRepo.CountContradictions(kbID)
	issues += int(contradictions)

	if issues > 0 {
		slog.Info("knowledge lint", "kb_id", kbID, "orphans", orphans, "sparse", sparse, "contradictions", contradictions)
	}
	return issues
}

func (s *KnowledgeCompileService) buildCompilePrompt(sources []KnowledgeSource, existingNodes []KnowledgeNode) string {
	var sb strings.Builder

	sb.WriteString("## Sources to compile\n\n")
	for i, src := range sources {
		sb.WriteString(fmt.Sprintf("### Source %d: %s\n\n", i+1, src.Title))
		content := src.Content
		if len(content) > 8000 {
			content = content[:8000] + "\n\n[...truncated...]"
		}
		sb.WriteString(content)
		sb.WriteString("\n\n---\n\n")
	}

	if len(existingNodes) > 0 {
		sb.WriteString("## Existing knowledge nodes (check for cascade updates)\n\n")
		for _, n := range existingNodes {
			if n.NodeType == NodeTypeIndex {
				continue
			}
			sb.WriteString(fmt.Sprintf("- **%s**: %s\n", n.Title, n.Summary))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

func (s *KnowledgeCompileService) parseLLMOutput(content string) (*compileOutput, error) {
	jsonStr := content

	if idx := strings.Index(content, "```json"); idx != -1 {
		start := idx + 7
		end := strings.Index(content[start:], "```")
		if end != -1 {
			jsonStr = content[start : start+end]
		}
	} else if idx := strings.Index(content, "```"); idx != -1 {
		start := idx + 3
		if nl := strings.Index(content[start:], "\n"); nl != -1 {
			start = start + nl + 1
		}
		end := strings.Index(content[start:], "```")
		if end != -1 {
			jsonStr = content[start : start+end]
		}
	}

	jsonStr = strings.TrimSpace(jsonStr)

	var output compileOutput
	if err := json.Unmarshal([]byte(jsonStr), &output); err != nil {
		return nil, fmt.Errorf("JSON parse error: %w (content preview: %.200s)", err, jsonStr)
	}
	return &output, nil
}

// EnqueueCompile enqueues a knowledge base compilation task.
func (s *KnowledgeCompileService) EnqueueCompile(kbID uint, recompile bool) error {
	payload := compilePayload{KbID: kbID, Recompile: recompile}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return s.engine.Enqueue("ai-knowledge-compile", json.RawMessage(b))
}

func (s *KnowledgeCompileService) TaskDefs() []scheduler.TaskDef {
	return []scheduler.TaskDef{
		{
			Name:        "ai-knowledge-compile",
			Type:        scheduler.TypeAsync,
			Description: "Compile knowledge sources into knowledge graph using LLM",
			Timeout:     300 * time.Second,
			MaxRetries:  1,
			Handler:     s.HandleCompile,
		},
	}
}

const compileSystemPrompt = `You are a knowledge compiler. Your job is to read source documents and compile them into a knowledge graph of concept nodes with relationships.

IMPORTANT RULES:
1. Organize knowledge by CONCEPTS, not by source documents
2. Multiple sources about the same concept should be merged into one node
3. If sources contradict each other, note the contradiction and mark the relationship as "contradicts"
4. Create nodes even for concepts that don't have enough content for a full article (set content to null, provide only title and summary)
5. Use name-driven references — output concept names and source titles, NOT database IDs

OUTPUT FORMAT: You MUST output valid JSON with this exact structure:
{
  "nodes": [
    {
      "title": "Concept Name",
      "summary": "One-line description of this concept",
      "content": "Full Markdown article text, or null if not enough material",
      "related": [
        {"concept": "Other Concept Name", "relation": "related|contradicts|extends|part_of"}
      ],
      "sources": ["Source Title 1", "Source Title 2"]
    }
  ],
  "updated_nodes": [
    {
      "title": "Existing Concept Name",
      "summary": "Updated summary",
      "content": "Updated content",
      "related": [...],
      "sources": [...],
      "update_reason": "Why this node was updated"
    }
  ]
}

Relation types:
- "related": general relationship
- "contradicts": conflicting information
- "extends": builds upon or specializes
- "part_of": is a component of

If there are no existing nodes to update, leave "updated_nodes" as an empty array.
Output ONLY the JSON, no other text.`
