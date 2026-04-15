## 1. LICENSE_KEY_SECRET 注入与读取

- [x] 1.1 在 `cmd/server/main.go` 的 NORMAL MODE 分支中，将 `cfg.LicenseKeySecret` 以 `[]byte` 注入 IOC 容器（使用 `do.ProvideNamed` 或新增 provider）。
- [x] 1.2 修改 `internal/app/license/crypto.go` 的 `GetEncryptionKeyWithFallback`，使其优先读取已注入的 `license_key_secret`，仅当为空时才 fallback 到 `JWT_SECRET` SHA-256 派生。
- [x] 1.3 更新 `ProductService` / `LicenseService` 的 IOC 构造器，注入 `license_key_secret` 并传递给 `GetEncryptionKeyWithFallback`。

## 2. 升级许可事务一致性

- [x] 2.1 在 `internal/app/license/license_service.go` 中提取 `issueLicenseInTx(tx *gorm.DB, params IssueLicenseParams)`，将原 `IssueLicense` 的核心逻辑（校验、签名、创建记录、绑定注册码）移入该方法，保持 `tx` 内执行。
- [x] 2.2 重构 `IssueLicense` 为公开方法：开启事务 → 调用 `issueLicenseInTx` → 提交事务。
- [x] 2.3 重构 `UpgradeLicense`：开启外层事务 → 在 `tx` 内解绑注册码 → 调用 `issueLicenseInTx` → 吊销旧许可 → 写 `original_license_id` → 提交事务。

## 3. 批量重签功能修复

- [x] 3.1 修改 `internal/app/license/handler.go` 中的 `BulkReissueRequest`，移除 `binding:"required"` 或调整校验逻辑，允许空数组。
- [x] 3.2 修改 `internal/app/license/license_service.go` 的 `BulkReissueLicenses`：当 `ids` 为空时，自动查询该商品下 `key_version < current` 且 `status != revoked` 的所有许可并执行重签。
- [x] 3.3 验证前端 `pages/products/[id].tsx` 的 `bulkReissueMutation` 调用无需改动即可正常工作。

## 4. 约束编辑器 key 冲突修复

- [x] 4.1 修改 `web/src/apps/license/components/constraint-editor.tsx` 的 `useKeyCounter`，将初始计数替换为 `Date.now()` + `Math.random().toString(36).slice(2, 7)` 的前缀，确保 key 唯一。
- [x] 4.2 验证添加模块和添加特性时生成的 key 在组件重 mount 后不会重复。

## 5. 约束编辑器国际化补全

- [x] 5.1 在 `constraint-editor.tsx` 中引入 `useTranslation("license")`，将所有硬编码中文替换为对应翻译键调用（如 `t("license:constraints.addModule")`、`t("license:constraints.number")` 等）。
- [x] 5.2 确认 `web/src/apps/license/locales/zh-CN.json` 和 `en.json` 中 `constraints.*` 键已完整覆盖所有替换点，无需新增翻译内容。
- [x] 5.3 验证英文环境下编辑器无残留中文。

## 6. 代码清理与一致性

- [x] 6.1 删除 `internal/app/license/model.go` 中未使用的 `BusinessInfo` 结构体。
- [x] 6.2 删除 `internal/app/license/license_repository.go` 中未调用的 `FindExpired` 和 `UpdateInTx` 方法。
- [x] 6.3 将 `internal/app/license/service.go` 中的 `ErrInvalidConstraintValues` 错误消息前缀统一为 `error.license.invalid_constraint_values`。

## 7. 构建与验证

- [x] 7.1 执行 `go build -tags dev ./cmd/server/` 确保后端编译通过。
- [x] 7.2 执行 `cd web && bun run lint` 确保前端无 lint 错误。
- [x] 7.3 执行 `go test ./internal/app/license/...`（如有测试）验证相关逻辑。
