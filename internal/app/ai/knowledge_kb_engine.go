package ai

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/samber/do/v2"

	"metis/internal/scheduler"
)

// NaiveChunkEngine implements KnowledgeEngine for the "naive_chunk" RAG type.
// It splits source documents into fixed-size chunks, embeds them, and stores
// them in ai_rag_chunks for vector search.
type NaiveChunkEngine struct {
	chunkRepo  *RAGChunkRepo
	assetRepo  *KnowledgeAssetRepo
	sourceRepo *KnowledgeSourceRepo
	logRepo    *KnowledgeLogRepo
	engine     *scheduler.Engine
}

func NewNaiveChunkEngine(i do.Injector) (*NaiveChunkEngine, error) {
	e := &NaiveChunkEngine{
		chunkRepo:  do.MustInvoke[*RAGChunkRepo](i),
		assetRepo:  do.MustInvoke[*KnowledgeAssetRepo](i),
		sourceRepo: do.MustInvoke[*KnowledgeSourceRepo](i),
		logRepo:    do.MustInvoke[*KnowledgeLogRepo](i),
		engine:     do.MustInvoke[*scheduler.Engine](i),
	}
	RegisterEngine(AssetCategoryKB, KBTypeNaiveChunk, e)
	return e, nil
}

// Build performs incremental chunking: only processes sources that don't yet
// have chunks in the store.
func (e *NaiveChunkEngine) Build(ctx context.Context, asset *KnowledgeAsset, sources []*KnowledgeSource) error {
	var cfg RAGConfig
	if err := asset.GetConfig(&cfg); err != nil {
		cfg = DefaultRAGConfig()
	}
	if cfg.ChunkSize <= 0 {
		cfg.ChunkSize = 512
	}
	if cfg.ChunkOverlap < 0 {
		cfg.ChunkOverlap = 0
	}

	// Update status to building
	if err := e.assetRepo.UpdateStatus(asset.ID, AssetStatusBuilding); err != nil {
		return fmt.Errorf("update status: %w", err)
	}

	totalCreated := 0
	for _, src := range sources {
		if src.Content == "" {
			continue
		}
		// Check if chunks already exist for this source
		existing, _ := e.chunkRepo.ListByAssetAndSource(asset.ID, src.ID)
		if len(existing) > 0 {
			continue // skip — already chunked
		}

		chunks := splitIntoChunks(src.Content, cfg.ChunkSize, cfg.ChunkOverlap)
		var ragChunks []RAGChunk
		for i, chunk := range chunks {
			ragChunks = append(ragChunks, RAGChunk{
				AssetID:    asset.ID,
				SourceID:   src.ID,
				Content:    chunk,
				ChunkIndex: i,
			})
		}
		if len(ragChunks) > 0 {
			if err := e.chunkRepo.CreateBatch(ragChunks); err != nil {
				slog.Error("failed to create chunks", "asset_id", asset.ID, "source_id", src.ID, "error", err)
				continue
			}
			totalCreated += len(ragChunks)
		}
	}

	// Log
	_ = e.logRepo.Create(&KnowledgeLog{
		AssetID:      asset.ID,
		Action:       KnowledgeLogCompile,
		NodesCreated: totalCreated,
		Details:      fmt.Sprintf("created %d chunks from %d sources", totalCreated, len(sources)),
	})

	// Update status
	status := AssetStatusReady
	if err := e.assetRepo.UpdateStatus(asset.ID, status); err != nil {
		return fmt.Errorf("update status: %w", err)
	}

	return nil
}

// Rebuild deletes all existing chunks and rebuilds from scratch.
func (e *NaiveChunkEngine) Rebuild(ctx context.Context, asset *KnowledgeAsset, sources []*KnowledgeSource) error {
	if err := e.chunkRepo.DeleteByAsset(asset.ID); err != nil {
		return fmt.Errorf("delete existing chunks: %w", err)
	}
	return e.Build(ctx, asset, sources)
}

// Search performs text matching on chunks. Full vector search requires
// pgvector integration (Phase 9).
func (e *NaiveChunkEngine) Search(ctx context.Context, asset *KnowledgeAsset, query *RecallQuery) (*RecallResult, error) {
	topK := query.TopK
	if topK <= 0 {
		topK = 5
	}

	// For now, perform simple text-based search (full vector search in Phase 9)
	chunks, total, err := e.chunkRepo.ListByAsset(asset.ID, 1, topK*10) // fetch more for filtering
	if err != nil {
		return nil, fmt.Errorf("list chunks: %w", err)
	}

	result := &RecallResult{
		Debug: &RecallDebug{
			Mode:      "text",
			TotalHits: int(total),
		},
	}

	queryLower := strings.ToLower(query.Query)
	count := 0
	for _, chunk := range chunks {
		if count >= topK {
			break
		}
		// Simple text match scoring
		contentLower := strings.ToLower(chunk.Content)
		if strings.Contains(contentLower, queryLower) || query.Query == "" {
			result.Items = append(result.Items, KnowledgeUnit{
				ID:         fmt.Sprintf("chunk_%d", chunk.ID),
				AssetID:    asset.ID,
				UnitType:   "document_chunk",
				Content:    chunk.Content,
				Summary:    chunk.Summary,
				SourceRefs: []uint{chunk.SourceID},
			})
			count++
		}
	}

	return result, nil
}

// ContentStats returns chunk counts.
func (e *NaiveChunkEngine) ContentStats(ctx context.Context, asset *KnowledgeAsset) (*ContentStats, error) {
	count, err := e.chunkRepo.CountByAsset(asset.ID)
	if err != nil {
		return nil, err
	}
	return &ContentStats{
		ChunkCount: int(count),
	}, nil
}

// --- Text chunking ---

// splitIntoChunks splits text into chunks of approximately chunkSize characters
// with overlap.
func splitIntoChunks(text string, chunkSize, overlap int) []string {
	if chunkSize <= 0 {
		chunkSize = 512
	}
	if overlap < 0 {
		overlap = 0
	}
	if overlap >= chunkSize {
		overlap = chunkSize / 4
	}

	// Split by paragraphs first
	paragraphs := strings.Split(text, "\n\n")
	var chunks []string
	var current strings.Builder

	for _, para := range paragraphs {
		para = strings.TrimSpace(para)
		if para == "" {
			continue
		}

		if current.Len()+len(para)+2 > chunkSize && current.Len() > 0 {
			chunks = append(chunks, strings.TrimSpace(current.String()))
			// Keep overlap from the end of current chunk
			content := current.String()
			current.Reset()
			if overlap > 0 && len(content) > overlap {
				current.WriteString(content[len(content)-overlap:])
				current.WriteString("\n\n")
			}
		}

		if current.Len() > 0 {
			current.WriteString("\n\n")
		}
		current.WriteString(para)
	}

	if current.Len() > 0 {
		chunks = append(chunks, strings.TrimSpace(current.String()))
	}

	// If no paragraphs found or text is very long, fall back to fixed-size splitting
	if len(chunks) == 0 && len(text) > 0 {
		for i := 0; i < len(text); i += chunkSize - overlap {
			end := i + chunkSize
			if end > len(text) {
				end = len(text)
			}
			chunks = append(chunks, text[i:end])
			if end == len(text) {
				break
			}
		}
	}

	return chunks
}
