# Capability: itsm-approval-ui

## Purpose
Provides the frontend UI for ITSM ticket approval workflows, including the "My Approvals" page, inline approve/deny actions, SLA display enhancements, and menu badge integration.

## Requirements

### Requirement: My Approvals page
The system SHALL provide a "我的审批" page at route `/itsm/tickets/approvals` displaying a table of pending approval activities assigned to the current user. Each row SHALL show: Ticket Code, Ticket Title, Service Name, Priority（with color badge）, SLA 状态 badge（on_track=绿/breached=红）, SLA 剩余时间（相对时间如"剩余2小时"）, Activity Name, Created At. Table SHALL support pagination.

#### Scenario: View approval list with SLA info
- **WHEN** user navigates to "我的审批" page
- **THEN** system displays approval activities in a table with SLA status badges and remaining time, sorted by priority

#### Scenario: Empty approval list
- **WHEN** user has no pending approvals
- **THEN** page shows empty state message "暂无待审批工单"

### Requirement: Inline approve/deny actions
The "我的审批" table SHALL provide inline action buttons for each row: "通过" (approve) and "驳回" (deny). "驳回" SHALL open a dialog/popover for entering denial reason. After action completion, the row SHALL be removed from the list and a success toast shown.

#### Scenario: Approve from list
- **WHEN** user clicks "通过" button on an approval item
- **THEN** system calls approve API, removes the row from list, shows success toast

#### Scenario: Deny with reason from list
- **WHEN** user clicks "驳回" button, enters reason "不符合规范", and confirms
- **THEN** system calls deny API with reason, removes the row, shows success toast

### Requirement: Approval detail navigation
Clicking on a ticket code or title in the approval list SHALL navigate to the ticket detail page (`/itsm/tickets/:id`), where the user can view full ticket context before deciding.

#### Scenario: Navigate to ticket detail
- **WHEN** user clicks on ticket code in approval list
- **THEN** browser navigates to `/itsm/tickets/:id` showing full ticket details

### Requirement: SLA enhancement for existing ticket lists
The existing ticket list pages (mine, todo, history) SHALL display SLA status as a color-coded badge and SLA remaining time when applicable. Breached SLA SHALL show red badge with "已超时" text. On-track SLA SHALL show remaining time as relative duration.

#### Scenario: SLA badge on todo list
- **WHEN** user views todo list and a ticket has `slaStatus="breached_response"`
- **THEN** the ticket row shows a red "已超时" badge in the SLA column

#### Scenario: SLA remaining time on mine list
- **WHEN** user views mine list and a ticket has `slaResolutionDeadline` in the future
- **THEN** the ticket row shows remaining time like "剩余 3小时 20分"

### Requirement: Menu item for My Approvals
The ITSM navigation SHALL include a "我的审批" menu item under the ticket section. The menu item SHALL display a badge with the count of pending approvals (from approvals/count API). Badge SHALL disappear when count is 0.

#### Scenario: Menu badge shows count
- **WHEN** user has 3 pending approvals and views ITSM sidebar
- **THEN** "我的审批" menu item shows badge with "3"

#### Scenario: Menu badge hidden when no approvals
- **WHEN** user has 0 pending approvals
- **THEN** "我的审批" menu item shows no badge
