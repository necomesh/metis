## Context

The scheduler package (`internal/scheduler/`) already provides a robust `Engine`, `Store`, and `executor` for running cron and async tasks. However, the HTTP handler (`internal/handler/task.go`) accesses the engine and store directly, bypassing the service layer that all other kernel modules use. This makes task management inconsistent with user, role, menu, session, and settings management.

## Goals / Non-Goals

**Goals:**
- Introduce a `TaskService` in `internal/service/` that mediates handler-to-scheduler interactions.
- Add comprehensive service-layer tests using the same in-memory SQLite pattern as other kernel TDD changes.
- Keep the scheduler engine untouched — this change is purely about layering.

**Non-Goals:**
- Changing scheduler engine behavior, cron logic, or task execution semantics.
- Adding new task types or modifying existing task definitions.
- Frontend changes.

## Decisions

### Thin service vs. rich service
**Decision:** Implement a thin `TaskService` that delegates to `scheduler.Store` and `scheduler.Engine`.
**Rationale:** The real complexity (cron scheduling, worker pools, retry logic) lives in the scheduler package. A thick service would just duplicate that code. The thin service gives us a testable seam and a consistent architectural pattern without unnecessary abstraction.

### Test scope
**Decision:** Tests will cover `GormStore`-backed operations via `TaskService`, not the live `Engine` with running cron/poller goroutines.
**Rationale:** Testing live cron is flaky and slow. By passing a `GormStore` directly to `TaskService`, we can verify all read/write paths (task states, executions, stats, pause/resume state) deterministically. Engine lifecycle tests can be added later in a dedicated `scheduler` package TDD if needed.

### No additional repository abstraction
**Decision:** `TaskService` will use `scheduler.Store` directly; no new GORM repository is created.
**Rationale:** `GormStore` already encapsulates all database access for tasks. Adding another repository would create a redundant abstraction layer.

## Risks / Trade-offs

- **[Risk] Double abstraction** → The service layer is intentionally thin. If task business logic grows (e.g., permission-aware task visibility, webhook callbacks), it will naturally migrate into `TaskService` over time.
- **[Risk] Handler regression** → Refactoring `TaskHandler` to use `TaskService` is a mechanical change, but any missed field mapping could break the API response shape. Mitigation: keep response structs identical and verify via compilation.
