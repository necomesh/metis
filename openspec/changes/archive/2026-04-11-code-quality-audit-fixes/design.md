## Context

架构走查发现 Metis 代码库存在多层面的质量问题：前端 React Compiler 违规会导致运行时崩溃，后端分层被 SSO handler 打破，安全相关错误被静默吞掉，以及前后端均存在代码重复。这些问题分散在约 15 个文件中，但彼此独立，适合作为一批原子修复集中处理。

当前状态：
- 后端严格遵循 Handler → Service → Repository 分层，**唯一例外**是 `SSOHandler` 直接持有 3 个 Repository 并在 Handler 层实现 JIT provisioning
- JIT provisioning（从外部 IdP 创建/关联本地用户）在三处独立实现：`AuthService.OAuthLogin`、`IdentitySourceService.jitProvisionLDAP`、`SSOHandler.jitProvision`
- `main.go` 和 `install.go:hotSwitch` 有约 30 行 IOC 注册代码完全重复
- 前端 `install/index.tsx` 和 `permission-dialog.tsx` 使用 IIFE 模式，违反 React Compiler 约束

## Goals / Non-Goals

**Goals:**
- 消除所有已知的 React Compiler 违规，防止运行时崩溃
- 恢复后端分层纯洁性：Handler 不直接依赖 Repository
- 统一 JIT provisioning 为单一 Service 方法
- 确保安全相关操作的失败至少有日志记录
- 消除前后端关键路径上的代码重复

**Non-Goals:**
- 不改变任何 API 接口（纯内部重构）
- 不引入新的依赖或工具
- 不重构 `useListPage` hook 本身（仅让 audit-logs 页面使用它）
- 不对 license App 的 `LicenseRepo.List` 做大规模重构（仅提取共享 filter）
- 不修复 P3 以下的问题（如 sidebar 持久化、login 并行请求）

## Decisions

### D1: JIT Provisioning 统一到 AuthService

**选择**: 在 `AuthService` 中新建 `ProvisionExternalUser(params ExternalUserParams) (*model.User, error)` 方法，三处调用方（OAuth、LDAP、OIDC SSO）共用此方法。

**替代方案**: 创建独立的 `ProvisionService`。但 provisioning 逻辑与认证流程紧密耦合（生成 token pair、检查并发会话），拆到独立 service 反而增加不必要的跨 service 调用。

**ExternalUserParams 结构**:
```go
type ExternalUserParams struct {
    Provider     string // "github", "google", "oidc_3", "ldap_1"
    ExternalID   string
    Email        string
    DisplayName  string
    AvatarURL    string
    DefaultRole  string // role code, fallback to "user"
    ConflictMode string // "link" or "reject"
}
```

### D2: SSO Handler 瘦身

**选择**: `SSOHandler` 移除对 `userRepo`、`connRepo`、`roleRepo` 的直接依赖。`Callback` 方法改为调用 `AuthService.ProvisionExternalUser` + `AuthService.GenerateTokenPair`。移除 `sso.go` 中的 `jitProvision` 和死代码 `extractDomain`。

### D3: IOC 注册提取为共享函数

**选择**: 在 `cmd/server/` 下新建 `providers.go`，包含 `registerKernelProviders(injector, jwtSecret, blacklist, locale)` 函数。`main.go` 和 `install.go:hotSwitch` 都调用此函数。

**替代方案**: 使用 `do.Module` 分组注册。但 `samber/do` v2 的 Module 概念较重，一个函数更简单。

### D4: React Compiler IIFE 修复策略

**选择**:
- `install/index.tsx` 的 IIFE switch → 提取为 `getStepContent()` 普通函数或直接用 `let stepContent; switch(...) { ... }` 赋值
- `permission-dialog.tsx` 的 JSX 内 IIFE → 在 map callback 内提前计算 icon 变量

### D5: Recovery 中间件响应格式统一

**选择**: 修改 `middleware/recovery.go`，panic 时返回 `handler.R{Code: -1, Message: "internal server error"}` 而非 `{"error": "..."}` 裸 JSON。直接 import handler 包的 `R` struct。

### D6: 错误处理补充日志

**选择**: 在 `_ = xxx` 的安全相关位置改为 `if err := xxx; err != nil { slog.Error(...) }`。保持函数返回值不变（不向调用方传播这些非关键错误），仅增加可观测性。

涉及位置:
- `service/role.go:125-126,158` — Casbin 策略更新
- `service/user.go:233` — 用户停用时 token 吊销

## Risks / Trade-offs

**[R1] JIT provisioning 统一可能遗漏分支差异** → 需要仔细对比三处实现的细微差异（如 LDAP 的 username 生成规则 vs OIDC 的 email-based lookup），确保统一后行为不变。用现有 scenario 做验证。

**[R2] IOC 注册提取后 install.go 的 `do.Override` 语义变化** → `registerKernelProviders` 内部需要接受一个参数区分 `do.Provide` vs `do.Override`，或者让函数返回 provider list 由调用方决定注册方式。选择后者更灵活。

**[R3] `install.go` admin 创建改用 UserService 后需确保 Service 层已注册** → hot-switch 流程中 `UserService` 在 `registerKernelProviders` 时注册，admin 创建在之后执行，时序安全。
