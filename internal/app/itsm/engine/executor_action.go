package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"strings"
	"time"

	"metis/internal/app/itsm/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ActionExecutor handles HTTP webhook execution for action nodes.
type ActionExecutor struct {
	db     *gorm.DB
	client *http.Client
}

func NewActionExecutor(db *gorm.DB) *ActionExecutor {
	return &ActionExecutor{
		db:     db,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// Execute runs the HTTP webhook for an action task.
func (e *ActionExecutor) Execute(ctx context.Context, ticketID, activityID, actionID uint) error {
	// Load the service action config
	var action serviceActionModel
	if err := e.db.First(&action, actionID).Error; err != nil {
		return fmt.Errorf("action %d not found: %w", actionID, err)
	}

	_, _, err := e.ExecuteWithConfig(ctx, ticketID, activityID, actionID, action.ActionType, action.ConfigJSON)
	return err
}

func (e *ActionExecutor) ExecuteWithConfig(ctx context.Context, ticketID, activityID, actionID uint, actionType, configJSON string) (httpStatus int, responseBody string, err error) {
	normalized, nErr := domain.NormalizeServiceActionConfig(actionType, domain.JSONField(configJSON))
	if nErr != nil {
		return 0, "", fmt.Errorf("invalid action config: %w", nErr)
	}
	var config domain.ServiceActionHTTPConfig
	if uErr := json.Unmarshal(normalized, &config); uErr != nil {
		return 0, "", fmt.Errorf("invalid action config: %w", uErr)
	}

	// Load ticket for template variable substitution
	var ticket ticketModel
	if tErr := e.db.First(&ticket, ticketID).Error; tErr != nil {
		return 0, "", fmt.Errorf("ticket %d not found: %w", ticketID, tErr)
	}

	// Replace template variables in body
	body := replaceTemplateVars(actionConfigBody(config.Body), &ticket)

	// Execute with retry
	var lastErr error
	var lastStatus int
	var lastRespBody string
	for attempt := 0; attempt <= config.Retries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 2^attempt seconds
			backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			select {
			case <-ctx.Done():
				return 0, "", ctx.Err()
			case <-time.After(backoff):
			}
		}

		status, respBody, reqErr := e.doHTTPRequest(ctx, config, body)
		lastStatus = status
		lastRespBody = respBody
		execStatus := "success"
		failureReason := ""
		if reqErr != nil {
			execStatus = "failed"
			failureReason = reqErr.Error()
			lastErr = reqErr
		} else if status < 200 || status >= 300 {
			execStatus = "failed"
			failureReason = fmt.Sprintf("HTTP %d", status)
			lastErr = fmt.Errorf("HTTP %d", status)
		} else {
			lastErr = nil
		}

		// Record execution
		exec := &actionExecutionModel{
			TicketID:        ticketID,
			ActivityID:      activityID,
			ServiceActionID: actionID,
			Status:          execStatus,
			RequestPayload:  body,
			ResponsePayload: respBody,
			FailureReason:   failureReason,
			RetryCount:      attempt,
		}
		e.db.Create(exec)

		if lastErr == nil {
			return lastStatus, lastRespBody, nil
		}

		slog.Warn("action execution failed, retrying",
			"ticketID", ticketID, "actionID", actionID, "attempt", attempt, "error", lastErr)
	}

	return lastStatus, lastRespBody, lastErr
}

func (e *ActionExecutor) doHTTPRequest(ctx context.Context, config domain.ServiceActionHTTPConfig, body string) (int, string, error) {
	client := &http.Client{Timeout: time.Duration(config.Timeout) * time.Second}

	var reqBody io.Reader
	if body != "" {
		reqBody = bytes.NewBufferString(body)
	}

	req, err := http.NewRequestWithContext(ctx, config.Method, config.URL, reqBody)
	if err != nil {
		return 0, "", err
	}

	for k, v := range config.Headers {
		req.Header.Set(k, v)
	}
	if req.Header.Get("Content-Type") == "" && reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := client.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024)) // 64KB limit
	return resp.StatusCode, string(respBytes), nil
}

func replaceTemplateVars(template string, ticket *ticketModel) string {
	if template == "" {
		return ""
	}
	pairs := []string{
		"{{ticket.id}}", fmt.Sprintf("%d", ticket.ID),
		"{{ticket.code}}", ticket.Code,
		"{{ticket.status}}", ticket.Status,
		"{{ticket.requester_id}}", fmt.Sprintf("%d", ticket.RequesterID),
		"{{ticket.priority_id}}", fmt.Sprintf("%d", ticket.PriorityID),
	}

	// Support {{ticket.form_data.<key>}} by parsing FormData JSON.
	if ticket.FormData != "" {
		var formData map[string]any
		if json.Unmarshal([]byte(ticket.FormData), &formData) == nil {
			for k, v := range formData {
				pairs = append(pairs, fmt.Sprintf("{{ticket.form_data.%s}}", k), fmt.Sprint(v))
			}
		}
	}

	return strings.NewReplacer(pairs...).Replace(template)
}

func actionConfigBody(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}
	return string(raw)
}

// --- DB model for action execution records ---

type serviceActionModel struct {
	ID         uint   `gorm:"primaryKey"`
	Name       string `gorm:"column:name"`
	Code       string `gorm:"column:code"`
	ServiceID  uint   `gorm:"column:service_id"`
	IsActive   bool   `gorm:"column:is_active"`
	ActionType string `gorm:"column:action_type"`
	ConfigJSON string `gorm:"column:config_json;type:text"`
}

func (serviceActionModel) TableName() string { return "itsm_service_actions" }

type actionExecutionModel struct {
	ID              uint      `gorm:"primaryKey;autoIncrement"`
	TicketID        uint      `gorm:"column:ticket_id;not null"`
	ActivityID      uint      `gorm:"column:activity_id;not null"`
	ServiceActionID uint      `gorm:"column:service_action_id;not null"`
	Status          string    `gorm:"column:status;size:16;default:pending"`
	RequestPayload  string    `gorm:"column:request_payload;type:text"`
	ResponsePayload string    `gorm:"column:response_payload;type:text"`
	FailureReason   string    `gorm:"column:failure_reason;type:text"`
	RetryCount      int       `gorm:"column:retry_count;default:0"`
	CreatedAt       time.Time `gorm:"column:created_at;autoCreateTime"`
}

func (actionExecutionModel) TableName() string { return "itsm_ticket_action_executions" }

// applyActionOutputMapping reads each mapping entry, extracts the value at the
// dot-notated source path from the JSON response body, and upserts it as a
// process variable for the ticket.  Non-fatal: individual path failures are
// logged and skipped so the rest of the mappings still apply.
func applyActionOutputMapping(db *gorm.DB, ticketID uint, scopeID, responseBody string, mappings []VariableMapping) error {
	if len(mappings) == 0 || responseBody == "" {
		return nil
	}

	var respJSON map[string]any
	if err := json.Unmarshal([]byte(responseBody), &respJSON); err != nil {
		// Response is not JSON — skip mapping silently
		slog.Warn("action output mapping: response is not JSON", "ticketID", ticketID)
		return nil
	}

	for _, m := range mappings {
		if m.Source == "" || m.Target == "" {
			continue
		}
		val, ok := extractJSONPath(respJSON, m.Source)
		if !ok {
			slog.Warn("action output mapping: path not found", "ticketID", ticketID, "path", m.Source)
			continue
		}

		serialized := fmt.Sprint(val)
		valueType := inferValueType(val)

		v := processVariableModel{
			TicketID:  ticketID,
			ScopeID:   scopeID,
			Key:       m.Target,
			Value:     serialized,
			ValueType: valueType,
			Source:    "action:output_mapping",
		}
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "ticket_id"}, {Name: "scope_id"}, {Name: "key"}},
			DoUpdates: clause.AssignmentColumns([]string{"value", "value_type", "source", "updated_at"}),
		}).Create(&v).Error; err != nil {
			return fmt.Errorf("write output variable %q: %w", m.Target, err)
		}
	}
	return nil
}

// extractJSONPath traverses a nested map using a dot-separated path string
// (e.g. "data.user.id") and returns the leaf value.
func extractJSONPath(obj map[string]any, path string) (any, bool) {
	parts := strings.SplitN(path, ".", 2)
	val, ok := obj[parts[0]]
	if !ok {
		return nil, false
	}
	if len(parts) == 1 {
		return val, true
	}
	nested, ok := val.(map[string]any)
	if !ok {
		return nil, false
	}
	return extractJSONPath(nested, parts[1])
}
