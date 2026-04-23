package itsm

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"metis/internal/app/ai"
	"metis/internal/database"
	"metis/internal/model"
	"metis/internal/repository"
)

const (
	smartTicketIntakeAgentKey      = "itsm.smart_ticket.intake.agent_id"
	smartTicketDecisionAgentKey    = "itsm.smart_ticket.decision.agent_id"
	smartTicketDecisionModeKey     = "itsm.smart_ticket.decision.mode"
	smartTicketPathMaxRetriesKey   = "itsm.smart_ticket.path.max_retries"
	smartTicketPathTimeoutKey      = "itsm.smart_ticket.path.timeout_seconds"
	smartTicketGuardAuditLevelKey  = "itsm.smart_ticket.guard.audit_level"
	smartTicketGuardFallbackKey    = "itsm.smart_ticket.guard.fallback_assignee"
	smartTicketPathBuilderAgentKey = "itsm.path_builder"
)

var (
	ErrEngineNotConfigured  = errors.New("智能工单引擎未配置，请前往引擎配置页面设置")
	ErrModelNotFound        = errors.New("模型不存在或已停用")
	ErrAgentNotFound        = errors.New("智能体不存在或已停用")
	ErrFallbackUserNotFound = errors.New("兜底处理人不存在或已停用")
	ErrInvalidEngineConfig  = errors.New("智能工单引擎配置无效")
)

// EngineConfigService manages ITSM smart ticket engine configuration.
type EngineConfigService struct {
	agentSvc      *ai.AgentService
	modelRepo     *ai.ModelRepo
	sysConfigRepo *repository.SysConfigRepo
	db            *gorm.DB
}

func NewEngineConfigService(i do.Injector) (*EngineConfigService, error) {
	db := do.MustInvoke[*database.DB](i)
	return &EngineConfigService{
		agentSvc:      do.MustInvoke[*ai.AgentService](i),
		modelRepo:     do.MustInvoke[*ai.ModelRepo](i),
		sysConfigRepo: do.MustInvoke[*repository.SysConfigRepo](i),
		db:            db.DB,
	}, nil
}

type EngineConfig struct {
	Intake   EngineAgentSelector  `json:"intake"`
	Decision EngineDecisionConfig `json:"decision"`
	Path     EnginePathConfig     `json:"path"`
	Guard    EngineGuardConfig    `json:"guard"`
	Health   EngineHealth         `json:"health"`
}

type EngineAgentSelector struct {
	AgentID   uint   `json:"agentId"`
	AgentName string `json:"agentName"`
}

type EngineDecisionConfig struct {
	EngineAgentSelector
	Mode string `json:"mode"`
}

type EnginePathConfig struct {
	ModelID        uint    `json:"modelId"`
	ProviderID     uint    `json:"providerId"`
	ProviderName   string  `json:"providerName"`
	ModelName      string  `json:"modelName"`
	Temperature    float64 `json:"temperature"`
	MaxRetries     int     `json:"maxRetries"`
	TimeoutSeconds int     `json:"timeoutSeconds"`
}

type EngineGuardConfig struct {
	AuditLevel       string `json:"auditLevel"`
	FallbackAssignee uint   `json:"fallbackAssignee"`
}

type EngineHealth struct {
	Items []EngineHealthItem `json:"items"`
}

type EngineHealthItem struct {
	Key     string `json:"key"`
	Label   string `json:"label"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

type UpdateConfigRequest struct {
	Intake struct {
		AgentID uint `json:"agentId"`
	} `json:"intake"`
	Decision struct {
		AgentID uint   `json:"agentId"`
		Mode    string `json:"mode"`
	} `json:"decision"`
	Path struct {
		ModelID        uint    `json:"modelId"`
		Temperature    float64 `json:"temperature"`
		MaxRetries     int     `json:"maxRetries"`
		TimeoutSeconds int     `json:"timeoutSeconds"`
	} `json:"path"`
	Guard struct {
		AuditLevel       string `json:"auditLevel"`
		FallbackAssignee uint   `json:"fallbackAssignee"`
	} `json:"guard"`
}

func (s *EngineConfigService) GetConfig() (*EngineConfig, error) {
	cfg := &EngineConfig{
		Intake: s.readAgentSelector(smartTicketIntakeAgentKey),
		Decision: EngineDecisionConfig{
			EngineAgentSelector: s.readAgentSelector(smartTicketDecisionAgentKey),
			Mode:                s.DecisionMode(),
		},
		Path:  s.readPathConfig(),
		Guard: s.readGuardConfig(),
	}
	cfg.Health = s.buildHealth(cfg)
	return cfg, nil
}

func (s *EngineConfigService) UpdateConfig(req *UpdateConfigRequest) error {
	if req.Intake.AgentID > 0 {
		if err := s.validateActiveAgent(req.Intake.AgentID); err != nil {
			return err
		}
	}
	if req.Decision.AgentID > 0 {
		if err := s.validateActiveAgent(req.Decision.AgentID); err != nil {
			return err
		}
	}
	if req.Path.ModelID > 0 {
		if _, err := s.modelRepo.FindByID(req.Path.ModelID); err != nil {
			return ErrModelNotFound
		}
	}
	if err := validateDecisionMode(req.Decision.Mode); err != nil {
		return err
	}
	if err := validateAuditLevel(req.Guard.AuditLevel); err != nil {
		return err
	}
	if req.Path.Temperature < 0 || req.Path.Temperature > 1 {
		return fmt.Errorf("%w: 路径引擎温度必须在 0 到 1 之间", ErrInvalidEngineConfig)
	}
	if req.Path.MaxRetries < 0 || req.Path.MaxRetries > 10 {
		return fmt.Errorf("%w: 路径引擎最大重试次数必须在 0 到 10 之间", ErrInvalidEngineConfig)
	}
	if req.Path.TimeoutSeconds < 10 || req.Path.TimeoutSeconds > 300 {
		return fmt.Errorf("%w: 路径引擎超时时间必须在 10 到 300 秒之间", ErrInvalidEngineConfig)
	}
	if req.Guard.FallbackAssignee > 0 {
		if err := s.validateFallbackAssignee(req.Guard.FallbackAssignee); err != nil {
			return err
		}
	}

	if err := s.updatePathBuilderAgent(req.Path.ModelID, req.Path.Temperature); err != nil {
		return err
	}

	s.setConfigValue(smartTicketIntakeAgentKey, strconv.FormatUint(uint64(req.Intake.AgentID), 10))
	s.setConfigValue(smartTicketDecisionAgentKey, strconv.FormatUint(uint64(req.Decision.AgentID), 10))
	s.setConfigValue(smartTicketDecisionModeKey, req.Decision.Mode)
	s.setConfigValue(smartTicketPathMaxRetriesKey, strconv.Itoa(req.Path.MaxRetries))
	s.setConfigValue(smartTicketPathTimeoutKey, strconv.Itoa(req.Path.TimeoutSeconds))
	s.setConfigValue(smartTicketGuardAuditLevelKey, req.Guard.AuditLevel)
	s.setConfigValue(smartTicketGuardFallbackKey, strconv.FormatUint(uint64(req.Guard.FallbackAssignee), 10))

	return nil
}

func (s *EngineConfigService) readPathConfig() EnginePathConfig {
	cfg := EnginePathConfig{
		MaxRetries:     s.getConfigInt(smartTicketPathMaxRetriesKey, 3),
		TimeoutSeconds: s.getConfigInt(smartTicketPathTimeoutKey, 120),
	}

	agent, err := s.agentSvc.GetByCode(smartTicketPathBuilderAgentKey)
	if err != nil {
		return cfg
	}
	cfg.Temperature = agent.Temperature
	if agent.ModelID == nil || *agent.ModelID == 0 {
		return cfg
	}
	cfg.ModelID = *agent.ModelID
	m, err := s.modelRepo.FindByID(*agent.ModelID)
	if err != nil {
		return cfg
	}
	cfg.ModelName = m.DisplayName
	cfg.ProviderID = m.ProviderID
	if m.Provider != nil {
		cfg.ProviderName = m.Provider.Name
	}
	return cfg
}

func (s *EngineConfigService) readGuardConfig() EngineGuardConfig {
	return EngineGuardConfig{
		AuditLevel:       s.getConfigValue(smartTicketGuardAuditLevelKey, "full"),
		FallbackAssignee: uint(s.getConfigInt(smartTicketGuardFallbackKey, 0)),
	}
}

func (s *EngineConfigService) readAgentSelector(configKey string) EngineAgentSelector {
	agentID := uint(s.getConfigInt(configKey, 0))
	if agentID == 0 {
		return EngineAgentSelector{}
	}
	agent, err := s.agentSvc.Get(agentID)
	if err != nil {
		return EngineAgentSelector{AgentID: agentID}
	}
	return EngineAgentSelector{AgentID: agent.ID, AgentName: agent.Name}
}

func (s *EngineConfigService) validateActiveAgent(agentID uint) error {
	agent, err := s.agentSvc.Get(agentID)
	if err != nil {
		return ErrAgentNotFound
	}
	if !agent.IsActive {
		return ErrAgentNotFound
	}
	return nil
}

func (s *EngineConfigService) validateFallbackAssignee(userID uint) error {
	var user struct{ IsActive bool }
	if err := s.db.Table("users").Where("id = ? AND deleted_at IS NULL", userID).
		Select("is_active").First(&user).Error; err != nil {
		return ErrFallbackUserNotFound
	}
	if !user.IsActive {
		return ErrFallbackUserNotFound
	}
	return nil
}

func (s *EngineConfigService) updatePathBuilderAgent(modelID uint, temperature float64) error {
	agent, err := s.agentSvc.GetByCode(smartTicketPathBuilderAgentKey)
	if err != nil {
		return err
	}
	if modelID > 0 {
		agent.ModelID = &modelID
	} else {
		agent.ModelID = nil
	}
	agent.Temperature = temperature
	return s.agentSvc.Update(agent)
}

func (s *EngineConfigService) getConfigValue(key, defaultVal string) string {
	cfg, err := s.sysConfigRepo.Get(key)
	if err != nil {
		return defaultVal
	}
	if cfg.Value == "" {
		return defaultVal
	}
	return cfg.Value
}

func (s *EngineConfigService) getConfigInt(key string, defaultVal int) int {
	v := s.getConfigValue(key, "")
	if v == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return defaultVal
	}
	return n
}

func (s *EngineConfigService) setConfigValue(key, value string) {
	cfg, err := s.sysConfigRepo.Get(key)
	if err != nil {
		cfg = &model.SystemConfig{Key: key}
	}
	cfg.Value = value
	_ = s.sysConfigRepo.Set(cfg)
}

func (s *EngineConfigService) buildHealth(cfg *EngineConfig) EngineHealth {
	items := []EngineHealthItem{
		s.agentHealth("intake", "受理引擎", cfg.Intake.AgentID, []string{
			"itsm.service_match",
			"itsm.service_load",
			"itsm.draft_prepare",
			"itsm.draft_confirm",
			"itsm.validate_participants",
			"itsm.ticket_create",
		}),
		s.agentHealth("decision", "决策引擎", cfg.Decision.AgentID, []string{
			"decision.ticket_context",
			"decision.resolve_participant",
			"decision.list_actions",
			"decision.execute_action",
		}),
		s.pathHealth(cfg.Path),
		s.guardHealth(cfg.Guard),
	}
	return EngineHealth{Items: items}
}

func (s *EngineConfigService) agentHealth(key, label string, agentID uint, requiredTools []string) EngineHealthItem {
	if agentID == 0 {
		return EngineHealthItem{Key: key, Label: label, Status: "fail", Message: label + "未绑定智能体"}
	}
	agent, err := s.agentSvc.Get(agentID)
	if err != nil || !agent.IsActive {
		return EngineHealthItem{Key: key, Label: label, Status: "fail", Message: label + "绑定的智能体不存在或未启用"}
	}
	if agent.ModelID == nil || *agent.ModelID == 0 {
		return EngineHealthItem{Key: key, Label: label, Status: "fail", Message: label + "绑定的智能体未配置模型"}
	}
	if missing := s.missingAgentTools(agentID, requiredTools); len(missing) > 0 {
		return EngineHealthItem{Key: key, Label: label, Status: "fail", Message: label + "缺少必需工具：" + missing[0]}
	}
	return EngineHealthItem{Key: key, Label: label, Status: "pass", Message: label + "已就绪"}
}

func (s *EngineConfigService) pathHealth(path EnginePathConfig) EngineHealthItem {
	if path.ModelID == 0 {
		return EngineHealthItem{Key: "path", Label: "路径引擎", Status: "fail", Message: "路径引擎未配置模型"}
	}
	if path.MaxRetries < 0 || path.TimeoutSeconds <= 0 {
		return EngineHealthItem{Key: "path", Label: "路径引擎", Status: "fail", Message: "路径引擎运行参数无效"}
	}
	return EngineHealthItem{Key: "path", Label: "路径引擎", Status: "pass", Message: "路径引擎已就绪"}
}

func (s *EngineConfigService) guardHealth(guard EngineGuardConfig) EngineHealthItem {
	if guard.FallbackAssignee == 0 {
		return EngineHealthItem{Key: "guard", Label: "运行保障", Status: "warn", Message: "未指定兜底处理人，异常时只能进入人工处置队列"}
	}
	if err := s.validateFallbackAssignee(guard.FallbackAssignee); err != nil {
		return EngineHealthItem{Key: "guard", Label: "运行保障", Status: "fail", Message: "兜底处理人不存在或未启用"}
	}
	return EngineHealthItem{Key: "guard", Label: "运行保障", Status: "pass", Message: "运行保障已就绪"}
}

func (s *EngineConfigService) missingAgentTools(agentID uint, required []string) []string {
	if len(required) == 0 {
		return nil
	}
	var rows []struct{ Name string }
	if err := s.db.Table("ai_tools").
		Select("ai_tools.name").
		Joins("JOIN ai_agent_tools ON ai_agent_tools.tool_id = ai_tools.id").
		Where("ai_agent_tools.agent_id = ? AND ai_tools.name IN ? AND ai_tools.is_active = ?", agentID, required, true).
		Find(&rows).Error; err != nil {
		return required
	}
	have := map[string]bool{}
	for _, row := range rows {
		have[row.Name] = true
	}
	var missing []string
	for _, name := range required {
		if !have[name] {
			missing = append(missing, name)
		}
	}
	return missing
}

func validateDecisionMode(mode string) error {
	switch mode {
	case "direct_first", "ai_only":
		return nil
	default:
		return fmt.Errorf("%w: 决策引擎模式无效", ErrInvalidEngineConfig)
	}
}

func validateAuditLevel(level string) error {
	switch level {
	case "full", "summary", "off":
		return nil
	default:
		return fmt.Errorf("%w: 审计级别无效", ErrInvalidEngineConfig)
	}
}

func (s *EngineConfigService) FallbackAssigneeID() uint {
	return uint(s.getConfigInt(smartTicketGuardFallbackKey, 0))
}

func (s *EngineConfigService) DecisionMode() string {
	return s.getConfigValue(smartTicketDecisionModeKey, "direct_first")
}

func (s *EngineConfigService) DecisionAgentID() uint {
	return uint(s.getConfigInt(smartTicketDecisionAgentKey, 0))
}

func (s *EngineConfigService) IntakeAgentID() uint {
	return uint(s.getConfigInt(smartTicketIntakeAgentKey, 0))
}

func (s *EngineConfigService) AuditLevel() string {
	return s.getConfigValue(smartTicketGuardAuditLevelKey, "full")
}
