## Why

流程引擎和设计器就绪后，最后一环是运行时可视化。当前工单详情页无法可视化展示流程执行状态——管理员不知道工单"走到了哪一步"、"哪些分支在等待"、"流程变量当前值是什么"。

运行时追踪将流程设计器从"设计工具"升级为"可视化运维面板"，让 ITSM 管理员能够：看到实时流程状态、理解工单卡在哪里、查看决策数据。

## What Changes

### 后端：Token API + Variable API 增强
- **Token 状态 API**：新建 TokenRepository + TokenHandler，`GET /api/v1/itsm/tickets/:id/tokens` 返回 token 列表（含 node_id, status, token_type, parent_token_id, scope_id）
- **变量编辑 API**：`PUT /api/v1/itsm/tickets/:id/variables/:key` 管理员手动修改流程变量（调试/紧急干预用）

### 前端：Runtime Workflow Viewer
- **Token 驱动节点高亮**：用 token 状态替代 activity 状态来标记节点——active token 绿色脉冲、completed 灰色勾选、cancelled 灰色删除线、failed 红色
- **已完成路径标记**：已完成 token 经过的边显示绿色动画
- **并行分支可视化**：多个活跃 token 同时高亮各自所在节点
- **节点点击交互**：Popover 显示该节点的活动记录（操作人、时间、outcome、form_data 摘要）

### 前端：变量面板增强
- **Scope 过滤**：按 scopeID 分组显示变量（root / subprocess scope）
- **管理员编辑**：管理员可在面板中直接修改变量值（调用 PUT API）
- **变量类型渲染**：JSON 类型折叠显示、Boolean 显示 toggle 样式

### 工单详情页集成
- 将 Runtime Viewer 替换现有的 WorkflowViewer
- 增强 VariablesPanel 集成管理员编辑功能

## Out of Scope

- **工单表单动态渲染**（创建/处理/查看模式切换 FormRenderer 集成）→ 单独变更
- **变量修改历史时间线**（需要额外的审计表）→ 后续迭代

## Capabilities

### New Capabilities
- `itsm-runtime-viewer`: 运行时流程图组件（token 驱动高亮 + 路径标记 + 节点点击交互）
- `itsm-token-api`: Token 查询 API（repository + handler + 路由注册）

### Modified Capabilities
- `itsm-variable-panel`: 增强变量面板（scope 分组 + 管理员编辑 + 类型渲染）
- `itsm-ticket-detail-ui`: 工单详情页集成 Runtime Viewer + 增强 VariablesPanel

## Impact

- **后端**：新增 token_repository.go (~60 行) + token_handler.go (~50 行)；variable_handler.go 新增 Update 方法 (~40 行)；路由注册 (~10 行)
- **前端**：重构 workflow-viewer.tsx (~200 行改动)；增强 variables-panel.tsx (~150 行改动)；新增 activity-popover.tsx (~150 行)；更新 api.ts (~30 行)；i18n 补充
- **依赖**：itsm-bpmn-designer（复用 BPMN 节点渲染组件 + 自定义边组件）
