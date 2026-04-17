## Why

The task management module is the only kernel feature that lacks a dedicated service layer — `TaskHandler` talks directly to `scheduler.Engine` and `scheduler.Store`. This breaks the established architectural pattern used by user, role, menu, session, and settings management, making the codebase harder to navigate and test. Adding a `TaskService` with comprehensive TDD-style tests will bring task management into alignment with the rest of the kernel.

## What Changes

- Create `internal/service/task.go` with a thin `TaskService` that mediates between handlers and the scheduler store/engine.
- Create `internal/service/task_test.go` with in-memory SQLite tests covering task listing, execution history, stats, pause/resume, and manual trigger.
- Refactor `internal/handler/task.go` to route through `TaskService` instead of directly accessing `scheduler.Engine`.

## Capabilities

### New Capabilities
- `task-management-service-test`: Service-layer test coverage for task listing, execution queries, statistics, pause/resume, and manual trigger.

### Modified Capabilities
- (none)

## Impact

- `internal/service/task.go` (new)
- `internal/service/task_test.go` (new)
- `internal/handler/task.go` (refactored to use `TaskService`)
- `cmd/server/main.go` (wire `TaskService` into IOC container)
