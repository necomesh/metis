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
	var slaAssuranceAgent aiapp.Agent
	if err := db.Where("code = ?", "itsm.sla_assurance").First(&slaAssuranceAgent).Error; err != nil {
		t.Fatalf("load SLA assurance agent: %v", err)
	}
	if err := db.Model(&aiapp.Agent{}).Where("id IN ?", []uint{intakeAgent.ID, decisionAgent.ID, slaAssuranceAgent.ID}).Update("model_id", model.ID).Error; err != nil {
		t.Fatalf("bind staffing agent models: %v", err)
	}

	fallback := coremodel.User{Username: "fallback", IsActive: true}
	if err := db.Create(&fallback).Error; err != nil {
		t.Fatalf("create fallback user: %v", err)
	}

	var req UpdateConfigRequest
	req.Posts.Intake.AgentID = intakeAgent.ID
	req.Posts.Decision.AgentID = decisionAgent.ID
	req.Posts.Decision.Mode = "ai_only"
	req.Posts.SLAAssurance.AgentID = slaAssuranceAgent.ID
	req.Runtime.PathBuilder.ModelID = model.ID
	req.Runtime.PathBuilder.Temperature = 0.25
	req.Runtime.PathBuilder.MaxRetries = 4
	req.Runtime.PathBuilder.TimeoutSeconds = 90
	req.Runtime.Guard.AuditLevel = "summary"
	req.Runtime.Guard.FallbackAssignee = fallback.ID
	if err := svc.UpdateConfig(&req); err != nil {
		t.Fatalf("update config: %v", err)
	}

	got, err := svc.GetConfig()
	if err != nil {
		t.Fatalf("get config: %v", err)
	}
	if got.Posts.Intake.AgentID != intakeAgent.ID || got.Posts.Decision.AgentID != decisionAgent.ID || got.Posts.Decision.Mode != "ai_only" || got.Posts.SLAAssurance.AgentID != slaAssuranceAgent.ID {
		t.Fatalf("unexpected smart staffing posts: %+v", got)
	}
	if got.Runtime.PathBuilder.ModelID != model.ID || got.Runtime.PathBuilder.ProviderID != provider.ID || got.Runtime.PathBuilder.MaxRetries != 4 || got.Runtime.PathBuilder.TimeoutSeconds != 90 {
		t.Fatalf("unexpected path config: %+v", got.Runtime.PathBuilder)
	}
	if got.Runtime.Guard.AuditLevel != "summary" || got.Runtime.Guard.FallbackAssignee != fallback.ID {
		t.Fatalf("unexpected guard config: %+v", got.Runtime.Guard)
	}

	expectedKeys := map[string]string{
		smartTicketIntakeAgentKey:       strconv.FormatUint(uint64(intakeAgent.ID), 10),
		smartTicketDecisionAgentKey:     strconv.FormatUint(uint64(decisionAgent.ID), 10),
		smartTicketSLAAssuranceAgentKey: strconv.FormatUint(uint64(slaAssuranceAgent.ID), 10),
		smartTicketDecisionModeKey:      "ai_only",
		smartTicketPathMaxRetriesKey:    "4",
		smartTicketPathTimeoutKey:       "90",
		smartTicketGuardAuditLevelKey:   "summary",
		smartTicketGuardFallbackKey:     strconv.FormatUint(uint64(fallback.ID), 10),
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
	req.Posts.Decision.Mode = "direct_first"
	req.Runtime.PathBuilder.MaxRetries = 3
	req.Runtime.PathBuilder.TimeoutSeconds = 120
	req.Runtime.Guard.AuditLevel = "full"
	req.Runtime.Guard.FallbackAssignee = 999
	if err := svc.UpdateConfig(&req); err != ErrFallbackUserNotFound {
		t.Fatalf("expected ErrFallbackUserNotFound, got %v", err)
	}
}
