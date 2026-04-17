## 1. Test Infrastructure

- [x] 1.1 Create `internal/service/task_test.go` with `newTestDBForTask`, `newTaskServiceForTest`, and `seedTaskState` helpers using in-memory SQLite and real `GormStore`.
- [x] 1.2 Ensure `AutoMigrate` covers `TaskState` and `TaskExecution`.

## 2. TaskService Implementation

- [x] 2.1 Create `internal/service/task.go` with `TaskService` struct holding `scheduler.Store`.
- [x] 2.2 Implement `NewTask(i do.Injector) (*TaskService, error)` provider.
- [x] 2.3 Implement `ListTasks(taskType string)` returning `[]scheduler.TaskInfo` with last execution attached.
- [x] 2.4 Implement `GetTask(name string)` returning task info + recent executions.
- [x] 2.5 Implement `ListExecutions(name string, page, pageSize int)` returning paginated executions.
- [x] 2.6 Implement `GetStats()` returning `*scheduler.QueueStats`.
- [x] 2.7 Implement `PauseTask(name)`, `ResumeTask(name)`, and `TriggerTask(name)` delegating to the scheduler engine.

## 3. Task Listing and Retrieval Tests

- [x] 3.1 Implement `TestTaskServiceListTasks_WithTypeFilter` to verify scheduled/async filtering.
- [x] 3.2 Implement `TestTaskServiceListTasks_WithoutFilter` to verify all tasks are returned.
- [x] 3.3 Implement `TestTaskServiceListTasks_AttachesLastExecution` to verify duration and status mapping.
- [x] 3.4 Implement `TestTaskServiceGetTask_WithRecentExecutions` to verify task info and execution list.

## 4. Execution History and Stats Tests

- [x] 4.1 Implement `TestTaskServiceListExecutions_Pagination` to verify page size and total count.
- [x] 4.2 Implement `TestTaskServiceGetStats_ReflectsQueue` to verify pending, running, completed, and failed counts.

## 5. Task Lifecycle Tests

- [x] 5.1 Implement `TestTaskServicePauseTask_UpdatesState` to verify status becomes `paused`.
- [x] 5.2 Implement `TestTaskServiceResumeTask_UpdatesState` to verify status becomes `active`.
- [x] 5.3 Implement `TestTaskServiceTriggerTask_EnqueuesExecution` to verify manual trigger and pending status.
- [x] 5.4 Implement `TestTaskServicePauseTask_PreventsDoublePause` to verify error on already paused.
- [x] 5.5 Implement `TestTaskServiceResumeTask_PreventsDoubleResume` to verify error on already active.

## 6. Handler Refactor and IOC Wiring

- [x] 6.1 Refactor `internal/handler/task.go` to use `*service.TaskService` instead of direct `*scheduler.Engine` access.
- [x] 6.2 Register `NewTask` provider in `cmd/server/main.go`.
- [x] 6.3 Resolve `*service.TaskService` in `internal/handler/handler.go` and inject into `TaskHandler`.

## 7. Verification

- [x] 7.1 Run `go test ./internal/service/ -run TestTaskService -v` and ensure all tests pass.
- [x] 7.2 Run `go test ./...` to confirm no regressions.
