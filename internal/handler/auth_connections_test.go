package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"metis/internal/database"
	"metis/internal/model"
	"metis/internal/pkg/oauth"
	"metis/internal/repository"
	"metis/internal/service"
)

func newTestDBForAuthConnectionsHandler(t *testing.T) *gorm.DB {
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

func newAuthHandlerForConnectionsTest(t *testing.T, db *gorm.DB) *AuthHandler {
	t.Helper()
	injector := do.New()
	do.ProvideValue(injector, &database.DB{DB: db})
	do.Provide(injector, repository.NewUser)
	do.Provide(injector, repository.NewUserConnection)
	do.Provide(injector, service.NewUserConnection)
	return &AuthHandler{connSvc: do.MustInvoke[*service.UserConnectionService](injector)}
}

func setupAuthConnectionsRouter(h *AuthHandler, userID uint) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userId", userID)
		c.Next()
	})
	r.GET("/api/v1/auth/connections", h.ListConnections)
	r.DELETE("/api/v1/auth/connections/:provider", h.Unbind)
	return r
}

func seedUserForAuthConnectionsHandler(t *testing.T, db *gorm.DB, username, password string) *model.User {
	t.Helper()
	user := &model.User{Username: username, Password: password, IsActive: true}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return user
}

func seedAuthConnection(t *testing.T, db *gorm.DB, userID uint, provider, externalID string) {
	t.Helper()
	conn := &model.UserConnection{UserID: userID, Provider: provider, ExternalID: externalID}
	if err := db.Create(conn).Error; err != nil {
		t.Fatalf("seed connection: %v", err)
	}
}

func TestAuthHandlerListConnections_ReturnsCurrentUserConnections(t *testing.T) {
	db := newTestDBForAuthConnectionsHandler(t)
	user := seedUserForAuthConnectionsHandler(t, db, "alice", "local-password")
	other := seedUserForAuthConnectionsHandler(t, db, "bob", "local-password")
	seedAuthConnection(t, db, user.ID, "github", "gh-1")
	seedAuthConnection(t, db, other.ID, "google", "g-1")
	h := newAuthHandlerForConnectionsTest(t, db)
	r := setupAuthConnectionsRouter(h, user.ID)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/connections", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Code int `json:"code"`
		Data []struct {
			Provider string `json:"provider"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if len(resp.Data) != 1 || resp.Data[0].Provider != "github" {
		t.Fatalf("expected only github connection, got %+v", resp.Data)
	}
}

func TestAuthHandlerUnbind_Success(t *testing.T) {
	db := newTestDBForAuthConnectionsHandler(t)
	user := seedUserForAuthConnectionsHandler(t, db, "alice", "local-password")
	seedAuthConnection(t, db, user.ID, "github", "gh-1")
	h := newAuthHandlerForConnectionsTest(t, db)
	r := setupAuthConnectionsRouter(h, user.ID)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/auth/connections/github", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAuthHandlerUnbind_NotFoundReturns404(t *testing.T) {
	db := newTestDBForAuthConnectionsHandler(t)
	user := seedUserForAuthConnectionsHandler(t, db, "alice", "local-password")
	h := newAuthHandlerForConnectionsTest(t, db)
	r := setupAuthConnectionsRouter(h, user.ID)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/auth/connections/github", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAuthHandlerUnbind_LastLoginMethodReturnsBadRequest(t *testing.T) {
	db := newTestDBForAuthConnectionsHandler(t)
	user := seedUserForAuthConnectionsHandler(t, db, "oauth-user", "")
	seedAuthConnection(t, db, user.ID, "github", "gh-only")
	h := newAuthHandlerForConnectionsTest(t, db)
	r := setupAuthConnectionsRouter(h, user.ID)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/auth/connections/github", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAuthHandlerBindCallback_RejectsProviderMismatchWithState(t *testing.T) {
	stateMgr := oauth.NewStateManager()
	t.Cleanup(stateMgr.Stop)

	state, err := stateMgr.GenerateForBind("github", 7)
	if err != nil {
		t.Fatalf("generate bind state: %v", err)
	}

	h := &AuthHandler{stateMgr: stateMgr}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(func(c *gin.Context) {
		c.Set("userId", uint(7))
		c.Next()
	})
	r.POST("/api/v1/auth/connections/callback", h.BindCallback)

	body := bytes.NewBufferString(`{"provider":"google","code":"dummy-code","state":"` + state + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/connections/callback", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for provider/state mismatch, got %d: %s", w.Code, w.Body.String())
	}
}