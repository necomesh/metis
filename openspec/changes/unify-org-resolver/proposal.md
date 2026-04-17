## Why

三个 Org 相关接口散落在不同包中（`app.OrgScopeResolver`、`app.OrgUserResolver`、`ai.OrgResolver`），各自定义了部分组织查询能力。AI App 里还承载了本属于 Org 模块的 `org_context` 工具定义和 handler。同时 App Seed 顺序依赖 Go import 顺序，当前 Org 排在最后，而 AI 和 ITSM 实际上依赖 Org 的数据和服务。需要统一接口、理清 seed 顺序、让工具归属到正确的模块。

## What Changes

- **合并三个 Org 接口为统一的 `app.OrgResolver`**：将 `OrgScopeResolver`（DataScope）、`OrgUserResolver`（ITSM 参与者匹配）、`ai.OrgResolver`（AI 工具）合并为一个接口，DTO 类型统一定义在 `app` 包
- **将 `org_context` 工具移至 Org App**：Org App 实现 `ToolRegistryProvider`，拥有 `organization.org_context` 的 seed 记录和 handler 实现
- **AI App 清理**：删除 `ai.OrgResolver` 接口及全部 Org DTO，删除 `org_context` handler 和 seed 记录，`GeneralToolRegistry` 改用 `app.OrgResolver`
- **调整 App Seed 顺序**：`edition_full.go` import 顺序改为 `org → ai → itsm`，确保依赖方在被依赖方之后初始化
- **Org App 合并 Resolver 实现**：`OrgScopeResolverImpl` + `OrgUserResolverImpl` 合并为 `OrgResolverImpl`，新增 `QueryContext` 等方法实现

## Capabilities

### New Capabilities

- `org-tool-registry`: Org App 作为 ToolRegistryProvider，注册并处理 `organization.org_context` 工具调用

### Modified Capabilities

- `org-scope-resolver`: 合并为统一 `app.OrgResolver` 接口，增加 AI 工具所需的查询方法
- `ai-tool-registry`: 移除 org_context 工具定义和 handler，GeneralToolRegistry 改用 `app.OrgResolver`
- `seed-init`: 调整 edition_full.go 的 import 顺序以反映模块间 seed 依赖

## Impact

- **`internal/app/app.go`**：删除 `OrgScopeResolver` 和 `OrgUserResolver`，新增统一 `OrgResolver` 接口 + DTO 类型
- **`internal/app/org/`**：合并 resolver 实现，新增 ToolRegistryProvider，seed 中新增 org_context BuiltinTool
- **`internal/app/ai/`**：删除 Org 相关接口/DTO/handler/seed，调整 GeneralToolRegistry 依赖
- **`internal/app/itsm/`**：引用从 `app.OrgUserResolver` 改为 `app.OrgResolver`
- **`internal/middleware/data_scope.go`**：引用从 `app.OrgScopeResolver` 改为 `app.OrgResolver`
- **`internal/handler/handler.go`**：同上
- **`cmd/server/edition_full.go`**：import 顺序调整
- **无 API 变更，无前端变更，无数据库迁移**
