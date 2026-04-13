package app

import (
	"embed"

	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"metis/internal/scheduler"
)

// App is the interface that pluggable modules must implement.
type App interface {
	Name() string
	Models() []any
	Seed(db *gorm.DB, enforcer *casbin.Enforcer) error
	Providers(i do.Injector)
	Routes(api *gin.RouterGroup)
	Tasks() []scheduler.TaskDef
}

// LocaleProvider is an optional interface an App can implement
// to supply additional locale JSON files for go-i18n.
type LocaleProvider interface {
	Locales() embed.FS
}

// OrgScopeResolver is an optional interface implemented by the Org App.
// It resolves the set of department IDs visible to a given user based on
// their organisational assignments. DataScopeMiddleware uses this interface;
// when the Org App is not installed the resolver is nil and no dept filtering
// is applied (equivalent to DataScopeAll).
type OrgScopeResolver interface {
	// GetUserDeptScope returns the department IDs the user can access.
	// For DataScopeDept it returns only the user's directly assigned departments.
	// For DataScopeDeptAndSub it returns those plus all active sub-departments (BFS).
	GetUserDeptScope(userID uint, includeSubDepts bool) ([]uint, error)
}

var apps []App

func Register(a App) { apps = append(apps, a) }
func All() []App     { return apps }
