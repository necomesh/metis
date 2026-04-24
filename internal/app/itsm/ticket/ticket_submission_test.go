package ticket

import (
	"context"
	"encoding/json"
	. "metis/internal/app/itsm/definition"
	. "metis/internal/app/itsm/domain"
	. "metis/internal/app/itsm/sla"
	"testing"

	appcore "metis/internal/app"
	"metis/internal/app/itsm/engine"
	"metis/internal/app/itsm/testutil"
	"metis/internal/app/itsm/tools"
	"metis/internal/database"
	"metis/internal/model"
	"metis/internal/scheduler"

	"github.com/samber/do/v2"
	"gorm.io/gorm"
)

type submissionTestDecisionExecutor struct{}

func (submissionTestDecisionExecutor) Execute(context.Context, uint, appcore.AIDecisionRequest) (*appcore.AIDecisionResponse, error) {
	return nil, nil
}

func TestCreateFromAgent_IdempotentConfirmedDraftStartsSmartProgressTask(t *testing.T) {
	db := newTestDB(t)
	ticketSvc := newSubmissionTicketService(t, db)
	service := testutil.SeedSmartSubmissionService(t, db)

	req := tools.AgentTicketRequest{
		UserID:       7,
		ServiceID:    service.ID,
		Summary:      "VPN 开通申请",
		FormData:     map[string]any{"vpn_account": "admin@dev.com", "request_kind": "线上支持"},
		SessionID:    99,
		DraftVersion: 3,
		FieldsHash:   "fields-v1",
		RequestHash:  "request-v1",
	}

	first, err := ticketSvc.CreateFromAgent(context.Background(), req)
	if err != nil {
		t.Fatalf("first create from agent: %v", err)
	}
	second, err := ticketSvc.CreateFromAgent(context.Background(), req)
	if err != nil {
		t.Fatalf("second create from agent: %v", err)
	}
	if second.TicketID != first.TicketID || second.TicketCode != first.TicketCode {
		t.Fatalf("expected idempotent ticket result, first=%+v second=%+v", first, second)
	}

	var ticketCount int64
	if err := db.Model(&Ticket{}).Count(&ticketCount).Error; err != nil {
		t.Fatalf("count tickets: %v", err)
	}
	if ticketCount != 1 {
		t.Fatalf("expected one ticket after duplicate submit, got %d", ticketCount)
	}

	var ticket Ticket
	if err := db.First(&ticket, first.TicketID).Error; err != nil {
		t.Fatalf("load ticket: %v", err)
	}
	if ticket.Source != TicketSourceAgent {
		t.Fatalf("expected source=agent, got %q", ticket.Source)
	}
	if ticket.AgentSessionID == nil || *ticket.AgentSessionID != req.SessionID {
		t.Fatalf("expected agent_session_id=%d, got %v", req.SessionID, ticket.AgentSessionID)
	}

	var submissions []ServiceDeskSubmission
	if err := db.Find(&submissions).Error; err != nil {
		t.Fatalf("list submissions: %v", err)
	}
	if len(submissions) != 1 || submissions[0].TicketID != first.TicketID || submissions[0].Status != "submitted" {
		t.Fatalf("unexpected submissions: %+v", submissions)
	}

	var draftTimeline TicketTimeline
	if err := db.Where("ticket_id = ? AND event_type = ?", first.TicketID, "draft_submitted").First(&draftTimeline).Error; err != nil {
		t.Fatalf("load draft_submitted timeline: %v", err)
	}

	var task model.TaskExecution
	if err := db.Where("task_name = ?", "itsm-smart-progress").First(&task).Error; err != nil {
		t.Fatalf("load smart progress task: %v", err)
	}
	var payload engine.SmartProgressPayload
	if err := json.Unmarshal([]byte(task.Payload), &payload); err != nil {
		t.Fatalf("decode task payload: %v", err)
	}
	if payload.TicketID != first.TicketID || payload.TriggerReason != "initial_decision" || payload.CompletedActivityID != nil {
		t.Fatalf("unexpected smart progress payload: %+v", payload)
	}
}

func newSubmissionTicketService(t *testing.T, db *gorm.DB) *TicketService {
	t.Helper()
	wrapped := &database.DB{DB: db}
	resolver := engine.NewParticipantResolver(nil)
	injector := do.New()
	submitter := &submissionTestSubmitter{db: db}
	do.ProvideValue(injector, wrapped)
	do.Provide(injector, NewTicketRepo)
	do.Provide(injector, NewTimelineRepo)
	do.Provide(injector, NewServiceDefRepo)
	do.Provide(injector, NewSLATemplateRepo)
	do.Provide(injector, NewPriorityRepo)
	do.ProvideValue(injector, engine.NewClassicEngine(resolver, nil, nil))
	do.ProvideValue(injector, engine.NewSmartEngine(submissionTestDecisionExecutor{}, nil, nil, resolver, submitter, nil))
	do.Provide(injector, NewTicketService)
	return do.MustInvoke[*TicketService](injector)
}

type submissionTestSubmitter struct {
	db *gorm.DB
}

func (s *submissionTestSubmitter) SubmitTask(name string, payload json.RawMessage) error {
	return s.db.Create(&model.TaskExecution{
		TaskName: name,
		Trigger:  scheduler.TriggerAPI,
		Status:   scheduler.ExecPending,
		Payload:  string(payload),
	}).Error
}

func (s *submissionTestSubmitter) SubmitTaskTx(tx *gorm.DB, name string, payload json.RawMessage) error {
	return tx.Create(&model.TaskExecution{
		TaskName: name,
		Trigger:  scheduler.TriggerAPI,
		Status:   scheduler.ExecPending,
		Payload:  string(payload),
	}).Error
}
