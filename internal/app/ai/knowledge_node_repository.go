package ai

import (
	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"metis/internal/database"
)

type KnowledgeNodeRepo struct {
	db *database.DB
}

func NewKnowledgeNodeRepo(i do.Injector) (*KnowledgeNodeRepo, error) {
	return &KnowledgeNodeRepo{db: do.MustInvoke[*database.DB](i)}, nil
}

func (r *KnowledgeNodeRepo) Create(n *KnowledgeNode) error {
	return r.db.Create(n).Error
}

func (r *KnowledgeNodeRepo) FindByID(id uint) (*KnowledgeNode, error) {
	var n KnowledgeNode
	if err := r.db.First(&n, id).Error; err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *KnowledgeNodeRepo) FindByKbIDAndTitle(kbID uint, title string) (*KnowledgeNode, error) {
	var n KnowledgeNode
	if err := r.db.Where("kb_id = ? AND title = ?", kbID, title).First(&n).Error; err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *KnowledgeNodeRepo) FindByKbID(kbID uint) ([]KnowledgeNode, error) {
	var items []KnowledgeNode
	if err := r.db.Where("kb_id = ?", kbID).Order("node_type ASC, title ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

type NodeListParams struct {
	KbID     uint
	Keyword  string
	NodeType string
	Page     int
	PageSize int
}

func (r *KnowledgeNodeRepo) List(params NodeListParams) ([]KnowledgeNode, int64, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 20
	}

	query := r.db.Model(&KnowledgeNode{}).Where("kb_id = ?", params.KbID)
	if params.Keyword != "" {
		like := "%" + params.Keyword + "%"
		query = query.Where("title LIKE ? OR summary LIKE ?", like, like)
	}
	if params.NodeType != "" {
		query = query.Where("node_type = ?", params.NodeType)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []KnowledgeNode
	offset := (params.Page - 1) * params.PageSize
	if err := query.Offset(offset).Limit(params.PageSize).
		Order("node_type ASC, title ASC").
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *KnowledgeNodeRepo) Update(n *KnowledgeNode) error {
	return r.db.Save(n).Error
}

func (r *KnowledgeNodeRepo) DeleteByKbID(kbID uint) error {
	return r.db.Where("kb_id = ?", kbID).Delete(&KnowledgeNode{}).Error
}

func (r *KnowledgeNodeRepo) FindIndexNode(kbID uint) (*KnowledgeNode, error) {
	var n KnowledgeNode
	if err := r.db.Where("kb_id = ? AND node_type = ?", kbID, NodeTypeIndex).First(&n).Error; err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *KnowledgeNodeRepo) CountByKbID(kbID uint) (int64, error) {
	var count int64
	if err := r.db.Model(&KnowledgeNode{}).Where("kb_id = ?", kbID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// SearchNodes searches nodes by title and summary matching.
func (r *KnowledgeNodeRepo) SearchNodes(kbID uint, query string, limit int) ([]KnowledgeNode, error) {
	if limit < 1 {
		limit = 20
	}
	like := "%" + query + "%"
	var items []KnowledgeNode
	q := r.db.Where("title LIKE ? OR summary LIKE ?", like, like)
	if kbID > 0 {
		q = q.Where("kb_id = ?", kbID)
	}
	if err := q.Limit(limit).Order("node_type ASC, title ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// GetGraphNodes returns nodes within N hops of the given node using recursive CTE.
func (r *KnowledgeNodeRepo) GetGraphNodes(nodeID uint, depth int) ([]KnowledgeNode, []KnowledgeEdge, error) {
	if depth < 1 {
		depth = 1
	}
	if depth > 3 {
		depth = 3
	}

	// Get related node IDs via recursive CTE
	var nodeIDs []uint
	err := r.db.Raw(`
		WITH RECURSIVE graph AS (
			SELECT ? AS node_id, 0 AS depth
			UNION
			SELECT CASE WHEN e.from_node_id = g.node_id THEN e.to_node_id ELSE e.from_node_id END,
				g.depth + 1
			FROM ai_knowledge_edges e
			JOIN graph g ON e.from_node_id = g.node_id OR e.to_node_id = g.node_id
			WHERE g.depth < ?
		)
		SELECT DISTINCT node_id FROM graph
	`, nodeID, depth).Scan(&nodeIDs).Error
	if err != nil {
		return nil, nil, err
	}

	if len(nodeIDs) == 0 {
		nodeIDs = []uint{nodeID}
	}

	var nodes []KnowledgeNode
	if err := r.db.Where("id IN ?", nodeIDs).Find(&nodes).Error; err != nil {
		return nil, nil, err
	}

	var edges []KnowledgeEdge
	if err := r.db.Where("from_node_id IN ? AND to_node_id IN ?", nodeIDs, nodeIDs).Find(&edges).Error; err != nil {
		return nil, nil, err
	}

	return nodes, edges, nil
}

func (r *KnowledgeNodeRepo) DB() *gorm.DB {
	return r.db.DB
}
