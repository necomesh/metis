package itsm

import (
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	aiapp "metis/internal/app/ai"
	org "metis/internal/app/org"
	"metis/internal/model"
)

func newSeedAlignmentDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + t.Name() + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(
		&ServiceCatalog{}, &ServiceDefinition{}, &ServiceAction{}, &SLATemplate{},
		&org.Department{}, &org.Position{}, &org.DepartmentPosition{}, &org.UserPosition{},
		&model.User{}, &model.Role{}, &model.SystemConfig{}, &aiapp.Agent{},
	); err != nil {
		t.Fatalf("migrate db: %v", err)
	}
	return db
}

func TestBuiltInSmartSeedsAlignParticipantsAndInstallAdminIdentity(t *testing.T) {
	db := newSeedAlignmentDB(t)

	adminRole := model.Role{Name: "Admin", Code: model.RoleAdmin}
	if err := db.Create(&adminRole).Error; err != nil {
		t.Fatalf("create admin role: %v", err)
	}
	decisionAgent := aiapp.Agent{Name: "Decision", Code: "itsm.decision", Type: "internal", IsActive: true}
	if err := db.Create(&decisionAgent).Error; err != nil {
		t.Fatalf("create decision agent: %v", err)
	}
	admin := model.User{Username: "admin", Nickname: "Admin", IsActive: true, RoleID: adminRole.ID}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("create admin user: %v", err)
	}

	if err := seedDepartments(db); err != nil {
		t.Fatalf("seed departments: %v", err)
	}
	if err := seedPositions(db); err != nil {
		t.Fatalf("seed positions: %v", err)
	}
	if err := seedDepartmentPositions(db); err != nil {
		t.Fatalf("seed department positions: %v", err)
	}
	if err := seedCatalogs(db); err != nil {
		t.Fatalf("seed catalogs: %v", err)
	}
	if err := seedPriorities(db); err != nil {
		t.Fatalf("seed priorities: %v", err)
	}
	if err := seedSLATemplates(db); err != nil {
		t.Fatalf("seed sla: %v", err)
	}
	if err := seedServiceDefinitions(db); err != nil {
		t.Fatalf("seed services: %v", err)
	}
	if err := assignInstallAdminOrgIdentity(db, "admin"); err != nil {
		t.Fatalf("assign install admin identity: %v", err)
	}

	t.Run("org positions include required built-ins", func(t *testing.T) {
		for _, code := range []string{"it_admin", "db_admin", "network_admin", "security_admin", "ops_admin", "serial_reviewer"} {
			var count int64
			if err := db.Model(&org.Position{}).Where("code = ?", code).Count(&count).Error; err != nil {
				t.Fatalf("count position %s: %v", code, err)
			}
			if count != 1 {
				t.Fatalf("expected position %s to exist once, got %d", code, count)
			}
		}
	})

	t.Run("it department allows ops admin", func(t *testing.T) {
		var dept org.Department
		if err := db.Where("code = ?", "it").First(&dept).Error; err != nil {
			t.Fatalf("load it dept: %v", err)
		}
		var pos org.Position
		if err := db.Where("code = ?", "ops_admin").First(&pos).Error; err != nil {
			t.Fatalf("load ops_admin: %v", err)
		}
		var count int64
		if err := db.Model(&org.DepartmentPosition{}).Where("department_id = ? AND position_id = ?", dept.ID, pos.ID).Count(&count).Error; err != nil {
			t.Fatalf("count dept-position: %v", err)
		}
		if count != 1 {
			t.Fatalf("expected ops_admin to be allowed in it, got %d", count)
		}
	})

	t.Run("built-in smart services reference aligned participant codes", func(t *testing.T) {
		var services []ServiceDefinition
		if err := db.Where("engine_type = ?", "smart").Find(&services).Error; err != nil {
			t.Fatalf("load smart services: %v", err)
		}
		wanted := map[string][]string{
			"boss-serial-change-request":     {"serial-reviewer", "ops_admin"},
			"db-backup-whitelist-action-e2e": {"db_admin"},
			"prod-server-temporary-access":   {"ops_admin", "network_admin", "security_admin"},
			"vpn-access-request":             {"network_admin", "security_admin"},
			"copilot-account-request":        {"IT管理员"},
		}
		for _, svc := range services {
			needles, ok := wanted[svc.Code]
			if !ok {
				continue
			}
			for _, needle := range needles {
				if !strings.Contains(svc.CollaborationSpec, needle) {
					t.Fatalf("service %s missing participant marker %q in collaboration spec", svc.Code, needle)
				}
			}
			if strings.Contains(svc.CollaborationSpec, "dba_admin") {
				t.Fatalf("service %s should not reference legacy dba_admin code", svc.Code)
			}
		}
	})

	t.Run("install admin gets it_admin identity", func(t *testing.T) {
		var dept org.Department
		if err := db.Where("code = ?", "it").First(&dept).Error; err != nil {
			t.Fatalf("load it dept: %v", err)
		}
		var pos org.Position
		if err := db.Where("code = ?", "it_admin").First(&pos).Error; err != nil {
			t.Fatalf("load it_admin: %v", err)
		}
		var count int64
		if err := db.Table("user_positions").Where("user_id = ? AND department_id = ? AND position_id = ? AND is_primary = ?", admin.ID, dept.ID, pos.ID, true).Count(&count).Error; err != nil {
			t.Fatalf("count admin user position: %v", err)
		}
		if count != 1 {
			t.Fatalf("expected admin to have primary it/it_admin identity, got %d", count)
		}
	})
}
