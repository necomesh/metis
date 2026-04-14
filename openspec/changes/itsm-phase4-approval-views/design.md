## Context

ITSM 已实现经典引擎（ClassicEngine）和智能引擎（SmartEngine）的双栈工作流，工单可以包含审批步骤（`activity_type="approve"`）。当前有三个工单视图——我的工单（mine）、待办（todo）、历史（history），但缺少"我的审批"视图。处理人无法集中查看等待自己审批的工单活动。

现有数据模型已具备审批能力基础：
- `TicketActivity.ActivityType = "approve"` 标记审批步骤
- `TicketAssignment` 通过 `UserID/PositionID/DepartmentID` 关联审批人到活动
- `TicketActivity.TransitionOutcome` 支持 "approve"/"reject" 结果
- 但无专用查询端点按审批人聚合待审批活动

## Goals / Non-Goals

**Goals:**
- 提供"我的审批"列表端点，让用户查看分配给自己的待审批活动
- 提供审批通过/驳回操作端点，推进工作流引擎
- 前端增加"我的审批"页面，直观展示 SLA 状态和剩余时间
- 增强现有工单列表（mine/todo/history）的 SLA 信息展示

**Non-Goals:**
- 不重构已有的 todo/mine/history 端点（仅前端增强 SLA 展示）
- 不新增 SLA 计算逻辑（SLA 字段已在 Ticket 创建时填充）
- 不实现审批委托/代审功能（后续迭代）
- 不实现批量审批（本次单条操作）

## Decisions

### 1. 审批列表查询策略

**选择**：通过 TicketAssignment JOIN TicketActivity 查询当前用户的待审批活动

**理由**：TicketAssignment 已包含 `UserID` 和 `ActivityID` 字段，直接关联 TicketActivity（`activity_type="approve"` 且 `status` 为 pending/in_progress）即可获取审批列表。无需新增模型或修改现有表结构。

**备选方案**：在 Ticket 级别过滤 `status=waiting_approval` → 但一个工单可能有多个审批步骤，且不同审批人负责不同步骤，Ticket 级别太粗。

### 2. 审批动作复用 ClassicEngine.Progress

**选择**：审批通过/驳回调用现有的 `WorkflowEngine.Progress()`，传入 `TransitionOutcome = "approve"/"reject"`

**理由**：ClassicEngine 已实现审批节点的 outcome 处理逻辑（根据 approve/reject 结果选择出边推进），无需重复实现。SmartEngine 的审批步骤同样通过 Progress 推进。

### 3. 审批列表响应结构

**选择**：返回扁平化的审批项列表，每项包含 Ticket 摘要 + Activity 详情 + SLA 信息

**理由**：前端需要在审批列表中同时展示工单标题、优先级、SLA 状态和活动信息（审批表单、备注），扁平结构减少前端关联查询。

### 4. SLA 剩余时间计算

**选择**：前端根据 `slaResponseDeadline` 和 `slaResolutionDeadline` 与当前时间做差值展示

**理由**：SLA deadline 已在工单创建时计算并存储，无需后端额外计算。前端使用相对时间显示（如"剩余 2 小时"）。

## Risks / Trade-offs

- [TicketAssignment 可能通过 PositionID/DepartmentID 分配而非直接 UserID] → 审批列表查询需要解析 position/department 到具体用户，若 Org App 未安装则仅匹配 `UserID` 直接分配
- [并发审批冲突：同一活动多个审批人可能同时操作] → Progress 内部已有事务锁，重复审批会返回 "activity already completed" 错误
