package engine

import (
	"encoding/json"
	"reflect"
	"testing"
)

type fakeKnowledgeSearcher struct {
	kbIDs []uint
	query string
	limit int
}

func (f *fakeKnowledgeSearcher) Search(kbIDs []uint, query string, limit int) ([]KnowledgeResult, error) {
	f.kbIDs = append([]uint(nil), kbIDs...)
	f.query = query
	f.limit = limit
	return []KnowledgeResult{
		{Title: "VPN 规范", Content: "先做预检再处理", Score: 0.91},
	}, nil
}

func TestDecisionKnowledgeSearchToolUsesConfiguredKnowledgeBases(t *testing.T) {
	searcher := &fakeKnowledgeSearcher{}
	def := toolKnowledgeSearch()

	raw, err := def.Handler(&decisionToolContext{
		knowledgeSearcher: searcher,
		knowledgeBaseIDs:  []uint{11, 22},
	}, json.RawMessage(`{"query":"vpn","limit":5}`))
	if err != nil {
		t.Fatalf("handler: %v", err)
	}
	if !reflect.DeepEqual(searcher.kbIDs, []uint{11, 22}) {
		t.Fatalf("expected configured knowledge bases, got %#v", searcher.kbIDs)
	}
	if searcher.query != "vpn" || searcher.limit != 5 {
		t.Fatalf("unexpected search params: query=%q limit=%d", searcher.query, searcher.limit)
	}

	var resp struct {
		Count   int `json:"count"`
		Results []struct {
			Title   string  `json:"title"`
			Content string  `json:"content"`
			Score   float64 `json:"score"`
		} `json:"results"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Count != 1 || len(resp.Results) != 1 {
		t.Fatalf("expected one result, got %+v", resp)
	}
	if resp.Results[0].Title != "VPN 规范" || resp.Results[0].Score != 0.91 {
		t.Fatalf("unexpected result: %+v", resp.Results[0])
	}
}

func TestDecisionKnowledgeSearchToolGracefullyDegradesWhenUnavailable(t *testing.T) {
	def := toolKnowledgeSearch()
	raw, err := def.Handler(&decisionToolContext{
		knowledgeBaseIDs: []uint{11},
	}, json.RawMessage(`{"query":"vpn"}`))
	if err != nil {
		t.Fatalf("handler: %v", err)
	}

	var resp struct {
		Count   int    `json:"count"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Count != 0 || resp.Message != "知识搜索不可用" {
		t.Fatalf("expected unavailable response, got %+v", resp)
	}
}
