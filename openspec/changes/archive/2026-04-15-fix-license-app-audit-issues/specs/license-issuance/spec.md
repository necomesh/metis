## ADDED Requirements

### Requirement: Upgrade license
系统 SHALL 提供许可升级功能，通过 `POST /api/v1/license/licenses/:id/upgrade` 调用。升级流程 SHALL 在单一数据库事务内原子完成：解绑原许可的注册码（若与新注册码相同）→ 签发新许可 → 吊销原许可 → 在新许可记录中写入 `original_license_id` 指向原许可。

#### Scenario: 成功升级
- **WHEN** 对状态为 active/pending/expired 的许可提交升级请求（已发布商品、活跃授权主体、有效注册码）
- **THEN** 系统原子性地创建新 License 记录，吊销原许可，并正确绑定 original_license_id

#### Scenario: 升级已吊销的许可
- **WHEN** 对状态为 revoked 的许可执行升级
- **THEN** 系统返回 400 错误，提示"许可已吊销"

#### Scenario: 注册码复用
- **WHEN** 升级请求中的 RegistrationCode 与原许可相同
- **THEN** 系统先解绑原注册码，再将其绑定到新许可，保证注册码不重复绑定

### Requirement: Bulk reissue licenses
系统 SHALL 提供批量重签功能，通过 `POST /api/v1/license/products/:id/bulk-reissue` 调用。请求体 `licenseIds` 为待重签的许可 ID 数组。当 `licenseIds` 为空数组时，系统 SHALL 自动选择该商品下所有使用旧版本密钥的生效许可（非 revoked 状态）进行重签；当 `licenseIds` 非空时，仅处理指定 ID。

#### Scenario: 批量重签全部受影响许可
- **WHEN** 用户提交 `licenseIds: []` 的批量重签请求
- **THEN** 系统查询该商品下所有 key_version < 当前版本且 lifecycle_status != revoked 的许可，重新签名并更新 activationCode 和 signature，返回实际处理的条数

#### Scenario: 批量重签指定许可
- **WHEN** 用户提交非空的 `licenseIds` 数组
- **THEN** 仅对数组中指定的许可执行重签，跳过已吊销或属于其他商品的记录

#### Scenario: 批量重签超限
- **WHEN** 用户提交的 `licenseIds` 数组长度超过 100
- **THEN** 系统返回 400 错误，提示单次处理数量超限
