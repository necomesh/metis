## Why

ITSM 的经典引擎（ClassicEngine）包含审批步骤（activity_type="approve"），但目前缺少"我的审批"视图——处理人无法集中看到等待自己审批的工单。此外，现有的工单列表（我的工单、待办、历史）虽然后端已返回 SLA 字段，但前端展示不够突出，审批场景尤其需要 SLA 剩余时间的可视化以辅助优先级判断。本次变更补全审批能力，让经典+智能双栈引擎下的审批流转闭环。

## What Changes

- 新增"我的审批"后端端点 `GET /api/v1/itsm/tickets/approvals`，查询当前用户作为审批人（通过 TicketAssignment）且活动状态为 pending/in_progress 的审批活动，返回工单+活动+SLA 信息
- 新增审批动作端点 `POST /api/v1/itsm/tickets/:id/activities/:aid/approve` 和 `POST /api/v1/itsm/tickets/:id/activities/:aid/deny`，执行审批通过/驳回并推进引擎
- 新增"我的审批"前端页面，展示审批列表（含 SLA 剩余时间倒计时、优先级标记），支持直接审批通过/驳回操作
- 增强现有工单列表（我的工单、待办、历史）的 SLA 展示：增加 SLA 状态 badge 和剩余时间列
- 前端菜单结构调整：工单中心下新增"我的审批"菜单项
- 审批相关的 Casbin 策略 seed

## Capabilities

### New Capabilities

- `itsm-approval-api`: 审批列表查询端点和审批动作端点（approve/deny），含 TicketAssignment 关联查询和引擎推进
- `itsm-approval-ui`: "我的审批"前端页面，审批列表+SLA 可视化+审批操作

### Modified Capabilities

_(无需修改已有 spec 的需求定义)_

## Impact

- 后端：`internal/app/itsm/` 新增 handler/service/repository 方法，新增路由，新增 Casbin 策略
- 前端：`web/src/apps/itsm/pages/tickets/` 新增 approvals 页面，修改现有列表页增强 SLA 展示
- API：新增 3 个端点（approvals 列表、approve、deny）
- 菜单 seed：新增"我的审批"菜单项
- i18n：新增审批相关翻译 key
