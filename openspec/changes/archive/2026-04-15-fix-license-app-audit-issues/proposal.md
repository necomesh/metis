## Why

License App 在代码审查中暴露出多处实现与规范不一致的问题：`LICENSE_KEY_SECRET` 存在但未被使用（实际仍用 `JWT_SECRET` 派生）、升级许可时事务断裂可能导致注册码悬空、批量重签功能因前端传空数组而 400 失败、约束编辑器硬编码中文且存在 key 重复冲突。这些问题影响安全性、数据一致性和国际化体验，需要集中修复。

## What Changes

- **修复私钥加密密钥来源**：让 License App 真正读取 `license_key_secret`（`config.yml` / `metis.yaml`）并优先用于 AES-256-GCM 加密 Ed25519 私钥；保持 `JWT_SECRET` 仅作为降级 fallback。
- **修复升级许可事务一致性**：将解绑注册码、签发新许可、吊销旧许可、写入 `original_license_id` 打包为单一数据库事务。
- **修复批量重签功能**：支持 `licenseIds: []` 表示"重签全部受影响许可"，前端在密钥轮转后可直接一键重签，无需手动枚举 ID。
- **修复约束编辑器 key 重复**：为 key 生成器引入基于时间戳+随机数的唯一前缀，避免组件重 mount 后生成重复 key。
- **补全约束编辑器国际化**：将硬编码中文全部替换为 `license:constraints.*` 翻译键，复用已存在的 `zh-CN.json` / `en.json` 资源。
- **清理死代码**：移除未使用的 `BusinessInfo` 结构体、未调用的 `FindExpired` 与 `UpdateInTx` 方法，统一错误消息前缀格式。

## Capabilities

### New Capabilities
- （无新增能力，全部为缺陷修复）

### Modified Capabilities
- `license-product`: 修正私钥加密密钥的获取方式——从 IOC 读取 `license_key_secret`（`MetisConfig.LicenseKeySecret`），恢复与 spec 一致的行为。
- `license-issuance`: 修正 `UpgradeLicense` 事务边界；修正 `BulkReissueLicenses` 语义，允许空 `licenseIds` 代表"全部受影响许可"。
- `license-product-ui`: 约束编辑器需支持唯一 key 生成和完整 i18n 翻译键调用。

## Impact

- 后端：`internal/app/license/crypto.go`、`service.go`、`license_service.go`、`handler.go`、`license_handler.go`、`model.go`、`license_repository.go`
- 后端 IOC 注册：`cmd/server/main.go`（需注入 `LicenseKeySecret`）
- 前端：`web/src/apps/license/components/constraint-editor.tsx`、`pages/products/[id].tsx` 及相关 locales
- 行为变更：现有已加密私钥不受影响（它们仍可用旧的 fallback 密钥解密），但新创建/轮转的密钥将使用正确的 `license_key_secret`。
