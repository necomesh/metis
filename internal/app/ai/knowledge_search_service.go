package ai

import (
	"context"
	"sort"

	"github.com/samber/do/v2"

	"metis/internal/app"
)

type KnowledgeSearchService struct {
	assetRepo *KnowledgeAssetRepo
}

func NewKnowledgeSearchService(i do.Injector) (*KnowledgeSearchService, error) {
	return &KnowledgeSearchService{assetRepo: do.MustInvoke[*KnowledgeAssetRepo](i)}, nil
}

func (s *KnowledgeSearchService) SearchKnowledge(kbIDs []uint, query string, limit int) ([]app.AIKnowledgeResult, error) {
	if limit <= 0 {
		limit = 5
	}
	assets, err := s.assetRepo.FindByIDs(uniqueUintSlice(kbIDs))
	if err != nil {
		return nil, err
	}
	results := make([]app.AIKnowledgeResult, 0)
	for i := range assets {
		asset := &assets[i]
		if asset.Status == AssetStatusError {
			continue
		}
		engine, err := GetEngineForAsset(asset)
		if err != nil {
			continue
		}
		recall, err := engine.Search(context.Background(), asset, &RecallQuery{
			Query: query,
			Mode:  "hybrid",
			TopK:  limit,
		})
		if err != nil || recall == nil {
			continue
		}
		for _, item := range recall.Items {
			title := item.Title
			if title == "" {
				title = asset.Name
			}
			content := item.Content
			if content == "" {
				content = item.Summary
			}
			if content == "" {
				continue
			}
			results = append(results, app.AIKnowledgeResult{
				Title:   title,
				Content: content,
				Score:   item.Score,
			})
		}
	}
	sort.SliceStable(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})
	if len(results) > limit {
		results = results[:limit]
	}
	return results, nil
}

var _ app.AIKnowledgeSearcher = (*KnowledgeSearchService)(nil)
