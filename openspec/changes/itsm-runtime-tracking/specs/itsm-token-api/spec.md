## ADDED Requirements

### Requirement: Token 列表查询 API
系统 SHALL 提供 `GET /api/v1/itsm/tickets/:id/tokens` 端点，返回指定工单的所有 ExecutionToken 记录。返回字段包含 id, ticketId, parentTokenId, nodeId, status, tokenType, scopeId, createdAt, updatedAt。按 createdAt ASC 排序。

#### Scenario: 查询有 token 的工单
- **WHEN** 调用 `GET /api/v1/itsm/tickets/1/tokens`，且工单 1 有 3 个 token
- **THEN** 返回 200，body 包含 3 个 token 对象，每个含 nodeId 和 status 字段

#### Scenario: 查询无 token 的旧工单
- **WHEN** 调用 `GET /api/v1/itsm/tickets/99/tokens`，且工单 99 无 token 记录
- **THEN** 返回 200，body 为空数组 `[]`

#### Scenario: 工单不存在
- **WHEN** 调用 `GET /api/v1/itsm/tickets/999/tokens`，且工单 999 不存在
- **THEN** 返回 404

### Requirement: Token Repository 实现
系统 SHALL 实现 TokenRepository，提供 ListByTicket(ticketID) 方法，执行单次 SQL 查询获取指定工单的所有 token。

#### Scenario: ListByTicket 返回扁平列表
- **WHEN** 调用 `ListByTicket(1)`，工单 1 有 main token + 2 个 parallel 子 token
- **THEN** 返回 3 个 ExecutionToken，按 createdAt ASC 排序，parent_token_id 正确关联

### Requirement: 变量更新 API
系统 SHALL 提供 `PUT /api/v1/itsm/tickets/:id/variables/:key` 端点，允许管理员更新指定流程变量的值。请求 body 包含 `{ value: any, valueType?: string }`。更新后 source 字段设为 `"manual:<userId>"`。

#### Scenario: 管理员更新 string 变量
- **WHEN** 管理员调用 `PUT /api/v1/itsm/tickets/1/variables/priority` body `{ "value": "high" }`
- **THEN** 返回 200，变量值更新为 "high"，source 为 "manual:5"（userId=5）

#### Scenario: 更新不存在的变量
- **WHEN** 调用 `PUT /api/v1/itsm/tickets/1/variables/nonexistent`
- **THEN** 返回 404

#### Scenario: 非管理员调用
- **WHEN** 普通用户调用 `PUT /api/v1/itsm/tickets/1/variables/priority`
- **THEN** 返回 403（Casbin 策略拒绝）
