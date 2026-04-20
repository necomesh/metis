package ai

import (
	"github.com/samber/do/v2"

	"metis/internal/database"
)

// RAGChunkRepo provides GORM persistence for RAGChunk (NaiveRAG chunk storage).
type RAGChunkRepo struct {
	db *database.DB
}

func NewRAGChunkRepo(i do.Injector) (*RAGChunkRepo, error) {
	db := do.MustInvoke[*database.DB](i)
	return &RAGChunkRepo{db: db}, nil
}

func (r *RAGChunkRepo) Create(chunk *RAGChunk) error {
	return r.db.Create(chunk).Error
}

func (r *RAGChunkRepo) CreateBatch(chunks []RAGChunk) error {
	if len(chunks) == 0 {
		return nil
	}
	return r.db.CreateInBatches(chunks, 100).Error
}

func (r *RAGChunkRepo) FindByID(id uint) (*RAGChunk, error) {
	var chunk RAGChunk
	if err := r.db.First(&chunk, id).Error; err != nil {
		return nil, err
	}
	return &chunk, nil
}

// ListByAsset returns paginated chunks for a given asset.
func (r *RAGChunkRepo) ListByAsset(assetID uint, page, pageSize int) ([]RAGChunk, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	q := r.db.Model(&RAGChunk{}).Where("asset_id = ?", assetID)

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var chunks []RAGChunk
	offset := (page - 1) * pageSize
	if err := q.Order("chunk_index ASC, id ASC").Offset(offset).Limit(pageSize).Find(&chunks).Error; err != nil {
		return nil, 0, err
	}

	return chunks, total, nil
}

// CountByAsset returns total chunks for an asset.
func (r *RAGChunkRepo) CountByAsset(assetID uint) (int64, error) {
	var count int64
	err := r.db.Model(&RAGChunk{}).Where("asset_id = ?", assetID).Count(&count).Error
	return count, err
}

// DeleteByAsset removes all chunks for an asset.
func (r *RAGChunkRepo) DeleteByAsset(assetID uint) error {
	return r.db.Where("asset_id = ?", assetID).Delete(&RAGChunk{}).Error
}

// DeleteBySource removes all chunks from a specific source within an asset.
func (r *RAGChunkRepo) DeleteBySource(assetID, sourceID uint) error {
	return r.db.Where("asset_id = ? AND source_id = ?", assetID, sourceID).Delete(&RAGChunk{}).Error
}

// ListByAssetAndSource returns chunks for a specific source within an asset.
func (r *RAGChunkRepo) ListByAssetAndSource(assetID, sourceID uint) ([]RAGChunk, error) {
	var chunks []RAGChunk
	err := r.db.Where("asset_id = ? AND source_id = ?", assetID, sourceID).
		Order("chunk_index ASC").Find(&chunks).Error
	return chunks, err
}
