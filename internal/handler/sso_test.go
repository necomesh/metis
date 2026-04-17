package handler

import (
	"context"
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
	"metis/internal/pkg/identity"
	"metis/internal/repository"
	"metis/internal/service"
)

func newTestDBForSSOHandler(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	gdb, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err := gdb.AutoMigrate(&model.IdentitySource{}, &model.SystemConfig{}); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}
	return gdb
}

func seedIdentitySource(t *testing.T, db *gorm.DB, name, sourceType, config, domains string, enabled bool) *model.IdentitySource {
	t.Helper()
	s := &model.IdentitySource{
		Name:    name,
		Type:    sourceType,
		Config:  config,
		Domains: domains,
		Enabled: enabled,
	}
	if err := db.Create(s).Error; err != nil {
		t.Fatalf("seed identity source: %v", err)
	}
	return s
}

func newIdentitySourceServiceForTest(t *testing.T, db *gorm.DB) *service.IdentitySourceService {
	t.Helper()
	injector := do.New()
	do.ProvideValue(injector, &database.DB{DB: db})
	do.Provide(injector, repository.NewIdentitySource)
	do.Provide(injector, service.NewIdentitySource)
	svc := do.MustInvoke[*service.IdentitySourceService](injector)
	svc.TestOIDCFn = func(ctx context.Context, issuerURL string) error { return nil }
	svc.TestLDAPFn = func(cfg *model.LDAPConfig) error { return nil }
	svc.LDAPAuthFn = func(cfg *model.LDAPConfig, username, password string) (*identity.LDAPAuthResult, error) {
		return &identity.LDAPAuthResult{DN: "cn=user", Username: "user"}, nil
	}
	return svc
}

func newSSOHandlerForTest(t *testing.T, db *gorm.DB) *SSOHandler {
	t.Helper()
	svc := newIdentitySourceServiceForTest(t, db)
	return &SSOHandler{
		svc:      svc,
		stateMgr: identity.NewSSOStateManager(),
	}
}

func setupSSORouter(h *SSOHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/api/v1")
	{
		v1.GET("/auth/check-domain", h.CheckDomain)
		v1.GET("/auth/sso/:id/authorize", h.InitiateSSO)
		v1.POST("/auth/sso/callback", h.SSOCallback)
	}
	return r
}

func TestSSOHandler_CheckDomain_Success(t *testing.T) {
	db := newTestDBForSSOHandler(t)
	h := newSSOHandlerForTest(t, db)
	seedIdentitySource(t, db, "Okta", "oidc", `{}`, "acme.com", true)
	r := setupSSORouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/check-domain?email=user@acme.com", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSSOHandler_CheckDomain_MissingEmail(t *testing.T) {
	db := newTestDBForSSOHandler(t)
	h := newSSOHandlerForTest(t, db)
	r := setupSSORouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/check-domain", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSSOHandler_CheckDomain_InvalidEmail(t *testing.T) {
	db := newTestDBForSSOHandler(t)
	h := newSSOHandlerForTest(t, db)
	r := setupSSORouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/check-domain?email=not-an-email", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSSOHandler_CheckDomain_NotFound(t *testing.T) {
	db := newTestDBForSSOHandler(t)
	h := newSSOHandlerForTest(t, db)
	r := setupSSORouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/check-domain?email=user@unknown.com", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}
