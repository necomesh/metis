package engine

import (
	"context"
	"encoding/json"
	"log/slog"
	"strconv"
	"time"

	"gorm.io/gorm"
)

// SLA status constants (mirror itsm package constants for engine-internal use).
const (
	slaOnTrack          = "on_track"
	slaBreachedResponse = "breached_response"
	slaBreachedResolve  = "breached_resolution"
)

// escalationRuleModel is the engine-internal projection of itsm_escalation_rules.
type escalationRuleModel struct {
	ID           uint   `gorm:"primaryKey"`
	SLAID        uint   `gorm:"column:sla_id"`
	TriggerType  string `gorm:"column:trigger_type"`
	Level        int    `gorm:"column:level"`
	WaitMinutes  int    `gorm:"column:wait_minutes"`
	ActionType   string `gorm:"column:action_type"`
	TargetConfig string `gorm:"column:target_config;type:text"`
	IsActive     bool   `gorm:"column:is_active"`
}

func (escalationRuleModel) TableName() string { return "itsm_escalation_rules" }

// SLAAssuranceConfigProvider exposes the configured SLA assurance post.
type SLAAssuranceConfigProvider interface {
	SLAAssuranceAgentID() uint
}

// HandleSLACheck is the cron task handler for itsm-sla-check.
// It scans active tickets with SLA deadlines, detects breaches,
// updates sla_status, and executes escalation rules.
func HandleSLACheck(db *gorm.DB, configProvider SLAAssuranceConfigProvider) func(ctx context.Context, payload json.RawMessage) error {
	return func(ctx context.Context, _ json.RawMessage) error {
		now := time.Now()

		// Find active tickets with SLA deadlines. Tickets already marked as response-breached
		// still need to be checked for resolution breach.
		var tickets []ticketModel
		err := db.Where("status IN ? AND sla_paused_at IS NULL AND "+
			"(sla_response_deadline IS NOT NULL OR sla_resolution_deadline IS NOT NULL)",
			[]string{"pending", "in_progress", "waiting_action"},
		).Find(&tickets).Error
		if err != nil {
			slog.Error("sla-check: failed to query tickets", "error", err)
			return err
		}

		if len(tickets) == 0 {
			return nil
		}

		slog.Info("sla-check: scanning tickets", "count", len(tickets))

		for i := range tickets {
			t := &tickets[i]
			checkTicketSLA(db, t, now, configProvider)
		}

		return nil
	}
}

// checkTicketSLA checks a single ticket for SLA breaches and executes escalation.
func checkTicketSLA(db *gorm.DB, t *ticketModel, now time.Time, configProvider SLAAssuranceConfigProvider) {
	if t.SLAResponseDeadline != nil && now.After(*t.SLAResponseDeadline) {
		if t.SLAStatus != slaBreachedResponse && t.SLAStatus != slaBreachedResolve {
			db.Model(&ticketModel{}).Where("id = ?", t.ID).Update("sla_status", slaBreachedResponse)
			t.SLAStatus = slaBreachedResponse
			slog.Warn("sla-check: response SLA breached", "ticketID", t.ID, "code", t.Code,
				"deadline", t.SLAResponseDeadline.Format(time.RFC3339))
			executeEscalation(db, t, "response_timeout", now, configProvider)
		}
	}

	if t.SLAResolutionDeadline != nil && now.After(*t.SLAResolutionDeadline) {
		if t.SLAStatus != slaBreachedResolve {
			db.Model(&ticketModel{}).Where("id = ?", t.ID).Update("sla_status", slaBreachedResolve)
			t.SLAStatus = slaBreachedResolve
			slog.Warn("sla-check: resolution SLA breached", "ticketID", t.ID, "code", t.Code,
				"deadline", t.SLAResolutionDeadline.Format(time.RFC3339))
			executeEscalation(db, t, "resolution_timeout", now, configProvider)
		}
	}
}

// executeEscalation loads and executes matching escalation rules for a ticket's SLA breach.
func executeEscalation(db *gorm.DB, t *ticketModel, triggerType string, now time.Time, configProvider SLAAssuranceConfigProvider) {
	slaID, ok := loadTicketSLAID(db, t.ID)
	if !ok {
		slog.Warn("sla-check: ticket has no SLA template, skipping escalation", "ticketID", t.ID)
		return
	}

	var rules []escalationRuleModel
	err := db.Where("sla_id = ? AND trigger_type = ? AND is_active = ?", slaID, triggerType, true).
		Order("level ASC").
		Find(&rules).Error
	if err != nil {
		slog.Error("sla-check: failed to load escalation rules", "error", err, "ticketID", t.ID)
		return
	}

	var deadline *time.Time
	if triggerType == "response_timeout" {
		deadline = t.SLAResponseDeadline
	} else {
		deadline = t.SLAResolutionDeadline
	}
	if deadline == nil {
		return
	}

	for _, rule := range rules {
		// Check if enough time has passed since breach for this escalation level
		triggerTime := deadline.Add(time.Duration(rule.WaitMinutes) * time.Minute)
		if now.Before(triggerTime) {
			continue // not yet time for this escalation level
		}
		if escalationAlreadyRecorded(db, t.ID, rule.ID) {
			continue
		}

		agentID := uint(0)
		if configProvider != nil {
			agentID = configProvider.SLAAssuranceAgentID()
		}
		if agentID == 0 {
			recordEscalationPending(db, t, &rule, triggerType)
			continue
		}
		agentName := loadAgentName(db, agentID)
		executeEscalationAction(db, t, &rule, triggerType, agentID, agentName)
	}
}

func loadTicketSLAID(db *gorm.DB, ticketID uint) (uint, bool) {
	var row struct{ SLAID *uint }
	if err := db.Table("itsm_tickets").
		Select("itsm_service_definitions.sla_id").
		Joins("JOIN itsm_service_definitions ON itsm_service_definitions.id = itsm_tickets.service_id").
		Where("itsm_tickets.id = ?", ticketID).
		Scan(&row).Error; err != nil || row.SLAID == nil || *row.SLAID == 0 {
		return 0, false
	}
	return *row.SLAID, true
}

func loadAgentName(db *gorm.DB, agentID uint) string {
	var row struct{ Name string }
	if err := db.Table("ai_agents").Where("id = ? AND is_active = ?", agentID, true).Select("name").First(&row).Error; err != nil {
		return "SLA 保障岗"
	}
	return row.Name
}

func escalationAlreadyRecorded(db *gorm.DB, ticketID, ruleID uint) bool {
	var count int64
	pattern := "%\"rule_id\":" + strconv.FormatUint(uint64(ruleID), 10) + "%"
	db.Table("itsm_ticket_timelines").
		Where("ticket_id = ? AND event_type IN ? AND details LIKE ?",
			ticketID,
			[]string{"sla_escalation", "sla_assurance_pending"},
			pattern,
		).Count(&count)
	return count > 0
}

// escalationTargetConfig holds parsed target_config JSON for escalation rules.
type escalationTargetConfig struct {
	UserIDs    []uint `json:"user_ids,omitempty"`
	PriorityID *uint  `json:"priority_id,omitempty"`
}

// executeEscalationAction executes a single escalation rule action.
func executeEscalationAction(db *gorm.DB, t *ticketModel, rule *escalationRuleModel, triggerType string, agentID uint, agentName string) {
	var config escalationTargetConfig
	if rule.TargetConfig != "" {
		json.Unmarshal([]byte(rule.TargetConfig), &config)
	}
	details := escalationTimelineDetails(rule, triggerType, agentID, agentName)
	reasoning := "SLA 保障岗按已配置规则触发升级动作；超时事实由系统计时器判定。"

	switch rule.ActionType {
	case "notify":
		// Record timeline event for notification
		slog.Info("sla-check: escalation notify", "ticketID", t.ID, "level", rule.Level, "targetUsers", config.UserIDs)
		db.Create(&timelineModel{
			TicketID:   t.ID,
			OperatorID: 0,
			EventType:  "sla_escalation",
			Message:    "SLA 升级通知已触发",
			Details:    details,
			Reasoning:  reasoning,
		})

	case "reassign":
		if len(config.UserIDs) > 0 {
			newAssignee := config.UserIDs[0]
			db.Model(&ticketModel{}).Where("id = ?", t.ID).Update("assignee_id", newAssignee)
			slog.Info("sla-check: escalation reassign", "ticketID", t.ID, "level", rule.Level, "newAssignee", newAssignee)
			db.Create(&timelineModel{
				TicketID:   t.ID,
				OperatorID: 0,
				EventType:  "sla_escalation",
				Message:    "SLA 升级：工单已转派",
				Details:    details,
				Reasoning:  reasoning,
			})
		}

	case "escalate_priority":
		if config.PriorityID != nil {
			db.Model(&ticketModel{}).Where("id = ?", t.ID).Update("priority_id", *config.PriorityID)
			slog.Info("sla-check: escalation priority", "ticketID", t.ID, "level", rule.Level, "newPriority", *config.PriorityID)
			db.Create(&timelineModel{
				TicketID:   t.ID,
				OperatorID: 0,
				EventType:  "sla_escalation",
				Message:    "SLA 升级：工单优先级已提升",
				Details:    details,
				Reasoning:  reasoning,
			})
		}

	default:
		slog.Warn("sla-check: unknown escalation action", "actionType", rule.ActionType, "ticketID", t.ID)
	}
}

func recordEscalationPending(db *gorm.DB, t *ticketModel, rule *escalationRuleModel, triggerType string) {
	db.Create(&timelineModel{
		TicketID:   t.ID,
		OperatorID: 0,
		EventType:  "sla_assurance_pending",
		Message:    "SLA 保障岗未上岗，升级动作待人工处理",
		Details:    escalationTimelineDetails(rule, triggerType, 0, ""),
		Reasoning:  "系统计时器已判定 SLA 超时，但 SLA 保障岗未绑定智能体，未自动触发升级动作。",
	})
}

func escalationTimelineDetails(rule *escalationRuleModel, triggerType string, agentID uint, agentName string) string {
	payload := map[string]any{
		"rule_id":      rule.ID,
		"sla_id":       rule.SLAID,
		"trigger_type": triggerType,
		"level":        rule.Level,
		"action_type":  rule.ActionType,
		"agent_id":     agentID,
		"agent_name":   agentName,
	}
	raw, _ := json.Marshal(payload)
	return string(raw)
}
