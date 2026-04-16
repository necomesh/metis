## Context

ITSM 流程引擎已具备 ExecutionToken 模型（model_token.go）和 ProcessVariable 模型（model_variable.go），但 Token 仅有 GORM 模型定义，无 Repository 和 HTTP Handler。Variable 已有 Repository + 只读 List API。

前端现有 WorkflowViewer 通过 activities 数组做节点高亮（completed/active/inactive），但 activity 无法准确表达并行分支——一个节点可能有多个 token 但只有一个 activity。VariablesPanel 是只读表格，无 scope 分组、无编辑能力。

itsm-bpmn-designer 变更已完成，提供了 15 种 BPMN 节点渲染组件 + 自定义边组件，Runtime Viewer 可直接复用。

## Goals / Non-Goals

**Goals:**
- Token 驱动的节点状态可视化，正确处理并行/子流程场景
- 管理员可查看和编辑流程变量（调试/紧急干预）
- 节点点击查看活动历史（操作人、时间、outcome）

**Non-Goals:**
- 动态表单渲染（创建/处理工单集成 FormRenderer）→ 单独变更
- 变量修改审计时间线（需要额外审计表）→ 后续
- Token 管理操作（手动取消/重试 token）→ 后续
- 实时推送（WebSocket/SSE）→ 当前用轮询或手动刷新

## Decisions

### D1: Token API 结构 — 扁平列表 + 前端构建树

**选项 A**：后端返回树结构（递归查询）
**选项 B**：后端返回扁平列表（含 parent_token_id），前端构建树 ✅

选 B。Token 数量通常 < 50，前端构建树开销可忽略，后端实现更简单（单次 SQL 查询）。前端可以灵活选择是否渲染树或扁平列表。

### D2: 节点状态优先级 — Token > Activity

现有 viewer 用 activity.status 做高亮。改为 token.status：
- `active` token 所在节点 → 绿色脉冲环
- `completed` token 经过的节点 → 灰色 + 勾选
- `cancelled` token 所在节点 → 灰色 + 删除线
- 无 token 的节点 → 低透明度（未到达）

边的状态：source 和 target 都有 completed/active token → 绿色动画。

回退兼容：如果 tokens API 返回空（旧数据无 token），降级到现有 activity 逻辑。

### D3: 变量编辑 — 就地编辑 + 类型校验

管理员在 VariablesPanel 点击编辑按钮，行内切换为 Input，提交调 `PUT /api/v1/itsm/tickets/:id/variables/:key`。后端校验 valueType 与新值一致性（JSON parse、number parse 等）。source 字段更新为 `"manual:<userId>"`。

### D4: 活动历史 Popover — 复用现有 activities API

点击节点 → 按 nodeId 过滤 activities → 在 Popover 中显示列表。无需新 API，前端已有 `fetchTicketActivities()`，只需按 nodeId 筛选。Popover 内容：活动名称、状态 badge、操作时间、outcome badge。

### D5: Runtime Viewer 替换策略 — 增强现有 WorkflowViewer

不新建组件，直接在 `workflow-viewer.tsx` 上增强：
- 新增 `fetchTicketTokens()` 调用
- 用 token 状态替代 activity 状态做节点/边装饰
- 新增节点点击 Popover（活动历史）
- 保持 props 接口向后兼容（activities 仍可用作降级）

### D6: 权限控制 — 变量编辑需管理员角色

变量 PUT API 仅限管理员（通过 Casbin 策略控制）。前端通过 `usePermission` hook 判断是否显示编辑按钮。

## Risks / Trade-offs

**[Token 数据缺失]** → 旧工单可能无 ExecutionToken 记录（引擎升级前创建的）。Mitigation：前端检测 tokens 为空时降级到 activity-based 渲染。

**[并行 token 视觉重叠]** → 一个节点可能同时有多个 active token（如 inclusive gateway 合并点）。Mitigation：节点只需显示"活跃"状态即可，不需要区分具体哪个 token。

**[变量编辑并发]** → 管理员编辑变量时引擎也可能在修改。Mitigation：PUT API 使用 upsert（SetVariable），最后写入者胜。source 字段区分来源。
