## Context

License App 在实现层面与既有 spec 存在多处偏离：
1. `crypto.go` 的注释承诺优先使用 `LICENSE_KEY_SECRET`，但实现中只接收 `jwtSecret` 参数，导致始终用 `sha256(JWTSecret)` 加密私钥。
2. `UpgradeLicense` 先在外层调用 `UnbindLicenseInTx(s.db.DB, ...)`（非事务），再调用内部自行开事务的 `IssueLicense`，两段事务无法回滚一致。
3. 前端批量重签始终传 `{licenseIds: []}`，但后端 `BulkReissueRequest` 有 `binding:"required"`，空 slice 触发 400。
4. 约束编辑器的 `useKeyCounter` 从 0 开始计数，组件重 mount 后生成重复的 module/feat key。
5. 约束编辑器 UI 文本全部硬编码中文，虽然 `zh-CN.json`/`en.json` 已备齐翻译键，但代码中未使用。

## Goals / Non-Goals

**Goals:**
- 让 License App 正确使用 `config.yml`/`metis.yaml` 中的 `license_key_secret` 作为私钥加密密钥。
- 修复 `UpgradeLicense` 的事务一致性，避免注册码悬空。
- 修复批量重签功能，使其支持"一键重签全部受影响许可"。
- 消除约束编辑器的 key 冲突和国际化硬编码问题。
- 清理死代码并统一错误前缀。

**Non-Goals:**
- 不修改许可证签名算法（仍使用 Ed25519 + canonicalization）。
- 不改变现有数据库表结构。
- 不新增业务功能（如新的许可生命周期状态）。

## Decisions

### 1. LICENSE_KEY_SECRET 的注入方式
- **决策**：在 `cmd/server/main.go` 中，将 `cfg.LicenseKeySecret` 以 `[]byte` 形式注入 IOC 容器，key 名为独立的类型或 tag（如 `do.ProvideNamed` 或新增 provider）。License App 的 `crypto.go` 修改为从 IOC 读取该值，fallback 到 `JWTSecret`。
- **理由**：`license_key_secret` 已在 `MetisConfig` 中定义且安装向导会自动生成，只需补齐 IOC 注册即可。保持向后兼容：若配置文件较旧缺少该字段，fallback 机制仍可用。
- **替代方案**：在 `crypto.go` 中直接读环境变量 `LICENSE_KEY_SECRET`。拒绝原因：项目统一使用 `config.yml` 管理密钥，不依赖环境变量。

### 2. UpgradeLicense 事务设计
- **决策**：在 `LicenseService` 中新增一个内部方法 `issueLicenseInTx(tx *gorm.DB, ...)`，让 `IssueLicense` 和 `UpgradeLicense` 共享同一套签发逻辑。`UpgradeLicense` 自己开启外层事务，将"解绑注册码 → 调用 issueLicenseInTx → 吊销旧许可 → 写 original_license_id" 全部包在同一个 `db.Transaction` 中。
- **理由**：避免代码重复，同时保证原子性。
- **替代方案**：在 `IssueLicense` 外部再包一层事务（嵌套事务）。拒绝原因：GORM 不支持真正的嵌套事务， savepoint 语义复杂，直接抽离 in-tx 方法更清晰。

### 3. 批量重签语义
- **决策**：`POST /api/v1/license/products/:id/bulk-reissue` 支持 `licenseIds: []`（空数组）表示"重签该商品下所有使用旧版本密钥的生效许可"。后端在 handler 层将空数组解释为"查询所有受影响记录"。
- **理由**：前端当前行为就是传空数组，且用户期望的是"一键全签"而非手动选择 ID。移除 `binding:"required"` 不够，因为空数组仍需有明确语义。
- **替代方案**：前端先调一个 API 获取受影响列表，再传具体 IDs。拒绝原因：增加不必要的往返，且用户场景明确为"全部"。

### 4. 约束编辑器 key 生成策略
- **决策**：将 `useKeyCounter` 的初始值改为基于 `Date.now()` + `Math.random()` 的前缀，例如 `module_${Date.now()}_${rand}`，确保即使组件重 mount 也不会重复。
- **理由**：简单、无服务端依赖、冲突概率可忽略。
- **替代方案**：用服务端返回的 product 最大 key 索引。拒绝原因：schema 是数组，没有持久化 key 索引字段，此方案过度设计。

### 5. 国际化硬编码修复
- **决策**：将 `constraint-editor.tsx` 中所有硬编码中文字符串替换为 `useTranslation("license")` 调用，复用 `constraints.*` 命名空间下已定义的翻译键。不改动翻译文件内容（`zh-CN.json`/`en.json` 中已有对应键）。
- **理由**：零新增资源，纯代码修正。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 修复 LICENSE_KEY_SECRET 后，旧环境已生成的加密私钥是否还能解密？ | `GetEncryptionKeyWithFallback` 保持 fallback 逻辑：若 `license_key_secret` 为空，仍用 `JWT_SECRET` 派生。因此旧数据可解密，新数据使用新密钥。 |
| `UpgradeLicense` 抽离 `issueLicenseInTx` 可能引入回归 | 保持原有 payload 构建和签名逻辑不变，仅将 `db.Create` 和 `regRepo.UpdateBoundLicenseInTx` 移入事务内。 |
| 批量重签空数组语义与未来"按 ID 重签"需求冲突 | 保留 `licenseIds` 字段，当 `len > 0` 时仍按原逻辑处理指定 ID；仅当 `len == 0` 时触发"全部"语义。 |

