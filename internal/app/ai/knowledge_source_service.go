package ai

import (
	"errors"
	"log/slog"

	"github.com/samber/do/v2"
	"gorm.io/gorm"
)

var (
	ErrSourceNotFound = errors.New("knowledge source not found")
)

type KnowledgeSourceService struct {
	repo   *KnowledgeSourceRepo
	kbRepo *KnowledgeBaseRepo
}

func NewKnowledgeSourceService(i do.Injector) (*KnowledgeSourceService, error) {
	return &KnowledgeSourceService{
		repo:   do.MustInvoke[*KnowledgeSourceRepo](i),
		kbRepo: do.MustInvoke[*KnowledgeBaseRepo](i),
	}, nil
}

func (s *KnowledgeSourceService) Create(src *KnowledgeSource) error {
	if err := s.repo.Create(src); err != nil {
		return err
	}
	if err := s.kbRepo.UpdateSourceCount(src.KbID); err != nil {
		slog.Error("failed to update kb counts after source create", "kb_id", src.KbID, "error", err)
	}
	return nil
}

func (s *KnowledgeSourceService) Get(id uint) (*KnowledgeSource, error) {
	src, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSourceNotFound
		}
		return nil, err
	}
	return src, nil
}

func (s *KnowledgeSourceService) Delete(id uint) error {
	src, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrSourceNotFound
		}
		return err
	}
	// Delete child sources (URL with depth > 0)
	s.repo.DeleteByParentID(id)
	if err := s.repo.Delete(id); err != nil {
		return err
	}
	if err := s.kbRepo.UpdateSourceCount(src.KbID); err != nil {
		slog.Error("failed to update kb counts after source delete", "kb_id", src.KbID, "error", err)
	}
	return nil
}
