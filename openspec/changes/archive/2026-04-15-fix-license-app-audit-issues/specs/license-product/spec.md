## MODIFIED Requirements

### Requirement: Ed25519 密钥对管理
系统 SHALL 为每个商品维护 Ed25519 签名密钥对。私钥 SHALL 使用 AES-256-GCM 加密后存储，加密密钥来源：优先 `MetisConfig.LicenseKeySecret`（即 `config.yml` / `metis.yaml` 中的 `license_key_secret`），当该字段为空时 fallback 到从 `JWT_SECRET` 做 SHA-256 派生。公钥以 base64 编码明文存储。

#### Scenario: 创建商品自动生成密钥对
- **WHEN** 商品创建成功且 `license_key_secret` 已配置
- **THEN** 自动生成 Ed25519 密钥对，version=1，isCurrent=true，私钥使用 `license_key_secret` 加密存储

#### Scenario: 缺少加密密钥
- **WHEN** `license_key_secret` 和 `JWT_SECRET` 均未设置
- **THEN** 创建商品时返回 500 错误，提示缺少加密配置

#### Scenario: 密钥轮转
- **WHEN** 用户请求对商品执行密钥轮转
- **THEN** 在事务中：旧密钥 isCurrent 置为 false 并设 revokedAt，生成新密钥 version=旧版本+1、isCurrent=true，私钥仍使用当前 `license_key_secret` 加密

#### Scenario: 获取当前公钥
- **WHEN** 用户请求商品的当前公钥
- **THEN** 系统返回 isCurrent=true 的密钥的 publicKey 和 version
