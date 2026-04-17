## 1. 统一 OrgResolver 接口和 DTO

- [x] 1.1 在 `internal/app/app.go` 中定义统一的 `OrgResolver` 接口（6 个方法），添加 DTO 类型（OrgDepartment, OrgPosition, OrgContextResult, OrgContextUser, OrgContextDepartment, OrgContextPosition）
- [x] 1.2 删除 `app.go` 中的 `OrgScopeResolver` 和 `OrgUserResolver` 接口

## 2. Org App 合并 Resolver 实现

- [x] 2.1 在 `internal/app/org/scope_resolver.go` 中将 `OrgScopeResolverImpl` 和 `OrgUserResolverImpl` 合并为 `OrgResolverImpl`，实现所有 6 个方法
- [x] 2.2 实现新增的 `GetUserPositions`、`GetUserDepartment`、`QueryContext` 方法
- [x] 2.3 更新 `internal/app/org/app.go` 的 `Providers()`: 注册单一 `app.OrgResolver` 替代原来两个分开的注册

## 3. Org App 实现 ToolRegistryProvider

- [ ] 3.1 创建 `internal/app/org/tool_registry.go`：实现 `OrgToolRegistry`（HasTool + Execute），handler 委托给 `app.OrgResolver.QueryContext`
- [ ] 3.2 在 `internal/app/org/app.go` 中实现 `GetToolRegistry()` 方法使 Org App 满足 `app.ToolRegistryProvider` 接口
- [ ] 3.3 在 Org App seed 中添加 `organization.org_context` BuiltinTool 记录（从 AI seed 移过来）

## 4. AI App 清理

- [ ] 4.1 从 `internal/app/ai/seed.go` 删除 `organization.org_context` BuiltinTool 定义
- [ ] 4.2 从 `internal/app/ai/general_tool_handlers.go` 删除 `OrgResolver` 接口、所有 Org DTO 类型、`handleOrgContext` handler 及其注册
- [ ] 4.3 修改 `GeneralToolRegistry` 使用 `app.OrgResolver`（替代 `ai.OrgResolver`），更新 `current_user_profile` handler 中的调用
- [ ] 4.4 更新 `internal/app/ai/app.go` 的 provider：从 IOC 解析 `app.OrgResolver`（可选，nil-safe），传入 `NewGeneralToolRegistry`

## 5. 消费者迁移

- [ ] 5.1 更新 `internal/middleware/data_scope.go`：从 `app.OrgScopeResolver` 改为 `app.OrgResolver`
- [ ] 5.2 更新 `internal/handler/handler.go`：从 `app.OrgScopeResolver` 改为 `app.OrgResolver`
- [ ] 5.3 更新 `internal/app/itsm/app.go` 和 `ticket_service.go`：从 `app.OrgUserResolver` 改为 `app.OrgResolver`

## 6. Seed 顺序调整

- [ ] 6.1 调整 `cmd/server/edition_full.go` import 顺序为：org, node, apm, observe, license, ai, itsm

## 7. 验证

- [ ] 7.1 运行 `go build -tags dev ./cmd/server/` 确认编译通过
- [ ] 7.2 运行 `go test ./internal/app/org/...` 确认 Org 测试通过
- [ ] 7.3 运行 `go test ./internal/app/ai/...` 确认 AI 测试通过
- [ ] 7.4 运行 `go test ./internal/app/itsm/...` 确认 ITSM 测试通过
