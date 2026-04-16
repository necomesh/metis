## 1. 后端：Token API

- [x] 1.1 新建 `token_repository.go`：实现 TokenRepository，提供 ListByTicket(ticketID) 方法（按 createdAt ASC 排序）
- [x] 1.2 新建 `token_handler.go`：实现 TokenHandler.List，GET /api/v1/itsm/tickets/:id/tokens，工单不存在返回 404，无 token 返回空数组
- [x] 1.3 在 app.go 中注册 TokenRepository + TokenHandler 的 IOC Provider，在 Routes 中注册路由

## 2. 后端：Variable 编辑 API

- [x] 2.1 在 variable_handler.go 新增 Update 方法：PUT /api/v1/itsm/tickets/:id/variables/:key，校验 valueType 一致性，更新 source 为 "manual:<userId>"，变量不存在返回 404
- [x] 2.2 在 Routes 中注册 PUT 路由，确保 Casbin 策略限制仅管理员可调用

## 3. 前端：API 层

- [x] 3.1 在 api.ts 新增 `fetchTicketTokens(ticketId)` 函数和 `TokenItem` 类型定义
- [x] 3.2 在 api.ts 新增 `updateTicketVariable(ticketId, key, { value, valueType? })` 函数

## 4. 前端：Runtime Viewer 增强

- [x] 4.1 重构 workflow-viewer.tsx：新增 tokens prop（TokenItem[]），用 token 状态替代 activity 状态做节点/边装饰——active 绿色脉冲、completed 灰色、cancelled 删除线、无 token 低透明度
- [x] 4.2 实现降级逻辑：tokens 为空时降级到 activity-based 高亮（保持现有行为）
- [x] 4.3 实现边高亮：source+target 都有 completed/active token 的边显示绿色动画
- [x] 4.4 新建 activity-popover.tsx：节点点击 Popover 组件，按 nodeId 过滤 activities，显示活动名称、状态 badge、完成时间、outcome badge；无记录时显示空提示
- [x] 4.5 在 workflow-viewer.tsx 集成 activity-popover：onNodeClick 打开 Popover

## 5. 前端：VariablesPanel 增强

- [x] 5.1 重构 variables-panel.tsx：按 scopeID 分组显示，root scope 为默认组，其余 scope 使用 Collapsible 折叠组
- [x] 5.2 增强类型渲染：JSON 折叠显示 + 格式化、Boolean 显示绿色/灰色 badge
- [x] 5.3 实现管理员编辑功能：usePermission 判断权限 → 编辑按钮 → 行内 Input/Textarea → 保存调 PUT API → 刷新列表；JSON 类型校验格式

## 6. 工单详情页集成

- [x] 6.1 在工单详情页新增 fetchTicketTokens 查询，将 tokens 传入 WorkflowViewer
- [x] 6.2 替换现有 VariablesPanel 为增强版（已是同一组件，确认 props 兼容）

## 7. i18n

- [x] 7.1 补充 zh-CN + en 翻译：token 状态、变量编辑、活动历史 Popover、scope 标签等文案
