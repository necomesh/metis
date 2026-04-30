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
	"metis/internal/pkg/token"
	"metis/internal/repository"
	"metis/internal/service"
)

func newTestDBForTwoFactorHandler(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	gdb, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err := gdb.AutoMigrate(&model.User{}, &model.TwoFactorSecret{}); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}
	return gdb
}

func newTwoFactorHandlerForTest(t *testing.T, db *gorm.DB, jwtSecret []byte) *TwoFactorHandler {
	t.Helper()
	injector := do.New()
	do.ProvideValue(injector, &database.DB{DB: db})
	do.Provide(injector, repository.NewUser)
	do.Provide(injector, repository.NewTwoFactorSecret)
	do.Provide(injector, service.NewTwoFactor)

	return &TwoFactorHandler{
		tfSvc:     do.MustInvoke[*service.TwoFactorService](injector),
		jwtSecret: jwtSecret,
	}
}

func setupTwoFactorLoginRouter(h *TwoFactorHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/v1/auth/2fa/login", h.Login)
	return r
}

func TestTwoFactorHandlerLogin_NotSetupReturnsUnauthorized(t *testing.T) {
	db := newTestDBForTwoFactorHandler(t)
	jwtSecret := []byte("test-secret")
	h := newTwoFactorHandlerForTest(t, db, jwtSecret)
	r := setupTwoFactorLoginRouter(h)

	tokenStr, err := token.GenerateTwoFactorToken(42, jwtSecret)
	if err != nil {
		t.Fatalf("generate two-factor token: %v", err)
	}

	body := bytes.NewBufferString(`{"twoFactorToken":"` + tokenStr + `","code":"123456"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/2fa/login", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Code != -1 {
		t.Fatalf("expected response code -1, got %d", resp.Code)
	}
}