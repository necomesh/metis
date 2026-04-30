package service

import (
	"errors"
	"fmt"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"metis/internal/database"
	"metis/internal/model"
	"metis/internal/repository"
)

func newTestDBForUserConnection(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	gdb, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err := gdb.AutoMigrate(&model.User{}, &model.UserConnection{}); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}
	return gdb
}

func newUserConnectionServiceForTest(t *testing.T, db *gorm.DB) *UserConnectionService {
	t.Helper()
	injector := do.New()
	do.ProvideValue(injector, &database.DB{DB: db})
	do.Provide(injector, repository.NewUser)
	do.Provide(injector, repository.NewUserConnection)
	do.Provide(injector, NewUserConnection)
	return do.MustInvoke[*UserConnectionService](injector)
}

func seedUserForConnectionTest(t *testing.T, db *gorm.DB, username, password string) *model.User {
	t.Helper()
	user := &model.User{Username: username, Password: password, IsActive: true}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return user
}

func seedConnectionForTest(t *testing.T, db *gorm.DB, userID uint, provider, externalID string) *model.UserConnection {
	t.Helper()
	conn := &model.UserConnection{UserID: userID, Provider: provider, ExternalID: externalID}
	if err := db.Create(conn).Error; err != nil {
		t.Fatalf("seed connection: %v", err)
	}
	return conn
}

func TestUserConnectionServiceBind_CreatesConnection(t *testing.T) {
	db := newTestDBForUserConnection(t)
	svc := newUserConnectionServiceForTest(t, db)
	user := seedUserForConnectionTest(t, db, "alice", "local-password")

	if err := svc.Bind(user.ID, "github", "gh-1", "Alice", "alice@example.com", "https://avatar"); err != nil {
		t.Fatalf("bind connection: %v", err)
	}

	conns, err := svc.ListByUser(user.ID)
	if err != nil {
		t.Fatalf("list connections: %v", err)
	}
	if len(conns) != 1 {
		t.Fatalf("expected 1 connection, got %d", len(conns))
	}
	if conns[0].Provider != "github" || conns[0].ExternalID != "gh-1" {
		t.Fatalf("unexpected connection: %+v", conns[0])
	}
}

func TestUserConnectionServiceBind_RejectsExternalIDBoundToOtherUser(t *testing.T) {
	db := newTestDBForUserConnection(t)
	svc := newUserConnectionServiceForTest(t, db)
	first := seedUserForConnectionTest(t, db, "alice", "")
	second := seedUserForConnectionTest(t, db, "bob", "")
	seedConnectionForTest(t, db, first.ID, "github", "shared-id")

	err := svc.Bind(second.ID, "github", "shared-id", "Bob", "bob@example.com", "")
	if !errors.Is(err, ErrExternalIDBound) {
		t.Fatalf("expected ErrExternalIDBound, got %v", err)
	}
}

func TestUserConnectionServiceUnbind_RejectsLastLoginMethodForOAuthOnlyUser(t *testing.T) {
	db := newTestDBForUserConnection(t)
	svc := newUserConnectionServiceForTest(t, db)
	user := seedUserForConnectionTest(t, db, "oauth-user", "")
	seedConnectionForTest(t, db, user.ID, "github", "gh-only")

	err := svc.Unbind(user.ID, "github")
	if !errors.Is(err, ErrLastLoginMethod) {
		t.Fatalf("expected ErrLastLoginMethod, got %v", err)
	}
}