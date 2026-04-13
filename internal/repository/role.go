package repository

import (
	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"metis/internal/database"
	"metis/internal/model"
)

type RoleRepo struct {
	db *database.DB
}

func NewRole(i do.Injector) (*RoleRepo, error) {
	db := do.MustInvoke[*database.DB](i)
	return &RoleRepo{db: db}, nil
}

func (r *RoleRepo) FindByID(id uint) (*model.Role, error) {
	var role model.Role
	if err := r.db.First(&role, id).Error; err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *RoleRepo) FindByCode(code string) (*model.Role, error) {
	var role model.Role
	if err := r.db.Where("code = ?", code).First(&role).Error; err != nil {
		return nil, err
	}
	return &role, nil
}

// FindByIDWithDeptScope loads a role and its custom department scope entries.
func (r *RoleRepo) FindByIDWithDeptScope(id uint) (*model.Role, []uint, error) {
	role, err := r.FindByID(id)
	if err != nil {
		return nil, nil, err
	}
	deptIDs, err := r.GetCustomDeptIDs(id)
	if err != nil {
		return nil, nil, err
	}
	return role, deptIDs, nil
}

// GetCustomDeptIDs returns the configured department IDs for a CUSTOM-scope role.
func (r *RoleRepo) GetCustomDeptIDs(roleID uint) ([]uint, error) {
	var entries []model.RoleDeptScope
	if err := r.db.Where("role_id = ?", roleID).Find(&entries).Error; err != nil {
		return nil, err
	}
	ids := make([]uint, len(entries))
	for i, e := range entries {
		ids[i] = e.DepartmentID
	}
	return ids, nil
}

// SetCustomDeptIDs atomically replaces the custom department set for a role.
func (r *RoleRepo) SetCustomDeptIDs(roleID uint, deptIDs []uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", roleID).Delete(&model.RoleDeptScope{}).Error; err != nil {
			return err
		}
		if len(deptIDs) == 0 {
			return nil
		}
		entries := make([]model.RoleDeptScope, len(deptIDs))
		for i, id := range deptIDs {
			entries[i] = model.RoleDeptScope{RoleID: roleID, DepartmentID: id}
		}
		return tx.Create(&entries).Error
	})
}

// GetScopeByCode returns the DataScope and custom dept IDs for the given role code.
// Used by DataScopeMiddleware.
func (r *RoleRepo) GetScopeByCode(code string) (model.DataScope, []uint, error) {
	role, err := r.FindByCode(code)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return model.DataScopeAll, nil, nil
		}
		return model.DataScopeAll, nil, err
	}
	if role.DataScope != model.DataScopeCustom {
		return role.DataScope, nil, nil
	}
	deptIDs, err := r.GetCustomDeptIDs(role.ID)
	return role.DataScope, deptIDs, err
}

func (r *RoleRepo) List(page, pageSize int) ([]model.Role, int64, error) {
	var total int64
	if err := r.db.Model(&model.Role{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	var roles []model.Role
	offset := (page - 1) * pageSize
	if err := r.db.Offset(offset).Limit(pageSize).Order("sort ASC, id ASC").Find(&roles).Error; err != nil {
		return nil, 0, err
	}

	return roles, total, nil
}

func (r *RoleRepo) Create(role *model.Role) error {
	return r.db.Create(role).Error
}

func (r *RoleRepo) Update(role *model.Role) error {
	return r.db.Save(role).Error
}

func (r *RoleRepo) Delete(id uint) error {
	result := r.db.Delete(&model.Role{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *RoleRepo) ExistsByCode(code string) (bool, error) {
	var count int64
	if err := r.db.Model(&model.Role{}).Where("code = ?", code).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *RoleRepo) CountUsersByRoleID(roleID uint) (int64, error) {
	var count int64
	if err := r.db.Model(&model.User{}).Where("role_id = ?", roleID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
