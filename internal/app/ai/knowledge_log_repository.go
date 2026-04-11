package ai

import (
	"github.com/samber/do/v2"

	"metis/internal/database"
)

type KnowledgeLogRepo struct {
	db *database.DB
}

func NewKnowledgeLogRepo(i do.Injector) (*KnowledgeLogRepo, error) {
	return &KnowledgeLogRepo{db: do.MustInvoke[*database.DB](i)}, nil
}

func (r *KnowledgeLogRepo) Create(log *KnowledgeLog) error {
	return r.db.Create(log).Error
}

func (r *KnowledgeLogRepo) List(kbID uint, page, pageSize int) ([]KnowledgeLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	var total int64
	if err := r.db.Model(&KnowledgeLog{}).Where("kb_id = ?", kbID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []KnowledgeLog
	offset := (page - 1) * pageSize
	if err := r.db.Where("kb_id = ?", kbID).
		Offset(offset).Limit(pageSize).
		Order("created_at DESC").
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}
