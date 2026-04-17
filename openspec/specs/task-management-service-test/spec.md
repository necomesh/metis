# Capability: task-management-service-test

## Purpose

Defines service-layer test requirements for the task management module, ensuring `TaskService` correctly mediates between HTTP handlers and the scheduler engine/store.

## Requirements

### Requirement: Task service test infrastructure
The system SHALL provide a test harness for `TaskService` using an in-memory SQLite database and real `GormStore`, consistent with other kernel service tests.

#### Scenario: Setup test database
- **WHEN** a task service test initializes
- **THEN** it SHALL migrate the `TaskState` and `TaskExecution` tables into a shared-memory SQLite database

#### Scenario: Setup DI container
- **WHEN** a task service test needs dependencies
- **THEN** it SHALL provide the database and construct a `TaskService` wrapping a `GormStore`

### Requirement: Test task listing and retrieval
The service-layer test suite SHALL verify that `ListTasks` and `GetTask` correctly query task states and attach execution metadata.

#### Scenario: List tasks with type filter
- **WHEN** scheduled and async task states exist and `ListTasks("scheduled")` is called
- **THEN** only scheduled tasks are returned, each with its last execution summary if available

#### Scenario: List tasks without filter
- **WHEN** `ListTasks("")` is called
- **THEN** all task states are returned regardless of type

#### Scenario: Get task with recent executions
- **WHEN** a task state exists with multiple executions and `GetTask(name)` is called
- **THEN** it returns the task info with the last execution and a list of recent executions

### Requirement: Test execution history and stats
The service-layer test suite SHALL verify that execution pagination and queue statistics are computed correctly.

#### Scenario: List executions with pagination
- **WHEN** a task has 25 executions and `ListExecutions(name, 1, 10)` is called
- **THEN** it returns 10 items and total=25

#### Scenario: Get stats reflects current queue
- **WHEN** tasks are registered and executions exist in pending, running, completed, and failed statuses
- **THEN** `GetStats` returns counts matching the current database state

### Requirement: Test task lifecycle operations
The service-layer test suite SHALL verify that `PauseTask`, `ResumeTask`, and `TriggerTask` correctly interact with task state and the execution queue.

#### Scenario: Pause task updates state
- **WHEN** `PauseTask(name)` is called on an active scheduled task
- **THEN** the task state status becomes `paused`

#### Scenario: Resume task updates state
- **WHEN** `ResumeTask(name)` is called on a paused scheduled task
- **THEN** the task state status becomes `active`

#### Scenario: Trigger task enqueues execution
- **WHEN** `TriggerTask(name)` is called on a registered task
- **THEN** a new `TaskExecution` with trigger=`manual` and status=`pending` is created

#### Scenario: Pause prevents double pause
- **WHEN** `PauseTask(name)` is called on an already paused task
- **THEN** it returns an error indicating the task is already paused

#### Scenario: Resume prevents double resume
- **WHEN** `ResumeTask(name)` is called on an already active task
- **THEN** it returns an error indicating the task is already active
