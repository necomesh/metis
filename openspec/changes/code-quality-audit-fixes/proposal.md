## Why

架构走查发现多处代码质量问题，涵盖 React Compiler 运行时崩溃风险、后端分层违规、安全相关错误被静默吞掉、以及前后端的重复代码。这些问题积累后会增加维护成本并造成潜在的运行时故障和安全隐患，需要集中修复。

## What Changes

### P0 — React Compiler 违规修复
- 移除 `install/index.tsx` 中的 IIFE，改为普通变量赋值
- 移除 `roles/permission-dialog.tsx` 中 JSX 里的 IIFE，提取为 JSX 外部变量

### P1 — 后端架构修复
- 将 `SSOHandler.jitProvision` 业务逻辑下沉到 Service 层，消除 Handler 对 Repository 的直接依赖
- 统一三处 JIT provisioning 实现（`auth.go` / `identity_source.go` / `sso.go`）为一个共享 Service 方法
- `handler/sso.go` 中 `gorm.ErrRecordNotFound` 泄漏到 Handler 层的问题修复
- `service/role.go` 中 Casbin 策略更新失败改为 `slog.Error` 记录
- `service/user.go` 中用户停用时 token 吊销失败改为 `slog.Error` 记录

### P2 — 代码重复与一致性修复
- 提取 `main.go` 和 `install.go:hotSwitch` 的 IOC 注册为共享函数
- `Recovery` 中间件统一使用 `R{code, message}` 响应格式
- 前端: 提取 localStorage token key 为共享常量
- 前端: `api.ts` 中 `download()` 的 409 处理逻辑复用 `request()` 的实现
- 前端: 清理死代码（`auth.go` 中 `connResps`、`ListByUser` 双重调用）
- 后端: 清理死代码（`sso.go` 中 `extractDomain`）

### P3 — 低优先级改进（顺手修复）
- `audit-logs/auth-tab.tsx` 改用 `useListPage` hook 减少重复
- 后端 `Activate`/`Deactivate` 统一返回前 reload 模型
- `LicenseRepo.List` 提取共享 filter 构建逻辑

## Capabilities

### New Capabilities

无新增能力。

### Modified Capabilities

- `oidc-auth`: SSO JIT provisioning 逻辑从 Handler 层移至 Service 层，与 OAuth 和 LDAP 的 provisioning 统一
- `server-bootstrap`: IOC 注册逻辑抽取为共享函数，消除 main.go 与 install.go 的重复
- `install-wizard-api`: 管理员创建改用 Service 层（补充 PasswordChangedAt 字段）

## Impact

- **后端**: `handler/sso.go`, `handler/install.go`, `handler/auth.go`, `service/auth.go`, `service/role.go`, `service/user.go`, `service/identity_source.go`, `middleware/recovery.go`, `cmd/server/main.go`
- **前端**: `pages/install/index.tsx`, `pages/roles/permission-dialog.tsx`, `pages/audit-logs/auth-tab.tsx`, `lib/api.ts`, `stores/auth.ts`
- **API**: 无接口变更，纯内部重构
- **依赖**: 无新增依赖
