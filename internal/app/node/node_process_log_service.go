package node

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/samber/do/v2"
)

const logRetentionDays = 7

type NodeProcessLogService struct {
	logRepo        *NodeProcessLogRepo
	nodeProcessRepo *NodeProcessRepo
}

func NewNodeProcessLogService(i do.Injector) (*NodeProcessLogService, error) {
	return &NodeProcessLogService{
		logRepo:        do.MustInvoke[*NodeProcessLogRepo](i),
		nodeProcessRepo: do.MustInvoke[*NodeProcessRepo](i),
	}, nil
}

type UploadLogEntry struct {
	ProcessName string `json:"processName"`
	Stream      string `json:"stream"`
	Content     string `json:"content"`
}

func (s *NodeProcessLogService) Ingest(nodeID uint, entries []UploadLogEntry) error {
	now := time.Now()
	logs := make([]NodeProcessLog, 0, len(entries))
	for _, e := range entries {
		logs = append(logs, NodeProcessLog{
			NodeID:      nodeID,
			ProcessName: e.ProcessName,
			Stream:      e.Stream,
			Content:     e.Content,
			Timestamp:   now,
		})
	}
	return s.logRepo.CreateBatch(logs)
}

func (s *NodeProcessLogService) List(params LogListParams) (*LogListResult, error) {
	return s.logRepo.List(params)
}

func (s *NodeProcessLogService) CleanupOldLogs(_ context.Context, _ json.RawMessage) error {
	cutoff := time.Now().AddDate(0, 0, -logRetentionDays)
	affected, err := s.logRepo.DeleteBefore(cutoff)
	if err != nil {
		return err
	}
	if affected > 0 {
		slog.Info("node process log cleanup", "deleted", affected)
	}
	return nil
}
