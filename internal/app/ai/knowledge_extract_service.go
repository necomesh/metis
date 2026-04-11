package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/samber/do/v2"

	"metis/internal/scheduler"
)

type KnowledgeExtractService struct {
	sourceRepo *KnowledgeSourceRepo
	kbRepo     *KnowledgeBaseRepo
	engine     *scheduler.Engine
}

func NewKnowledgeExtractService(i do.Injector) (*KnowledgeExtractService, error) {
	return &KnowledgeExtractService{
		sourceRepo: do.MustInvoke[*KnowledgeSourceRepo](i),
		kbRepo:     do.MustInvoke[*KnowledgeBaseRepo](i),
		engine:     do.MustInvoke[*scheduler.Engine](i),
	}, nil
}

type extractPayload struct {
	SourceID uint `json:"sourceId"`
}

func (s *KnowledgeExtractService) HandleExtract(ctx context.Context, payload json.RawMessage) error {
	var p extractPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	src, err := s.sourceRepo.FindByID(p.SourceID)
	if err != nil {
		return fmt.Errorf("find source %d: %w", p.SourceID, err)
	}

	var content string
	var extractErr error

	switch src.Format {
	case SourceFormatMarkdown, SourceFormatText:
		// Already extracted at upload time
		return nil
	case SourceFormatURL:
		content, extractErr = s.extractURL(ctx, src)
	case SourceFormatPDF:
		content, extractErr = s.extractPDF(src)
	case SourceFormatDocx:
		content, extractErr = s.extractDocx(src)
	case SourceFormatXlsx:
		content, extractErr = s.extractXlsx(src)
	case SourceFormatPptx:
		content, extractErr = s.extractPptx(src)
	default:
		extractErr = fmt.Errorf("unsupported format: %s", src.Format)
	}

	if extractErr != nil {
		src.ExtractStatus = ExtractStatusError
		src.ErrorMessage = extractErr.Error()
		s.sourceRepo.Update(src)
		return extractErr
	}

	src.Content = content
	src.ContentHash = hashContent(content)
	src.ExtractStatus = ExtractStatusCompleted
	src.ErrorMessage = ""
	if err := s.sourceRepo.Update(src); err != nil {
		return err
	}

	s.kbRepo.UpdateCounts(src.KbID)

	// Auto-compile if enabled
	kb, err := s.kbRepo.FindByID(src.KbID)
	if err == nil && kb.AutoCompile {
		s.engine.Enqueue("ai-knowledge-compile", json.RawMessage(
			fmt.Sprintf(`{"kbId":%d}`, kb.ID),
		))
	}

	return nil
}

func (s *KnowledgeExtractService) extractURL(ctx context.Context, src *KnowledgeSource) (string, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequestWithContext(ctx, "GET", src.SourceURL, nil)
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "Metis-Knowledge-Crawler/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetch URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d from %s", resp.StatusCode, src.SourceURL)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024)) // 10MB limit
	if err != nil {
		return "", fmt.Errorf("read body: %w", err)
	}

	contentType := resp.Header.Get("Content-Type")
	var content string
	if strings.Contains(contentType, "text/html") {
		content = simpleHTMLToMarkdown(string(body))
	} else {
		content = string(body)
	}

	// Handle crawl depth
	if src.CrawlDepth > 0 {
		s.crawlChildPages(ctx, src, string(body))
	}

	return content, nil
}

func (s *KnowledgeExtractService) crawlChildPages(ctx context.Context, parent *KnowledgeSource, htmlBody string) {
	baseURL, err := url.Parse(parent.SourceURL)
	if err != nil {
		return
	}

	links := extractLinks(htmlBody, baseURL)
	for _, link := range links {
		// Filter by url_pattern if set
		if parent.URLPattern != "" && !matchURLPattern(link, parent.URLPattern) {
			continue
		}

		child := &KnowledgeSource{
			KbID:          parent.KbID,
			ParentID:      &parent.ID,
			Title:         link,
			Format:        SourceFormatURL,
			SourceURL:     link,
			CrawlDepth:    parent.CrawlDepth - 1,
			URLPattern:    parent.URLPattern,
			ExtractStatus: ExtractStatusPending,
		}
		if err := s.sourceRepo.Create(child); err != nil {
			slog.Error("failed to create child source", "url", link, "error", err)
			continue
		}

		s.engine.Enqueue("ai-source-extract", json.RawMessage(
			fmt.Sprintf(`{"sourceId":%d}`, child.ID),
		))
	}
}

// extractPDF extracts text from a PDF. Placeholder — needs a pure Go PDF library.
func (s *KnowledgeExtractService) extractPDF(src *KnowledgeSource) (string, error) {
	// TODO: Integrate a pure Go PDF text extraction library (e.g., ledongthuc/pdf)
	return "", fmt.Errorf("PDF extraction not yet implemented — upload as Markdown instead")
}

// extractDocx extracts text from a .docx file. Placeholder.
func (s *KnowledgeExtractService) extractDocx(src *KnowledgeSource) (string, error) {
	// TODO: Integrate a Go DOCX parser
	return "", fmt.Errorf("DOCX extraction not yet implemented — upload as Markdown instead")
}

// extractXlsx extracts text from an .xlsx file. Placeholder.
func (s *KnowledgeExtractService) extractXlsx(src *KnowledgeSource) (string, error) {
	// TODO: Integrate excelize for XLSX parsing
	return "", fmt.Errorf("XLSX extraction not yet implemented — upload as Markdown instead")
}

// extractPptx extracts text from a .pptx file. Placeholder.
func (s *KnowledgeExtractService) extractPptx(src *KnowledgeSource) (string, error) {
	// TODO: Integrate a Go PPTX parser
	return "", fmt.Errorf("PPTX extraction not yet implemented — upload as Markdown instead")
}

// EnqueueExtract enqueues a source extraction task.
func (s *KnowledgeExtractService) EnqueueExtract(sourceID uint) error {
	return s.engine.Enqueue("ai-source-extract", json.RawMessage(
		fmt.Sprintf(`{"sourceId":%d}`, sourceID),
	))
}

func (s *KnowledgeExtractService) TaskDefs() []scheduler.TaskDef {
	return []scheduler.TaskDef{
		{
			Name:        "ai-source-extract",
			Type:        scheduler.TypeAsync,
			Description: "Extract text content from knowledge sources (files/URLs)",
			Timeout:     120 * time.Second,
			MaxRetries:  3,
			Handler:     s.HandleExtract,
		},
		{
			Name:        "ai-knowledge-crawl",
			Type:        scheduler.TypeScheduled,
			CronExpr:    "0 3 * * *", // daily at 3 AM
			Description: "Re-crawl URL sources for knowledge bases with crawl enabled",
			Timeout:     600 * time.Second,
			MaxRetries:  1,
			Handler:     s.HandleCrawl,
		},
	}
}

// HandleCrawl is the scheduled handler that re-crawls URL sources for crawl-enabled KBs.
func (s *KnowledgeExtractService) HandleCrawl(ctx context.Context, _ json.RawMessage) error {
	kbs, err := s.kbRepo.ListCrawlEnabled()
	if err != nil {
		return fmt.Errorf("list crawl-enabled KBs: %w", err)
	}

	for _, kb := range kbs {
		urlSources, err := s.sourceRepo.FindURLSourcesByKbID(kb.ID)
		if err != nil {
			slog.Error("crawl: failed to find URL sources", "kb_id", kb.ID, "error", err)
			continue
		}

		for _, src := range urlSources {
			oldHash := src.ContentHash

			content, extractErr := s.extractURL(ctx, &src)
			if extractErr != nil {
				slog.Error("crawl: extract failed", "source_id", src.ID, "error", extractErr)
				continue
			}

			newHash := hashContent(content)
			if newHash == oldHash {
				continue // no change
			}

			src.Content = content
			src.ContentHash = newHash
			src.ExtractStatus = ExtractStatusCompleted
			src.ErrorMessage = ""
			if err := s.sourceRepo.Update(&src); err != nil {
				slog.Error("crawl: update source failed", "source_id", src.ID, "error", err)
				continue
			}

			slog.Info("crawl: content changed", "source_id", src.ID, "kb_id", kb.ID)
		}

		s.kbRepo.UpdateCounts(kb.ID)

		// Update last crawled time
		now := time.Now()
		kb.LastCrawledAt = &now
		s.kbRepo.Update(&kb)

		// Auto-compile if enabled
		if kb.AutoCompile {
			s.engine.Enqueue("ai-knowledge-compile", json.RawMessage(
				fmt.Sprintf(`{"kbId":%d}`, kb.ID),
			))
		}
	}
	return nil
}

// --- Utilities ---

func hashContent(content string) string {
	h := sha256.Sum256([]byte(content))
	return hex.EncodeToString(h[:])
}

// simpleHTMLToMarkdown does a basic HTML to text conversion.
// Strips tags, preserves text content. For production, use a proper library.
func simpleHTMLToMarkdown(html string) string {
	// Remove script and style blocks
	for _, tag := range []string{"script", "style", "nav", "footer", "header"} {
		for {
			start := strings.Index(strings.ToLower(html), "<"+tag)
			if start == -1 {
				break
			}
			end := strings.Index(strings.ToLower(html[start:]), "</"+tag+">")
			if end == -1 {
				html = html[:start]
				break
			}
			html = html[:start] + html[start+end+len("</"+tag+">"):]
		}
	}

	// Strip remaining HTML tags
	var result strings.Builder
	inTag := false
	for _, r := range html {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
		case !inTag:
			result.WriteRune(r)
		}
	}

	// Clean up whitespace
	lines := strings.Split(result.String(), "\n")
	var cleaned []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			cleaned = append(cleaned, line)
		}
	}
	return strings.Join(cleaned, "\n")
}

// extractLinks extracts same-domain absolute URLs from HTML.
func extractLinks(html string, base *url.URL) []string {
	var links []string
	seen := make(map[string]bool)

	lower := strings.ToLower(html)
	idx := 0
	for {
		pos := strings.Index(lower[idx:], "href=\"")
		if pos == -1 {
			break
		}
		start := idx + pos + 6
		end := strings.Index(html[start:], "\"")
		if end == -1 {
			break
		}
		href := html[start : start+end]
		idx = start + end

		parsed, err := url.Parse(href)
		if err != nil {
			continue
		}
		resolved := base.ResolveReference(parsed)

		// Same domain only
		if resolved.Host != base.Host {
			continue
		}
		// Skip anchors and non-http
		if resolved.Scheme != "http" && resolved.Scheme != "https" {
			continue
		}

		link := resolved.String()
		if !seen[link] {
			seen[link] = true
			links = append(links, link)
		}
	}
	return links
}

// matchURLPattern checks if a URL matches a simple glob pattern.
func matchURLPattern(urlStr, pattern string) bool {
	if pattern == "" {
		return true
	}
	// Simple prefix match: "docs.example.com/guide/*" matches URLs starting with that prefix
	pattern = strings.TrimSuffix(pattern, "*")
	return strings.Contains(urlStr, pattern)
}
