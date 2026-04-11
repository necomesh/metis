## 1. P0 — React Compiler 违规修复

- [x] 1.1 修复 `web/src/pages/install/index.tsx` 中的 IIFE：将 `const stepContent = (() => { switch... })()` 改为 `let stepContent; switch(...) { ... }` 或提取为普通函数
- [x] 1.2 修复 `web/src/pages/roles/permission-dialog.tsx` 中两处 JSX 内 IIFE（约 line 268 和 295）：将 icon 变量提取到 map callback 的 JSX return 之前

## 2. P1 — JIT Provisioning 统一

- [x] 2.1 在 `internal/service/auth.go` 中新增 `ExternalUserParams` 结构体和 `ProvisionExternalUser(params ExternalUserParams) (*model.User, error)` 方法，提取 `OAuthLogin` 中的 find-or-create 逻辑
- [x] 2.2 重构 `AuthService.OAuthLogin` 调用 `ProvisionExternalUser` 替代内联 provisioning 逻辑
- [x] 2.3 重构 `IdentitySourceService.jitProvisionLDAP` 调用 `AuthService.ProvisionExternalUser`（通过 IOC 注入 AuthService）
- [x] 2.4 将 `SSOHandler.jitProvision` 逻辑替换为调用 `AuthService.ProvisionExternalUser`，移除 `SSOHandler` 对 `userRepo`、`connRepo`、`roleRepo` 的直接依赖
- [x] 2.5 删除 `handler/sso.go` 中的 `jitProvision` 方法和 `extractDomain` 死代码
- [x] 2.6 修复 `handler/sso.go` 中直接检查 `gorm.ErrRecordNotFound` 的问题：在 `IdentitySourceService` 中添加 sentinel error 并在 handler 中使用 `errors.Is()`

## 3. P1 — 安全相关错误处理补全

- [x] 3.1 `service/role.go:125-126,158`：将 Casbin 策略更新的 `_ =` 改为 `if err := ...; err != nil { slog.Error("failed to update casbin policy", "error", err) }`
- [x] 3.2 `service/user.go:233`：将用户停用时 token 吊销的 `_ =` 改为带 `slog.Error` 的错误日志

## 4. P2 — IOC 注册去重

- [x] 4.1 在 `cmd/server/` 下新建 `providers.go`，提取 `registerKernelProviders()` 函数，接受注册函数参数以区分 `do.Provide` 和 `do.Override`
- [x] 4.2 重构 `cmd/server/main.go` 调用 `registerKernelProviders()` 替代内联 `do.Provide` 块
- [x] 4.3 重构 `internal/handler/install.go:hotSwitch` 调用 `registerKernelProviders()` 替代内联 `do.Override` 块
- [x] 4.4 修改 `install.go` 的 admin 创建逻辑：改用 `do.MustInvoke[*service.UserService](injector).Create(...)` 替代 `db.DB.Create(admin)`

## 5. P2 — Recovery 中间件响应格式统一

- [x] 5.1 修改 `internal/middleware/recovery.go`：panic 时返回 `handler.R{Code: -1, Message: "internal server error"}` 替代 `{"error": "..."}` 裸 JSON

## 6. P2 — 前端代码重复修复

- [x] 6.1 在 `web/src/lib/constants.ts`（或 `api.ts` 顶部）提取 localStorage token key 为共享常量 `TOKEN_KEY` 和 `REFRESH_KEY`，`stores/auth.ts` 和 `lib/api.ts` 统一引用
- [x] 6.2 重构 `lib/api.ts` 中 `download()` 的 409 处理逻辑，复用 `request()` 中的实现（提取为共享辅助函数）
- [x] 6.3 清理 `handler/auth.go` 中的死代码：移除 `connResps` 变量（line 218-226）和 `ListByUser` 双重调用（line 480-488）

## 7. P2 — 后端小修

- [x] 7.1 统一 `service/user.go` 中 `Activate`/`Deactivate` 方法：更新后调用 `FindByID` reload 模型再返回（与 `Create`/`Update` 一致）
- [x] 7.2 `LicenseRepo.List`：提取 filter 条件构建为共享变量，count 查询和 data 查询复用

## 8. P3 — 低优先级改进

- [x] 8.1 重构 `web/src/pages/audit-logs/auth-tab.tsx` 使用 `useListPage` hook 替代手动分页逻辑
- [x] 8.2 编译验证：运行 `go build -tags dev ./cmd/server/` 确认后端编译通过
- [x] 8.3 前端验证：运行 `cd web && bun run lint` 确认无 ESLint 错误
