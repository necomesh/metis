package node

import (
	"github.com/samber/do/v2"

	"metis/internal/database"
)

type NodeProcessRepo struct {
	db *database.DB
}

func NewNodeProcessRepo(i do.Injector) (*NodeProcessRepo, error) {
	db := do.MustInvoke[*database.DB](i)
	return &NodeProcessRepo{db: db}, nil
}

func (r *NodeProcessRepo) Create(np *NodeProcess) error {
	return r.db.Create(np).Error
}

func (r *NodeProcessRepo) FindByID(id uint) (*NodeProcess, error) {
	var np NodeProcess
	if err := r.db.First(&np, id).Error; err != nil {
		return nil, err
	}
	return &np, nil
}

func (r *NodeProcessRepo) FindByNodeAndProcessDef(nodeID, processDefID uint) (*NodeProcess, error) {
	var np NodeProcess
	if err := r.db.Where("node_id = ? AND process_def_id = ?", nodeID, processDefID).First(&np).Error; err != nil {
		return nil, err
	}
	return &np, nil
}

type NodeProcessDetail struct {
	NodeProcess
	ProcessName string `gorm:"column:process_name"`
	DisplayName string `gorm:"column:display_name"`
}

func (r *NodeProcessRepo) ListByNodeID(nodeID uint) ([]NodeProcessDetail, error) {
	var items []NodeProcessDetail
	if err := r.db.Model(&NodeProcess{}).
		Select("node_processes.*, process_defs.name as process_name, process_defs.display_name as display_name").
		Joins("LEFT JOIN process_defs ON process_defs.id = node_processes.process_def_id AND process_defs.deleted_at IS NULL").
		Where("node_processes.node_id = ?", nodeID).
		Order("node_processes.created_at ASC").
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *NodeProcessRepo) ListByProcessDefID(processDefID uint) ([]NodeProcess, error) {
	var items []NodeProcess
	if err := r.db.Where("process_def_id = ?", processDefID).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *NodeProcessRepo) UpdateStatus(id uint, status string, pid int) error {
	updates := map[string]any{"status": status, "pid": pid}
	return r.db.Model(&NodeProcess{}).Where("id = ?", id).Updates(updates).Error
}

func (r *NodeProcessRepo) UpdateConfigVersion(id uint, version string) error {
	return r.db.Model(&NodeProcess{}).Where("id = ?", id).Update("config_version", version).Error
}

func (r *NodeProcessRepo) UpdateProbe(id uint, probeResult JSONMap) error {
	return r.db.Model(&NodeProcess{}).Where("id = ?", id).Update("last_probe", probeResult).Error
}

func (r *NodeProcessRepo) Delete(id uint) error {
	return r.db.Delete(&NodeProcess{}, id).Error
}

func (r *NodeProcessRepo) DeleteByNodeID(nodeID uint) error {
	return r.db.Where("node_id = ?", nodeID).Delete(&NodeProcess{}).Error
}

func (r *NodeProcessRepo) BatchUpdateStatusByNodeID(nodeID uint, status string) error {
	return r.db.Model(&NodeProcess{}).Where("node_id = ?", nodeID).Updates(map[string]any{
		"status": status,
		"pid":    0,
	}).Error
}
