package itsm

import (
	"strconv"
	"testing"

	"github.com/samber/do/v2"

	aiapp "metis/internal/app/ai"
	"metis/internal/app/itsm/tools"
	"metis/internal/database"
	coremodel "metis/internal/model"
	"metis/internal/repository"
)

func newEngineConfigTestService(t *testing.T) (*EngineConfigService, *database.DB) {
	t.Helper()
	db := newSeedAlignmentDB(t)
	if err := tools.SeedTools(db); err != nil {
		t.Fatalf("seed tools: %v", err)
	}
	if err := tools.SeedAgents(db); err != nil {
		t.Fatalf("seed agents: %v", err)
	}
	if err := seedEngineConfig(db); err != nil {
		t.Fatalf("seed engine config: %v", err)
	}

	injector := do.New()
	do.ProvideValue(injector, &database.DB{DB: db})
	do.Provide(injector, repository.NewSysConfig)
	do.Provide(injector, aiapp.NewAgentRepo)
	do.Provide(injector, aiapp.NewAgentService)
	do.Provide(injector, aiapp.NewModelRepo)
	do.Provide(injector, NewEngineConfigService)
	return do.MustInvoke[*EngineConfigService](injector), &database.DB{DB: db}
}

func TestEngineConfigServiceReadsAndUpdatesSmartTicketConfig(t *testing.T) {
	svc, db := newEngineConfigTestService(t)

	provider := aiapp.Provider{
		Name:     "OpenAI",
		Type:     aiapp.ProviderTypeOpenAI,
		Protocol: "openai",
		BaseURL:  "https://example.test",
		Status:   aiapp.ProviderStatusActive,
	}
	if err := db.Create(&provider).Error; err != nil {
		t.Fatalf("create provider: %v", err)
	}
	model := aiapp.AIModel{
		ProviderID:  provider.ID,
		ModelID:     "gpt-test",
		DisplayName: "GPT Test",
		Type:        aiapp.ModelTypeLLM,
		Status:      aiapp.ModelStatusActive,
	}
	if err := db.Create(&model).Error; err != nil {
		t.Fatalf("create model: %v", err)
	}

	var intakeAgent aiapp.Agent
	if err := db.Where("code = ?", "itsm.servicedesk").First(&intakeAgent).Error; err != nil {
		t.Fatalf("load intake agent: %v", err)
	}
	var decisionAgent aiapp.Agent
	if err := db.Where("code = ?", "itsm.decision").First(&decisionAgent).Error; err != nil {
		t.Fatalf("load decision agent: %v", err)
	}
	if err := db.Model(&aiapp.Agent{}).Where("id IN ?", []uint{intakeAgent.ID, decisionAgent.ID}).Update("model_id", model.ID).Error; err != nil {
		t.Fatalf("bind engine agent models: %v", err)
	}

	fallback := coremodel.User{Username: "fallback", IsActive: true}
	if err := db.Create(&fallback).Error; err != nil {
		t.Fatalf("create fallback user: %v", err)
	}

	var req UpdateConfigRequest
	req.Intake.AgentID = intakeAgent.ID
	req.Decision.AgentID = decisionAgent.ID
	req.Decision.Mode = "ai_only"
	req.Path.ModelID = model.ID
	req.Path.Temperature = 0.25
	req.Path.MaxRetries = 4
	req.Path.TimeoutSeconds = 90
	req.Guard.AuditLevel = "summary"
	req.Guard.FallbackAssignee = fallback.ID
	if err := svc.UpdateConfig(&req); err != nil {
		t.Fatalf("update config: %v", err)
	}

	got, err := svc.GetConfig()
	if err != nil {
		t.Fatalf("get config: %v", err)
	}
	if got.Intake.AgentID != intakeAgent.ID || got.Decision.AgentID != decisionAgent.ID || got.Decision.Mode != "ai_only" {
		t.Fatalf("unexpected engine agents: %+v", got)
	}
	if got.Path.ModelID != model.ID || got.Path.ProviderID != provider.ID || got.Path.MaxRetries != 4 || got.Path.TimeoutSeconds != 90 {
		t.Fatalf("unexpected path config: %+v", got.Path)
	}
	if got.Guard.AuditLevel != "summary" || got.Guard.FallbackAssignee != fallback.ID {
		t.Fatalf("unexpected guard config: %+v", got.Guard)
	}

	expectedKeys := map[string]string{
		smartTicketIntakeAgentKey:     strconv.FormatUint(uint64(intakeAgent.ID), 10),
		smartTicketDecisionAgentKey:   strconv.FormatUint(uint64(decisionAgent.ID), 10),
		smartTicketDecisionModeKey:    "ai_only",
		smartTicketPathMaxRetriesKey:  "4",
		smartTicketPathTimeoutKey:     "90",
		smartTicketGuardAuditLevelKey: "summary",
		smartTicketGuardFallbackKey:   strconv.FormatUint(uint64(fallback.ID), 10),
	}
	for key, value := range expectedKeys {
		var cfg coremodel.SystemConfig
		if err := db.Where("\"key\" = ?", key).First(&cfg).Error; err != nil {
			t.Fatalf("load system config %s: %v", key, err)
		}
		if cfg.Value != value {
			t.Fatalf("expected %s=%s, got %s", key, value, cfg.Value)
		}
	}
}

func TestEngineConfigServiceRejectsInvalidFallbackAssignee(t *testing.T) {
	svc, _ := newEngineConfigTestService(t)
	var req UpdateConfigRequest
	req.Decision.Mode = "direct_first"
	req.Path.MaxRetries = 3
	req.Path.TimeoutSeconds = 120
	req.Guard.AuditLevel = "full"
	req.Guard.FallbackAssignee = 999
	if err := svc.UpdateConfig(&req); err != ErrFallbackUserNotFound {
		t.Fatalf("expected ErrFallbackUserNotFound, got %v", err)
	}
}
