package model

// DataScope defines the data visibility scope for a role.
type DataScope string

const (
	DataScopeAll        DataScope = "all"          // All data, no filtering
	DataScopeDeptAndSub DataScope = "dept_and_sub" // User's departments + all sub-departments (BFS)
	DataScopeDept       DataScope = "dept"          // User's departments only (no sub-departments)
	DataScopeSelf       DataScope = "self"          // Only records owned by the user
	DataScopeCustom     DataScope = "custom"        // Explicitly configured department set
)

// ValidDataScopes is the set of accepted scope values.
var ValidDataScopes = map[DataScope]bool{
	DataScopeAll:        true,
	DataScopeDeptAndSub: true,
	DataScopeDept:       true,
	DataScopeSelf:       true,
	DataScopeCustom:     true,
}

type Role struct {
	BaseModel
	Name        string    `json:"name" gorm:"size:64;not null"`
	Code        string    `json:"code" gorm:"uniqueIndex;size:64;not null"`
	Description string    `json:"description" gorm:"size:255"`
	Sort        int       `json:"sort" gorm:"default:0"`
	IsSystem    bool      `json:"isSystem" gorm:"not null;default:false"`
	DataScope   DataScope `json:"dataScope" gorm:"size:32;not null;default:'all'"`
}

// RoleDeptScope stores the explicit department set for a role with DataScopeCustom.
type RoleDeptScope struct {
	RoleID       uint `json:"roleId" gorm:"not null;index:idx_role_dept,unique"`
	DepartmentID uint `json:"departmentId" gorm:"not null;index:idx_role_dept,unique"`
}

func (RoleDeptScope) TableName() string { return "role_dept_scopes" }

type RoleResponse struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}
