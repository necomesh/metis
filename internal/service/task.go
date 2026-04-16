package service

import (
	"context"

	"github.com/samber/do/v2"

	"metis/internal/model"
	"metis/internal/scheduler"
)

// TaskService mediates task management operations between handlers and the scheduler.
type TaskService struct {
	store  scheduler.Store
	engine *scheduler.Engine
}

// NewTask creates a TaskService from the IOC container.
func NewTask(i do.Injector) (*TaskService, error) {
	engine := do.MustInvoke[*scheduler.Engine](i)
	return &TaskService{
		store:  engine.GetStore(),
		engine: engine,
	}, nil
}

// ListTasks returns task states with last execution summaries, filtered by type.
func (s *TaskService) ListTasks(ctx context.Context, taskType string) ([]scheduler.TaskInfo, error) {
	states, err := s.store.ListTaskStates(ctx, taskType)
	if err != nil {
		return nil, err
	}

	registry := s.engine.GetRegistry()
	var infos []scheduler.TaskInfo
	for _, state := range states {
		info := scheduler.TaskInfo{TaskState: *state}
		if last, err := s.store.GetLastExecution(ctx, state.Name); err == nil {
			var duration int64
			if last.StartedAt != nil && last.FinishedAt != nil {
				duration = last.FinishedAt.Sub(*last.StartedAt).Milliseconds()
			}
			info.LastExecution = &scheduler.LastExecution{
				Timestamp: last.CreatedAt,
				Status:    last.Status,
				Duration:  duration,
			}
		}
		if _, ok := registry[state.Name]; ok {
			infos = append(infos, info)
		}
	}

	return infos, nil
}

// GetTask returns a single task with its last execution and recent execution history.
func (s *TaskService) GetTask(ctx context.Context, name string) (*scheduler.TaskInfo, []*model.TaskExecution, error) {
	state, err := s.store.GetTaskState(ctx, name)
	if err != nil {
		return nil, nil, err
	}

	info := scheduler.TaskInfo{TaskState: *state}
	if last, err := s.store.GetLastExecution(ctx, name); err == nil {
		var duration int64
		if last.StartedAt != nil && last.FinishedAt != nil {
			duration = last.FinishedAt.Sub(*last.StartedAt).Milliseconds()
		}
		info.LastExecution = &scheduler.LastExecution{
			Timestamp: last.CreatedAt,
			Status:    last.Status,
			Duration:  duration,
		}
	}

	execs, _, err := s.store.ListExecutions(ctx, scheduler.ExecutionFilter{
		TaskName: name,
		Page:     1,
		PageSize: 20,
	})
	if err != nil {
		return nil, nil, err
	}

	return &info, execs, nil
}

// ListExecutions returns paginated execution history for a task.
func (s *TaskService) ListExecutions(ctx context.Context, name string, page, pageSize int) ([]*model.TaskExecution, int64, error) {
	return s.store.ListExecutions(ctx, scheduler.ExecutionFilter{
		TaskName: name,
		Page:     page,
		PageSize: pageSize,
	})
}

// GetStats returns aggregate queue statistics.
func (s *TaskService) GetStats(ctx context.Context) (*scheduler.QueueStats, error) {
	return s.store.Stats(ctx)
}

// PauseTask pauses a scheduled task.
func (s *TaskService) PauseTask(name string) error {
	return s.engine.PauseTask(name)
}

// ResumeTask resumes a paused scheduled task.
func (s *TaskService) ResumeTask(name string) error {
	return s.engine.ResumeTask(name)
}

// TriggerTask manually triggers a task.
func (s *TaskService) TriggerTask(name string) (*model.TaskExecution, error) {
	return s.engine.TriggerTask(name)
}
