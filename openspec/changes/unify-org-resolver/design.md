## Context

当前 Org 模块的组织查询能力被三个独立接口分散承载：

1. **`app.OrgScopeResolver`** — DataScopeMiddleware 用，只有 `GetUserDeptScope`
2. **`app.OrgUserResolver`** — ITSM 参与者匹配用，只有 `GetUserPositionIDs` / `GetUserDepartmentIDs`
3. **`ai.OrgResolver`** — AI 工具用，有 `GetUserPositions` / `GetUserDepartment` / `QueryContext`

三者都由 Org App 提供实现，消费者分布在 middleware、ITSM、AI 三处。AI App 还额外承载了 `org_context` 工具的 seed 记录和 handler 实现，这是错误的职责归属。

App seed 顺序靠 `edition_full.go` import 顺序隐式控制，当前 Org 排最后，但 AI 和 ITSM 实际依赖 Org 的服务。

## Goals / Non-Goals

**Goals:**

- 将三个 Org 相关接口合并为统一的 `app.OrgResolver`，减少接口碎片化
- DTO 类型（`OrgDepartment`、`OrgPosition`、`OrgContextResult` 等）统一定义在 `app` 包
- `org_context` 工具的 seed 记录和 handler 实现移至 Org App
- Org App 实现 `ToolRegistryProvider` 接口以注册工具 handler
- 调整 `edition_full.go` import 顺序：`org → ai → itsm`
- 完成 `OrgResolver` 的 IOC 接线（解决 AI App 中的 TODO）

**Non-Goals:**

- 不改变 ITSM 对 AI 的 seed 依赖（直接查 `ai_agents` 表）
- 不引入 App 接口级别的 `Priority()` 或 `Dependencies()` 方法
- 不涉及 API 变更、前端变更或数据库迁移
- 不重构 `GeneralToolRegistry` 的整体架构（只移除 org_context）

## Decisions

### D1: 合并为单一 `app.OrgResolver` 接口而非保留多个小接口

**选择**: 合并为一个接口

**原因**: 三个接口的实现都在 Org App，消费者也都通过 `do.MustInvoke` 获取。合并后 IOC 只注册一个 provider，消费者用同一个接口，减少认知负担。方法数量总共 6 个，仍然是合理的接口大小。

**替代方案**: 保留多个小接口，通过组合（embedding）统一。被否决因为增加了不必要的间接层，而且消费者需要知道该 Invoke 哪个接口。

### D2: Org App 实现 `ToolRegistryProvider` 注册 org_context

**选择**: Org App 新增一个 `OrgToolRegistry` 实现 `ToolHandlerRegistry` 接口，通过 `ToolRegistryProvider` 暴露

**原因**: `CompositeToolExecutor` 已经有自动发现机制（`collectToolRegistries()`），Org App 只需实现接口，AI 的 tool executor 就能自动路由 `organization.org_context` 调用到 Org 的 handler。

### D3: `current_user_profile` 保留在 AI 的 GeneralToolRegistry

**选择**: 保留不动，但改用 `app.OrgResolver`

**原因**: `current_user_profile` 是一个"系统级"工具，主要职责是查当前用户信息，附带查 org 数据。它不是 org 专属工具。保留在 `GeneralToolRegistry` 但把 `ai.OrgResolver` 替换为 `app.OrgResolver`。

### D4: Seed 顺序通过 import 顺序控制

**选择**: 调整 `edition_full.go` import 顺序

**原因**: Go 的 `init()` 调用顺序由 import 顺序决定，`app.Register()` 的调用顺序即 `app.All()` 的遍历顺序。简单调整 import 即可，无需架构变更。

## Risks / Trade-offs

**[接口变大]** → 6 个方法的接口比 1-2 个方法的略大，但所有方法都围绕"组织查询"这一职责，语义内聚。消费者不必全用——DataScope 只调 `GetUserDeptScope`，ITSM 只调 ID 相关方法。

**[Import 顺序是隐式约定]** → 未来有人调整 import 排列可能破坏 seed 依赖。通过代码注释和 DESIGN.md 记录来缓解。ITSM seed 已对 agent 缺失做了 `slog.Warn` 降级处理。

**[Org 不安装时 org_context 工具不存在]** → 这是预期行为。edition_lite 没有 Org App，`organization.org_context` BuiltinTool 不会被 seed，Agent 绑定的工具列表中也不会出现。
