package ai

import (
	"github.com/samber/do/v2"

	"metis/internal/database"
)

type KnowledgeEdgeRepo struct {
	db *database.DB
}

func NewKnowledgeEdgeRepo(i do.Injector) (*KnowledgeEdgeRepo, error) {
	return &KnowledgeEdgeRepo{db: do.MustInvoke[*database.DB](i)}, nil
}

func (r *KnowledgeEdgeRepo) Create(e *KnowledgeEdge) error {
	return r.db.Create(e).Error
}

func (r *KnowledgeEdgeRepo) CreateBatch(edges []KnowledgeEdge) error {
	if len(edges) == 0 {
		return nil
	}
	return r.db.Create(&edges).Error
}

func (r *KnowledgeEdgeRepo) FindByNodeID(nodeID uint) ([]KnowledgeEdge, error) {
	var items []KnowledgeEdge
	if err := r.db.Where("from_node_id = ? OR to_node_id = ?", nodeID, nodeID).
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *KnowledgeEdgeRepo) FindByKbID(kbID uint) ([]KnowledgeEdge, error) {
	var items []KnowledgeEdge
	if err := r.db.Where("kb_id = ?", kbID).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *KnowledgeEdgeRepo) DeleteByKbID(kbID uint) error {
	return r.db.Where("kb_id = ?", kbID).Delete(&KnowledgeEdge{}).Error
}

func (r *KnowledgeEdgeRepo) CountByNodeID(nodeID uint) (int64, error) {
	var count int64
	if err := r.db.Model(&KnowledgeEdge{}).
		Where("from_node_id = ? OR to_node_id = ?", nodeID, nodeID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// CountOrphanNodes returns nodes with no edges connected.
func (r *KnowledgeEdgeRepo) CountOrphanNodes(kbID uint) (int64, error) {
	var count int64
	if err := r.db.Raw(`
		SELECT COUNT(*) FROM ai_knowledge_nodes n
		WHERE n.kb_id = ? AND n.deleted_at IS NULL AND n.node_type = ?
		AND NOT EXISTS (
			SELECT 1 FROM ai_knowledge_edges e
			WHERE e.kb_id = ? AND (e.from_node_id = n.id OR e.to_node_id = n.id)
		)
	`, kbID, NodeTypeConcept, kbID).Scan(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// CountSparseNodes returns concept nodes with no content but referenced by 3+ edges.
func (r *KnowledgeEdgeRepo) CountSparseNodes(kbID uint) (int64, error) {
	var count int64
	if err := r.db.Raw(`
		SELECT COUNT(*) FROM ai_knowledge_nodes n
		WHERE n.kb_id = ? AND n.deleted_at IS NULL AND n.node_type = ? AND (n.content IS NULL OR n.content = '')
		AND (
			SELECT COUNT(*) FROM ai_knowledge_edges e
			WHERE e.kb_id = ? AND (e.from_node_id = n.id OR e.to_node_id = n.id)
		) >= 3
	`, kbID, NodeTypeConcept, kbID).Scan(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// CountContradictions returns the number of 'contradicts' edges.
func (r *KnowledgeEdgeRepo) CountContradictions(kbID uint) (int64, error) {
	var count int64
	if err := r.db.Model(&KnowledgeEdge{}).
		Where("kb_id = ? AND relation = ?", kbID, EdgeRelationContradicts).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
