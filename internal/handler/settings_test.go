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
	"metis/internal/repository"
	"metis/internal/service"
)

func newTestDBForSettingsHandler(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	gdb, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err := gdb.AutoMigrate(&model.SystemConfig{}); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}
	return gdb
}

func newSettingsHandlerForTest(t *testing.T, db *gorm.DB) *Handler {
	t.Helper()
	injector := do.New()
	do.ProvideValue(injector, &database.DB{DB: db})
	do.Provide(injector, repository.NewSysConfig)
	do.Provide(injector, service.NewSysConfig)
	do.Provide(injector, service.NewSettings)

	return &Handler{
		settingsSvc: do.MustInvoke[*service.SettingsService](injector),
	}
}

func setupSettingsRouter(h *Handler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/v1/settings/security", h.GetSecuritySettings)
	r.PUT("/api/v1/settings/security", h.UpdateSecuritySettings)
	r.GET("/api/v1/settings/scheduler", h.GetSchedulerSettings)
	r.PUT("/api/v1/settings/scheduler", h.UpdateSchedulerSettings)
	return r
}

func TestHandlerGetSecuritySettings_ReturnsDefaults(t *testing.T) {
	db := newTestDBForSettingsHandler(t)
	h := newSettingsHandlerForTest(t, db)
	r := setupSettingsRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/settings/security", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Code int `json:"code"`
		Data struct {
			MaxConcurrentSessions int    `json:"maxConcurrentSessions"`
			SessionTimeoutMinutes int    `json:"sessionTimeoutMinutes"`
			CaptchaProvider      string `json:"captchaProvider"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Code != 0 {
		t.Fatalf("expected response code 0, got %d", resp.Code)
	}
	if resp.Data.MaxConcurrentSessions != 5 {
		t.Fatalf("expected MaxConcurrentSessions=5, got %d", resp.Data.MaxConcurrentSessions)
	}
	if resp.Data.SessionTimeoutMinutes != 10080 {
		t.Fatalf("expected SessionTimeoutMinutes=10080, got %d", resp.Data.SessionTimeoutMinutes)
	}
	if resp.Data.CaptchaProvider != "none" {
		t.Fatalf("expected CaptchaProvider=none, got %s", resp.Data.CaptchaProvider)
	}
}

func TestHandlerUpdateSecuritySettings_RejectsNegativeMaxConcurrentSessions(t *testing.T) {
	db := newTestDBForSettingsHandler(t)
	h := newSettingsHandlerForTest(t, db)
	r := setupSettingsRouter(h)

	body := bytes.NewBufferString(`{"maxConcurrentSessions":-1}`)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/settings/security", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandlerUpdateSecuritySettings_ReturnsNormalizedPersistedSettings(t *testing.T) {
	db := newTestDBForSettingsHandler(t)
	h := newSettingsHandlerForTest(t, db)
	r := setupSettingsRouter(h)

	body := bytes.NewBufferString(`{"captchaProvider":"invalid","sessionTimeoutMinutes":0}`)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/settings/security", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Code int `json:"code"`
		Data struct {
			CaptchaProvider      string `json:"captchaProvider"`
			SessionTimeoutMinutes int   `json:"sessionTimeoutMinutes"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Data.CaptchaProvider != "none" {
		t.Fatalf("expected normalized CaptchaProvider=none, got %s", resp.Data.CaptchaProvider)
	}
	if resp.Data.SessionTimeoutMinutes != 10080 {
		t.Fatalf("expected normalized SessionTimeoutMinutes=10080, got %d", resp.Data.SessionTimeoutMinutes)
	}
}