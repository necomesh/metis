## 1. 扩展 app.OrgResolver 接口

- [x] 1.1 在 `internal/app/app.go` 的 `OrgResolver` 接口中新增 5 个方法：`FindUsersByPositionCode`、`FindUsersByDepartmentCode`、`FindUsersByPositionAndDepartment`、`FindUsersByPositionID`、`FindUsersByDepartmentID`、`FindManagerByUserID`
- [x] 1.2 验证编译通过（`go build -tags dev ./cmd/server/`）——此时会因接口未完整实现而失败，属预期

## 2. Org App 实现新方法

- [x] 2.1 在 `internal/app/org/scope_resolver.go` 的 `OrgResolverImpl` 上实现 `FindUsersByPositionCode`：查询 `user_positions` JOIN `positions` + `users`，WHERE `positions.code = ? AND users.is_active = true`
- [x] 2.2 实现 `FindUsersByDepartmentCode`：查询 `user_positions` JOIN `departments` + `users`，WHERE `departments.code = ? AND users.is_active = true`
- [x] 2.3 实现 `FindUsersByPositionAndDepartment`：查询 `user_positions` JOIN `positions` + `departments` + `users`，WHERE position code + department code + active
- [x] 2.4 实现 `FindUsersByPositionID`：查询 `user_positions` JOIN `users`，WHERE `position_id = ? AND users.is_active = true`
- [x] 2.5 实现 `FindUsersByDepartmentID`：查询 `user_positions` JOIN `users`，WHERE `department_id = ? AND users.is_active = true`
- [x] 2.6 实现 `FindManagerByUserID`：查询 `users` 表获取 `manager_id`
- [x] 2.7 验证编译通过（`go build -tags dev ./cmd/server/`）

## 3. ITSM ParticipantResolver 迁移

- [x] 3.1 修改 `internal/app/itsm/engine/resolver.go`
- [x] 3.2 更新 `Resolve()` 方法内部调用
- [x] 3.3 更新 `resolveRequesterManager()` 方法

## 4. ITSM Operator 消除 raw SQL

- [x] 4.1 修改 `internal/app/itsm/tools/operator.go`：`Operator` struct 新增 `orgResolver app.OrgResolver` 字段，`NewOperator` 构造函数增加参数
- [x] 4.2 重写 `ValidateParticipants` 中 position 类型的检查：`orgResolver != nil` 时调用 `FindUsersByPositionCode` / `FindUsersByPositionAndDepartment`；`orgResolver == nil` 时跳过检查返回 ok=true
- [x] 4.3 保留 user 类型的 `users` 表直接查询（内核表，非 org 领域）

## 5. ITSM IOC 注入接通

- [x] 5.1 修改 `internal/app/itsm/app.go` 中 `ParticipantResolver` 的 Provider：通过 `do.InvokeAs[app.OrgResolver](i)` 获取可选 OrgResolver，传给 `NewParticipantResolver`
- [x] 5.2 修改 `Operator` 的 Provider：同样注入 OrgResolver
- [x] 5.3 修改 `ticket_service.go`：将 `orgUserResolver app.OrgResolver` 字段（如仍使用旧接口名）统一为 `app.OrgResolver`
- [x] 5.4 验证编译通过（`go build -tags dev ./cmd/server/`）

## 6. 测试适配

- [x] 6.1 修改 `internal/app/itsm/steps_common_test.go`：将 `testOrgService` 改为实现 `app.OrgResolver` 接口（新增方法的测试实现）
- [x] 6.2 更新 BDD 测试中创建 `ParticipantResolver` 的地方，使用新构造函数签名
- [x] 6.3 运行全量 BDD 测试：`make test-bdd`
- [x] 6.4 运行完整 Go 测试：`go test ./internal/app/itsm/... -v`

## 7. 清理

- [x] 7.1 确认 `engine.OrgService` 在代码中无任何残留引用（grep 验证）
- [x] 7.2 确认 `operator.go` 中无直接的 org 表 JOIN（grep `user_positions` / `positions` / `departments` in operator.go）
- [x] 7.3 最终编译验证：`go build -tags dev ./cmd/server/`
