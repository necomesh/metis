package ai

import (
	"errors"

	"github.com/samber/do/v2"
	"gorm.io/gorm"
)

var (
	ErrKnowledgeBaseNotFound = errors.New("knowledge base not found")
)

type KnowledgeBaseService struct {
	repo       *KnowledgeBaseRepo
	sourceRepo *KnowledgeSourceRepo
	nodeRepo   *KnowledgeNodeRepo
	edgeRepo   *KnowledgeEdgeRepo
}

func NewKnowledgeBaseService(i do.Injector) (*KnowledgeBaseService, error) {
	return &KnowledgeBaseService{
		repo:       do.MustInvoke[*KnowledgeBaseRepo](i),
		sourceRepo: do.MustInvoke[*KnowledgeSourceRepo](i),
		nodeRepo:   do.MustInvoke[*KnowledgeNodeRepo](i),
		edgeRepo:   do.MustInvoke[*KnowledgeEdgeRepo](i),
	}, nil
}

func (s *KnowledgeBaseService) Create(kb *KnowledgeBase) error {
	kb.CompileStatus = CompileStatusIdle
	return s.repo.Create(kb)
}

func (s *KnowledgeBaseService) Get(id uint) (*KnowledgeBase, error) {
	kb, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrKnowledgeBaseNotFound
		}
		return nil, err
	}
	return kb, nil
}

func (s *KnowledgeBaseService) Update(kb *KnowledgeBase) error {
	return s.repo.Update(kb)
}

func (s *KnowledgeBaseService) Delete(id uint) error {
	// Delete associated data
	s.edgeRepo.DeleteByKbID(id)
	s.nodeRepo.DeleteByKbID(id)
	s.sourceRepo.DeleteByKbID(id)
	return s.repo.Delete(id)
}
