package itsm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"metis/internal/app/ai"
	"metis/internal/app/itsm/tools"
	"metis/internal/database"
	"metis/internal/model"
	"metis/internal/repository"
)

type blockingServiceDeskMessageStore struct {
	called  chan struct{}
	release chan struct{}
}

func (s *blockingServiceDeskMessageStore) StoreMessageContext(ctx context.Context, sessionID uint, role, content string, metadata []byte, tokenCount int) (*ai.SessionMessage, error) {
	close(s.called)
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-s.release:
		return &ai.SessionMessage{}, nil
	}
}

func newEngineConfigServiceOnly(t *testing.T, db *gorm.DB) *EngineConfigService {
	t.Helper()
	injector := do.New()
	do.ProvideValue(injector, &database.DB{DB: db})
	do.Provide(injector, repository.NewSysConfig)
	return &EngineConfigService{
		sysConfigRepo: do.MustInvoke[*repository.SysConfigRepo](injector),
		db:            db,
	}
}

func configureIntakeAgent(t *testing.T, db *gorm.DB, agentID uint) {
	t.Helper()
	if err := db.Save(&model.SystemConfig{
		Key:   smartTicketIntakeAgentKey,
		Value: strconv.FormatUint(uint64(agentID), 10),
	}).Error; err != nil {
		t.Fatalf("configure intake agent: %v", err)
	}
}

func TestServiceDeskSessionVerificationUsesConfiguredIntakeAgent(t *testing.T) {
	db := newTestDB(t)
	userID := uint(7)
	intake := ai.Agent{Name: "自定义服务受理岗", Type: ai.AgentTypeAssistant, IsActive: true, Visibility: "private", CreatedBy: 1}
	presetCode := "itsm.servicedesk"
	preset := ai.Agent{Name: "默认服务台预设", Code: &presetCode, Type: ai.AgentTypeAssistant, IsActive: true, Visibility: "private", CreatedBy: 1}
	if err := db.Create(&intake).Error; err != nil {
		t.Fatalf("create intake agent: %v", err)
	}
	if err := db.Create(&preset).Error; err != nil {
		t.Fatalf("create preset agent: %v", err)
	}
	configureIntakeAgent(t, db, intake.ID)

	intakeSession := ai.AgentSession{AgentID: intake.ID, UserID: userID, Status: "running"}
	presetSession := ai.AgentSession{AgentID: preset.ID, UserID: userID, Status: "running"}
	if err := db.Create(&intakeSession).Error; err != nil {
		t.Fatalf("create intake session: %v", err)
	}
	if err := db.Create(&presetSession).Error; err != nil {
		t.Fatalf("create preset session: %v", err)
	}

	handler := &ServiceDeskHandler{
		db:             db,
		configProvider: newEngineConfigServiceOnly(t, db),
		stateStore:     tools.NewSessionStateStore(db),
	}

	c, rec := newGinContext(http.MethodGet, "/state")
	c.Params = gin.Params{{Key: "sid", Value: strconv.FormatUint(uint64(intakeSession.ID), 10)}}
	c.Set("userId", userID)
	handler.State(c)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected configured intake session to pass state API, got %d body=%s", rec.Code, rec.Body.String())
	}

	c, rec = newGinContext(http.MethodPost, "/draft/submit")
	c.Params = gin.Params{{Key: "sid", Value: strconv.FormatUint(uint64(intakeSession.ID), 10)}}
	c.Set("userId", userID)
	handler.SubmitDraft(c)
	if rec.Code == http.StatusNotFound {
		t.Fatalf("expected draft API to pass dynamic intake session verification, got body=%s", rec.Body.String())
	}

	c, rec = newGinContext(http.MethodGet, "/state")
	c.Params = gin.Params{{Key: "sid", Value: strconv.FormatUint(uint64(presetSession.ID), 10)}}
	c.Set("userId", userID)
	handler.State(c)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected non-configured preset session to be rejected as 404, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestServiceDeskSessionVerificationRequiresConfiguredIntakeAgent(t *testing.T) {
	db := newTestDB(t)
	agent := ai.Agent{Name: "未上岗受理岗", Type: ai.AgentTypeAssistant, IsActive: true, Visibility: "private", CreatedBy: 1}
	if err := db.Create(&agent).Error; err != nil {
		t.Fatalf("create agent: %v", err)
	}
	session := ai.AgentSession{AgentID: agent.ID, UserID: 7, Status: "running"}
	if err := db.Create(&session).Error; err != nil {
		t.Fatalf("create session: %v", err)
	}

	handler := &ServiceDeskHandler{
		db:             db,
		configProvider: newEngineConfigServiceOnly(t, db),
		stateStore:     tools.NewSessionStateStore(db),
	}
	c, rec := newGinContext(http.MethodGet, "/state")
	c.Params = gin.Params{{Key: "sid", Value: strconv.FormatUint(uint64(session.ID), 10)}}
	c.Set("userId", uint(7))
	handler.State(c)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected missing intake config to return 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestServiceDeskSubmitDraftReturnsBeforeSubmittedSurfacePersistence(t *testing.T) {
	db := newTestDB(t)
	userID := uint(7)
	intake := ai.Agent{Name: "自定义服务受理岗", Type: ai.AgentTypeAssistant, IsActive: true, Visibility: "private", CreatedBy: 1}
	if err := db.Create(&intake).Error; err != nil {
		t.Fatalf("create intake agent: %v", err)
	}
	configureIntakeAgent(t, db, intake.ID)
	session := ai.AgentSession{AgentID: intake.ID, UserID: userID, Status: "running"}
	if err := db.Create(&session).Error; err != nil {
		t.Fatalf("create intake session: %v", err)
	}

	service := seedSmartSubmissionService(t, db)
	ticketSvc := newSubmissionTicketService(t, db)
	operator := tools.NewOperator(db, nil, nil, nil, ticketSvc, nil)
	detail, err := operator.LoadService(service.ID)
	if err != nil {
		t.Fatalf("load service detail: %v", err)
	}
	stateStore := tools.NewSessionStateStore(db)
	if err := stateStore.SaveState(session.ID, &tools.ServiceDeskState{
		Stage:           "awaiting_confirmation",
		LoadedServiceID: service.ID,
		DraftSummary:    "VPN 开通申请",
		DraftFormData: map[string]any{
			"vpn_account":  "admin@dev.com",
			"device_usage": "线上支持用",
			"request_kind": "online_support",
		},
		DraftVersion: 1,
		FieldsHash:   detail.FieldsHash,
	}); err != nil {
		t.Fatalf("save draft state: %v", err)
	}

	messageStore := &blockingServiceDeskMessageStore{
		called:  make(chan struct{}),
		release: make(chan struct{}),
	}
	defer close(messageStore.release)
	handler := &ServiceDeskHandler{
		db:             db,
		configProvider: newEngineConfigServiceOnly(t, db),
		stateStore:     stateStore,
		operator:       operator,
		sessionSvc:     messageStore,
	}

	body := `{"draftVersion":1,"summary":"VPN 开通申请","formData":{"vpn_account":"admin@dev.com","device_usage":"线上支持用","request_kind":"online_support"}}`
	c, rec := newGinContext(http.MethodPost, "/draft/submit")
	c.Params = gin.Params{{Key: "sid", Value: strconv.FormatUint(uint64(session.ID), 10)}}
	c.Set("userId", userID)
	c.Request.Body = io.NopCloser(strings.NewReader(body))
	c.Request.ContentLength = int64(len(body))
	c.Request.Header.Set("Content-Type", "application/json")

	done := make(chan struct{})
	go func() {
		handler.SubmitDraft(c)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(300 * time.Millisecond):
		t.Fatal("submit draft response was blocked by submitted surface persistence")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected submit draft to return 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Code int                     `json:"code"`
		Data tools.DraftSubmitResult `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Code != 0 || !resp.Data.OK || resp.Data.TicketCode == "" {
		t.Fatalf("expected successful draft submit with ticket code, got %+v body=%s", resp, rec.Body.String())
	}
	select {
	case <-messageStore.called:
	case <-time.After(time.Second):
		t.Fatal("expected submitted surface persistence to run in background")
	}

	var task model.TaskExecution
	if err := db.Where("task_name = ?", "itsm-smart-progress").First(&task).Error; err != nil {
		t.Fatalf("expected smart progress task to be queued without blocking submit response: %v", err)
	}
}

func TestITSMRuntimeContextUsesConfiguredIntakeAgentSession(t *testing.T) {
	db := newTestDB(t)
	userID := uint(7)
	intake := ai.Agent{Name: "无 Code 服务受理岗", Type: ai.AgentTypeAssistant, IsActive: true, Visibility: "private", CreatedBy: 1}
	otherCode := "itsm.servicedesk"
	other := ai.Agent{Name: "默认服务台预设", Code: &otherCode, Type: ai.AgentTypeAssistant, IsActive: true, Visibility: "private", CreatedBy: 1}
	if err := db.Create(&intake).Error; err != nil {
		t.Fatalf("create intake agent: %v", err)
	}
	if err := db.Create(&other).Error; err != nil {
		t.Fatalf("create other agent: %v", err)
	}
	configureIntakeAgent(t, db, intake.ID)

	intakeSession := ai.AgentSession{AgentID: intake.ID, UserID: userID, Status: "running"}
	otherSession := ai.AgentSession{AgentID: other.ID, UserID: userID, Status: "running"}
	if err := db.Create(&intakeSession).Error; err != nil {
		t.Fatalf("create intake session: %v", err)
	}
	if err := db.Create(&otherSession).Error; err != nil {
		t.Fatalf("create other session: %v", err)
	}
	store := tools.NewSessionStateStore(db)
	if err := store.SaveState(intakeSession.ID, &tools.ServiceDeskState{
		Stage:           "service_loaded",
		LoadedServiceID: 42,
		RequestText:     "我要提交 VPN 申请",
	}); err != nil {
		t.Fatalf("save intake state: %v", err)
	}
	if err := store.SaveState(otherSession.ID, &tools.ServiceDeskState{
		Stage:           "service_loaded",
		LoadedServiceID: 99,
	}); err != nil {
		t.Fatalf("save other state: %v", err)
	}

	injector := do.New()
	do.ProvideValue(injector, &database.DB{DB: db})
	do.ProvideValue(injector, newEngineConfigServiceOnly(t, db))
	do.ProvideValue(injector, store)
	app := &ITSMApp{injector: injector}

	block, err := app.BuildAgentRuntimeContext(context.Background(), "", intakeSession.ID, userID)
	if err != nil {
		t.Fatalf("build runtime context: %v", err)
	}
	if !strings.Contains(block, "ITSM Service Desk Runtime Context") || !strings.Contains(block, `"loaded_service_id": 42`) {
		t.Fatalf("expected runtime context for configured intake session, got %q", block)
	}

	block, err = app.BuildAgentRuntimeContext(context.Background(), otherCode, otherSession.ID, userID)
	if err != nil {
		t.Fatalf("build runtime context for other session: %v", err)
	}
	if block != "" {
		t.Fatalf("expected empty context for non-configured session, got %q", block)
	}
}
