package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	appcore "metis/internal/app"
)

type txRecordingSubmitter struct {
	regularCalls int
	txCalls      int
}

func (s *txRecordingSubmitter) SubmitTask(string, json.RawMessage) error {
	s.regularCalls++
	return errors.New("regular submitter must not be used from workflow transaction")
}

func (s *txRecordingSubmitter) SubmitTaskTx(tx *gorm.DB, _ string, _ json.RawMessage) error {
	if tx == nil {
		return errors.New("missing transaction")
	}
	s.txCalls++
	return nil
}

type availableDecisionExecutor struct{}

func (availableDecisionExecutor) Execute(context.Context, uint, appcore.AIDecisionRequest) (*appcore.AIDecisionResponse, error) {
	return nil, errors.New("not used by this test")
}

func TestSmartProgressContinuationUsesWorkflowTransaction(t *testing.T) {
	dsn := fmt.Sprintf("file:smart_continuation_%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&ticketModel{}, &activityModel{}, &timelineModel{}); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	ticket := ticketModel{Status: "in_progress", EngineType: "smart"}
	if err := db.Create(&ticket).Error; err != nil {
		t.Fatalf("create ticket: %v", err)
	}
	activity := activityModel{
		TicketID:     ticket.ID,
		Name:         "审批",
		ActivityType: NodeApprove,
		Status:       ActivityPending,
	}
	if err := db.Create(&activity).Error; err != nil {
		t.Fatalf("create activity: %v", err)
	}

	submitter := &txRecordingSubmitter{}
	eng := NewSmartEngine(availableDecisionExecutor{}, nil, nil, nil, submitter, nil)
	err = db.Transaction(func(tx *gorm.DB) error {
		return eng.Progress(context.Background(), tx, ProgressParams{
			TicketID:   ticket.ID,
			ActivityID: activity.ID,
			Outcome:    "approved",
			OperatorID: 1,
		})
	})
	if err != nil {
		t.Fatalf("progress smart activity: %v", err)
	}
	if submitter.regularCalls != 0 {
		t.Fatalf("expected no regular submit calls, got %d", submitter.regularCalls)
	}
	if submitter.txCalls != 1 {
		t.Fatalf("expected one transaction submit call, got %d", submitter.txCalls)
	}
}
