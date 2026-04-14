## ADDED Requirements

### Requirement: Approval list endpoint
The system SHALL provide `GET /api/v1/itsm/tickets/approvals` returning pending approval activities assigned to the current user. The query SHALL join `TicketAssignment`（`user_id = currentUser` 或通过 Org App 解析 position/department 到用户）with `TicketActivity`（`activity_type = "approve"` 且 `status IN ("pending", "in_progress")`）。每条结果 SHALL 包含：Ticket 摘要（id, code, title, status, priority, service, sla_status, sla_response_deadline, sla_resolution_deadline）、Activity 详情（id, name, form_schema, execution_mode, started_at）、Assignment 信息（id, participant_type, sequence, is_current）。支持分页（page, pageSize）和按 priority 排序。

#### Scenario: User has pending approvals
- **WHEN** user calls `GET /api/v1/itsm/tickets/approvals` and has 3 pending approve activities assigned via `TicketAssignment.UserID`
- **THEN** system returns 3 approval items with ticket summary, activity details, and SLA info, sorted by priority

#### Scenario: User has no pending approvals
- **WHEN** user calls `GET /api/v1/itsm/tickets/approvals` and has no assigned approve activities
- **THEN** system returns empty list with total=0

#### Scenario: Org App installed with position-based assignment
- **WHEN** user calls `GET /api/v1/itsm/tickets/approvals` and an approval activity is assigned via `PositionID` matching user's position
- **THEN** system includes that activity in the approval list

### Requirement: Approve activity endpoint
The system SHALL provide `POST /api/v1/itsm/tickets/:id/activities/:aid/approve` to approve an activity. The endpoint SHALL verify the current user is an assigned approver for the activity, set `TransitionOutcome = "approve"`，then call `WorkflowEngine.Progress()` to advance the workflow. A timeline entry SHALL be created recording the approval action.

#### Scenario: Successful approval
- **WHEN** assigned approver calls approve on a pending approve activity
- **THEN** activity status transitions to completed, TransitionOutcome is "approve", workflow engine advances to next node, and timeline records the approval

#### Scenario: Non-approver attempts approval
- **WHEN** user who is NOT assigned to the activity calls approve
- **THEN** system returns 403 Forbidden

#### Scenario: Activity already completed
- **WHEN** approver calls approve on an already-completed activity
- **THEN** system returns 409 Conflict with "activity already completed" message

### Requirement: Deny activity endpoint
The system SHALL provide `POST /api/v1/itsm/tickets/:id/activities/:aid/deny` to deny/reject an activity. The endpoint SHALL verify the current user is an assigned approver, set `TransitionOutcome = "reject"`，then call `WorkflowEngine.Progress()`. Request body MAY include `reason` string. A timeline entry SHALL record the denial with reason.

#### Scenario: Successful denial with reason
- **WHEN** assigned approver calls deny with `{"reason": "信息不完整"}` on a pending approve activity
- **THEN** activity status transitions based on workflow definition（reject edge target or cancellation）, timeline records denial with reason

#### Scenario: Denial without reason
- **WHEN** assigned approver calls deny without reason
- **THEN** system processes the denial normally, timeline records denial without reason text

### Requirement: Approval Casbin policies
The system SHALL seed Casbin policies granting all authenticated roles access to `GET /itsm/tickets/approvals`（审批列表为个人视图，所有登录用户均可访问）。`approve` 和 `deny` 端点的权限 SHALL 通过业务逻辑（Assignment 检查）控制而非 Casbin 角色。

#### Scenario: Casbin policy exists after seed
- **WHEN** system starts and runs seed
- **THEN** Casbin policies for `/api/v1/itsm/tickets/approvals GET` exist for standard roles

### Requirement: Approval count badge
The system SHALL provide `GET /api/v1/itsm/tickets/approvals/count` returning the count of pending approvals for the current user, for use as a menu badge indicator.

#### Scenario: User has 5 pending approvals
- **WHEN** user calls `GET /api/v1/itsm/tickets/approvals/count`
- **THEN** system returns `{"count": 5}`
