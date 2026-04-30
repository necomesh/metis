package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
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

func newTestDBForSiteInfoHandler(t *testing.T) *gorm.DB {
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

func newSiteInfoHandlerForTest(t *testing.T, db *gorm.DB) *Handler {
	t.Helper()
	injector := do.New()
	do.ProvideValue(injector, &database.DB{DB: db})
	do.Provide(injector, repository.NewSysConfig)
	do.Provide(injector, service.NewSysConfig)

	return &Handler{
		sysCfg: do.MustInvoke[*service.SysConfigService](injector),
	}
}

func setupSiteInfoRouter(h *Handler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userId", uint(7))
		c.Set("userName", "admin")
		c.Next()
		if action, ok := c.Get("audit_action"); ok {
			c.Writer.Header().Set("X-Audit-Action", action.(string))
		}
		if resource, ok := c.Get("audit_resource"); ok {
			c.Writer.Header().Set("X-Audit-Resource", resource.(string))
		}
		if summary, ok := c.Get("audit_summary"); ok {
			c.Writer.Header().Set("X-Audit-Summary", summary.(string))
		}
	})
	r.GET("/api/v1/site-info", h.GetSiteInfo)
	r.PUT("/api/v1/site-info", h.UpdateSiteInfo)
	r.GET("/api/v1/site-info/logo", h.GetLogo)
	r.PUT("/api/v1/site-info/logo", h.UploadLogo)
	r.DELETE("/api/v1/site-info/logo", h.DeleteLogo)
	return r
}

func seedSiteConfig(t *testing.T, db *gorm.DB, key, value string) {
	t.Helper()
	if err := db.Save(&model.SystemConfig{Key: key, Value: value}).Error; err != nil {
		t.Fatalf("seed system config: %v", err)
	}
}

func makeImageDataURL(raw []byte) string {
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(raw)
}

func TestHandlerGetSiteInfo_ReturnsDefaults(t *testing.T) {
	db := newTestDBForSiteInfoHandler(t)
	h := newSiteInfoHandlerForTest(t, db)
	r := setupSiteInfoRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/site-info", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Code int `json:"code"`
		Data struct {
			AppName  string `json:"appName"`
			HasLogo  bool   `json:"hasLogo"`
			Locale   string `json:"locale"`
			Timezone string `json:"timezone"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Data.AppName != defaultAppName {
		t.Fatalf("expected AppName=%s, got %s", defaultAppName, resp.Data.AppName)
	}
	if resp.Data.HasLogo {
		t.Fatal("expected HasLogo=false")
	}
	if resp.Data.Locale != "zh-CN" {
		t.Fatalf("expected Locale=zh-CN, got %s", resp.Data.Locale)
	}
	if resp.Data.Timezone != "UTC" {
		t.Fatalf("expected Timezone=UTC, got %s", resp.Data.Timezone)
	}
}

func TestHandlerUpdateSiteInfo_RequiresAppName(t *testing.T) {
	db := newTestDBForSiteInfoHandler(t)
	h := newSiteInfoHandlerForTest(t, db)
	r := setupSiteInfoRouter(h)

	body := bytes.NewBufferString(`{"appName":""}`)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/site-info", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandlerUpdateSiteInfo_SetsAuditMetadata(t *testing.T) {
	db := newTestDBForSiteInfoHandler(t)
	h := newSiteInfoHandlerForTest(t, db)
	r := setupSiteInfoRouter(h)

	body := bytes.NewBufferString(`{"appName":"Metis Pro"}`)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/site-info", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("X-Audit-Action"); got != "site_info.update" {
		t.Fatalf("expected audit action site_info.update, got %q", got)
	}
	if got := w.Header().Get("X-Audit-Resource"); got != "site_info" {
		t.Fatalf("expected audit resource site_info, got %q", got)
	}
	if got := w.Header().Get("X-Audit-Summary"); got == "" {
		t.Fatal("expected non-empty audit summary")
	}
}

func TestHandlerUploadLogo_RejectsOversizedPayload(t *testing.T) {
	db := newTestDBForSiteInfoHandler(t)
	h := newSiteInfoHandlerForTest(t, db)
	r := setupSiteInfoRouter(h)

	tooLarge := makeImageDataURL([]byte(strings.Repeat("a", maxLogoBytes+1)))
	body := bytes.NewBufferString(`{"data":"` + tooLarge + `"}`)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/site-info/logo", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandlerGetLogo_ReturnsStoredBinary(t *testing.T) {
	db := newTestDBForSiteInfoHandler(t)
	h := newSiteInfoHandlerForTest(t, db)
	r := setupSiteInfoRouter(h)
	raw := []byte("png-bytes")
	seedSiteConfig(t, db, keySiteLogo, makeImageDataURL(raw))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/site-info/logo", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Content-Type"); got != "image/png" {
		t.Fatalf("expected Content-Type=image/png, got %s", got)
	}
	if !bytes.Equal(w.Body.Bytes(), raw) {
		t.Fatalf("expected %q, got %q", raw, w.Body.Bytes())
	}
	}