package node

import (
	"time"

	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"metis/internal/database"
)

type NodeRepo struct {
	db *database.DB
}

func NewNodeRepo(i do.Injector) (*NodeRepo, error) {
	db := do.MustInvoke[*database.DB](i)
	return &NodeRepo{db: db}, nil
}

func (r *NodeRepo) Create(node *Node) error {
	return r.db.Create(node).Error
}

func (r *NodeRepo) FindByID(id uint) (*Node, error) {
	var node Node
	if err := r.db.First(&node, id).Error; err != nil {
		return nil, err
	}
	return &node, nil
}

func (r *NodeRepo) FindByName(name string) (*Node, error) {
	var node Node
	if err := r.db.Where("name = ?", name).First(&node).Error; err != nil {
		return nil, err
	}
	return &node, nil
}

func (r *NodeRepo) FindByTokenPrefix(prefix string) ([]Node, error) {
	var nodes []Node
	if err := r.db.Where("token_prefix = ?", prefix).Find(&nodes).Error; err != nil {
		return nil, err
	}
	return nodes, nil
}

type NodeListParams struct {
	Keyword  string
	Status   string
	Page     int
	PageSize int
}

type NodeListItem struct {
	Node
	ProcessCount int `gorm:"column:process_count"`
}

func (r *NodeRepo) List(params NodeListParams) ([]NodeListItem, int64, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 20
	}

	base := r.db.Model(&Node{})

	if params.Keyword != "" {
		like := "%" + params.Keyword + "%"
		base = base.Where("name LIKE ?", like)
	}
	if params.Status != "" {
		base = base.Where("status = ?", params.Status)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []NodeListItem
	offset := (params.Page - 1) * params.PageSize
	if err := base.Select("nodes.*, (SELECT COUNT(*) FROM node_processes WHERE node_processes.node_id = nodes.id AND node_processes.deleted_at IS NULL) as process_count").
		Offset(offset).Limit(params.PageSize).
		Order("nodes.created_at DESC").
		Find(&items).Error; err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func (r *NodeRepo) Update(id uint, updates map[string]any) error {
	return r.db.Model(&Node{}).Where("id = ?", id).Updates(updates).Error
}

func (r *NodeRepo) Delete(id uint) error {
	return r.db.Delete(&Node{}, id).Error
}

func (r *NodeRepo) UpdateHeartbeat(id uint, sysInfo JSONMap, version string) error {
	now := time.Now()
	return r.db.Model(&Node{}).Where("id = ?", id).Updates(map[string]any{
		"status":         NodeStatusOnline,
		"last_heartbeat": &now,
		"system_info":    sysInfo,
		"version":        version,
	}).Error
}

func (r *NodeRepo) MarkOffline(timeout time.Duration) (int64, error) {
	cutoff := time.Now().Add(-timeout)
	result := r.db.Model(&Node{}).
		Where("status = ? AND last_heartbeat < ?", NodeStatusOnline, cutoff).
		Update("status", NodeStatusOffline)
	return result.RowsAffected, result.Error
}

func (r *NodeRepo) UpdateToken(id uint, hash, prefix string) error {
	return r.db.Model(&Node{}).Where("id = ?", id).Updates(map[string]any{
		"token_hash":   hash,
		"token_prefix": prefix,
	}).Error
}

func (r *NodeRepo) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}
