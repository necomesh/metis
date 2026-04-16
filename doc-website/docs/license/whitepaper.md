---
title: 许可管理产品白皮书
sidebar_label: 产品白皮书
sidebar_position: 1
---

# Metis 许可管理系统产品白皮书

## 1. 产品概述

Metis 许可管理（License App）是一套面向 B2B 软件发行商的数字许可证生命周期管理平台。它基于现代密码学（Ed25519 数字签名 + AES-GCM 加密）构建，支持从产品设计、套餐定义、授权主体管理到许可证签发、续期、升级、吊销的完整闭环运营。许可管理模块既可作为 Metis 全功能版的一部分运行，也可通过 `edition_license` 独立编译为轻量级许可服务。

## 2. 核心概念与数据模型

系统围绕六个核心实体构建，形成清晰的「产品 → 套餐 → 注册码 → 授权主体 → 许可证」业务链路。

```
┌─────────────────────────────────────────────────────────────────┐
│                        许可管理业务链路                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐      ┌──────────┐      ┌──────────────┐         │
│   │ Product  │◄─────│   Plan   │      │ Licensee     │         │
│   │ (商品)   │      │ (套餐)   │      │ (授权主体)    │         │
│   └────┬─────┘      └────┬─────┘      └──────┬───────┘         │
│        │                 │                   │                 │
│        │   ConstraintSchema / Values         │                 │
│        │                 │                   │                 │
│        └─────────────────┴───────────────────┘                 │
│                          │                                      │
│                          ▼                                      │
│                   ┌─────────────┐                               │
│                   │   License   │◄──── LicenseRegistration      │
│                   │  (许可证)    │      (注册码绑定)             │
│                   └─────────────┘                               │
│                                                                 │
│   ┌─────────────┐      ┌─────────────┐                          │
│   │ ProductKey  │      │   .lic File │  ← 离线激活文件          │
│   │ (Ed25519)   │      │  AES-GCM    │                          │
│   └─────────────┘      └─────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Product（商品/产品）

定义被许可的软件或服务实体。

| 属性 | 说明 |
|------|------|
| `Code` | 全局唯一标识（如 `metis-enterprise`） |
| `Name` | 产品名称 |
| `Status` | `unpublished` / `published` / `archived`，仅发布状态可签发许可 |
| `ConstraintSchema` | 能力约束模式（JSON），定义产品的可售能力维度 |

**约束模式（Constraint Schema）** 采用模块-特性两级结构，用于描述软件的授权能力边界：

- **模块（Module）**：按功能域划分（如 `ai`、`node`、`storage`）
- **特性（Feature）**：模块下的具体指标，支持三种类型：
  - `number`：数值型（可配置 `min/max`），如最大节点数 100
  - `enum`：枚举型，如部署模式 `saas` / `on-premise`
  - `multiSelect`：多选型，如启用的插件列表

### 2.2 Plan（套餐）

隶属于产品的预置配置模板，将 `ConstraintValues` 打包为可快速选择的销售单元。支持设置默认套餐（`isDefault`），简化签发流程。

### 2.3 Licensee（授权主体）

即被许可方（客户/租户）。系统自动生成 `LS-` 前缀的唯一编码（如 `LS-aB3dEf9Gh2Jk`），确保在许可文件中的匿名性与可追溯性。

### 2.4 LicenseRegistration（注册码）

用于客户身份预注册的凭证，支持：

- **预注册**：管理员手动录入注册码，分发给客户
- **自动生成**：系统随机生成 `RG-` 前缀的 16 位注册码
- **绑定机制**：注册码在许可签发时与许可证一对一绑定，防止重复使用
- **过期清理**：未绑定且过期的注册码由定时任务自动回收

### 2.5 License（许可证）

核心业务实体，记录一次完整的授权行为：

| 属性 | 说明 |
|------|------|
| `ProductID` / `LicenseeID` / `PlanID` | 关联关系 |
| `RegistrationCode` | 客户注册码，用于激活和文件解密 |
| `ConstraintValues` | 实际生效的能力约束值 |
| `ValidFrom` / `ValidUntil` | 有效期起止 |
| `ActivationCode` | 含签名 Payload 的 Base64URL 字符串，客户端离线校验使用 |
| `KeyVersion` | 签名所用产品密钥版本，支持密钥轮换追溯 |
| `Status` | `issued` / `revoked` |
| `LifecycleStatus` | `pending` → `active` → `expired` / `suspended` / `revoked` |
| `OriginalLicenseID` | 升级场景下指向原许可证 |

### 2.6 ProductKey（产品密钥对）

每个产品创建时自动生成 Ed25519 密钥对：

- **公钥（PublicKey）**：明文存储，随许可文件分发给客户端用于验证
- **私钥（EncryptedPrivateKey）**：AES-GCM 加密后存储，仅服务端用于签发许可
- **版本（Version）**：从 1 开始递增，旧版本标记为 `revoked`

## 3. 安全与密码学设计

### 3.1 许可证签名流程

```
Payload (canonical JSON)
    ├── v: 1                    # 协议版本
    ├── pid: <product_code>     # 产品码
    ├── lic: <licensee_code>    # 被许可方码
    ├── licn: <licensee_name>   # 被许可方名称
    ├── reg: <registration_code># 注册码
    ├── con: {module: {feature: value}}  # 能力约束
    ├── iat: <issued_at_unix>   # 签发时间
    ├── nbf: <valid_from_unix>  # 生效时间
    ├── exp: <valid_until_unix> # 过期时间（可选）
    └── kv: <key_version>       # 密钥版本

SignLicense(Payload, EncryptedPrivateKey, encKey)
    → Ed25519 Signature (base64url)

ActivationCode = base64url( JSON( Payload + sig ) )
```

**关键点**：
- Payload 使用 **Canonical JSON**（递归排序键名），确保跨平台签名验证的一致性。
- 采用 **Ed25519** 非对称签名，私钥不离开服务端，客户端仅凭公钥即可离线验证。

### 3.2 密钥安全存储

```
私钥加密密钥 = SHA256( licenseKeySecret || jwtSecret )
EncryptedPrivateKey = AES-GCM( base64(privateKey), 私钥加密密钥 )
```

- `licenseKeySecret` 优先于 `jwtSecret` 作为熵源，配置在 `metis.yaml` 中。
- 即使数据库泄露，私钥仍受 AES-GCM 保护。

### 3.3 许可文件导出加密

导出的 `.lic` 文件并非裸 JSON，而是经过二次 AES-GCM 加密：

```
fileToken = normalize(产品名) + "."
fileKey   = SHA256( fileToken + ":" + registrationCode )
.lic内容 = fileToken + base64url( AES-GCM( JSON(activationCode + publicKey), fileKey ) )
```

- 解密密钥由「产品标识 + 客户注册码」共同派生，实现**一客一密**。
- 即使许可文件被截获，无对应注册码无法解密。

## 4. 许可证生命周期管理

```
                          ┌─────────────┐
                          │   Pending   │
                          │  (待生效)   │
                          └──────┬──────┘
                                 │ validFrom到达
                                 ▼
┌──────────┐   renew    ┌─────────────┐   suspend   ┌─────────────┐
│ Expired  │◄───────────│    Active   │────────────►│  Suspended  │
│ (已过期) │            │  (生效中)   │             │  (已暂停)   │
└──────────┘            └──────┬──────┘             └──────┬──────┘
      ▲                        │                           │
      │                        │        revoke             │ reactivate
      │                        ▼                           │
      │                 ┌─────────────┐◄───────────────────┘
      │                 │   Revoked   │
      └─────────────────│  (已吊销)   │
            (upgrade)   └─────────────┘
```

| 操作 | 说明 | 业务规则 |
|------|------|----------|
| **Issue（签发）** | 为指定客户生成新许可证 | 产品必须 published；客户必须 active；注册码不可重复绑定 |
| **Renew（续期）** | 延长有效期 | 不可对 revoked 许可操作；仅更新 `validUntil` 和生命周期状态 |
| **Upgrade（升级）** | 变更套餐/约束值后签发新证 | 自动吊销原许可证并解绑注册码；新证记录 `originalLicenseID` |
| **Suspend（暂停）** | 临时冻结许可证效力 | active/pending 可暂停；已 revoked 不可暂停 |
| **Reactivate（恢复）** | 解除暂停状态 | 仅 suspended 可恢复；恢复后按有效期重新计算实际状态 |
| **Revoke（吊销）** | 永久终止许可证 | 不可逆；已吊销许可不可导出 `.lic` 文件 |

**自动状态流转**：系统每日 02:00 执行 `license-expired-check` 任务，将 `validUntil` 已到达的 `pending` / `active` 许可自动标记为 `expired`。

## 5. 密钥轮换（Key Rotation）

当怀疑私钥泄露或需要定期安全策略更新时，可执行密钥轮换：

1. 生成新的 Ed25519 密钥对（Version + 1）
2. 旧密钥标记为 `isCurrent=false`，记录 `revokedAt`
3. 新密钥成为当前签名密钥
4. 系统评估受影响许可数量（`RotateKeyImpact`）
5. 管理员执行 **Bulk Reissue（批量重发）**，用新密钥重新签名旧许可（最多 100 条/次）

此设计保证了：
- **前向安全**：旧密钥吊销后不再用于新签发
- **平滑过渡**：已发放的许可证可通过批量重发无缝升级到新密钥版本

## 6. 系统架构与集成

### 6.1 模块定位

许可管理是 Metis 可插拔 App 架构中的一员，位于 `internal/app/license/`。

```
┌────────────────────────────────────┐
│           Metis Kernel             │
│  (用户 / 角色 / 菜单 / 审计 / 任务)  │
└──────────────┬─────────────────────┘
               │
               ▼
      ┌────────────────┐
      │   License App  │
      │  许可生命周期管理 │
      └────────────────┘
```

### 6.2 自动化运维能力

许可管理内置后台任务引擎，确保授权状态的持续一致性：

- **过期自动检测**：系统定期扫描所有生效中的许可证，一旦超过 `validUntil` 即自动标记为过期，无需人工干预。
- **注册码自动回收**：对长期未绑定且已过期的注册码进行清理，保持注册码池的整洁可用。

### 6.3 权限与审计

- 完整的 **RBAC + Casbin** 策略覆盖，管理员角色默认拥有全部权限。
- 所有变更操作（签发、吊销、续期、升级、暂停、恢复、密钥轮换、批量重发）均记录 **审计日志**，包含操作人、资源类型、资源 ID 和变更摘要。

## 7. 客户端集成建议

### 7.1 离线验证流程

1. 部署时读取 `.lic` 文件和注册码
2. 用注册码 + 文件前缀派生密钥，AES-GCM 解密得到 `{activationCode, publicKey}`
3. Base64URL 解码 `activationCode` 得到 `{payload, sig}`
4. 用 `publicKey` 验证 Ed25519 签名
5. 校验 `nbf`（生效时间）和 `exp`（过期时间）
6. 读取 `con`（约束值）并强制执行能力边界

### 7.2 运行时检查

建议客户端在启动和关键功能入口定期执行：
- 签名有效性校验
- 有效期校验
- 约束值（如最大节点数、功能开关）校验

## 8. 产品优势总结

1. **密码学级安全**：Ed25519 非对称签名 + AES-GCM 双层加密，私钥不出服务端。
2. **灵活的能力模型**：模块-特性两级约束 Schema，支持数值、单选、多选三种能力维度。
3. **完整的生命周期**：签发、续期、升级、暂停、恢复、吊销、自动过期，覆盖全运营场景。
4. **密钥可轮换**：支持版本化密钥管理和批量重发，满足合规和安全策略要求。
5. **一客一密导出**：许可文件与注册码强绑定，防止文件泄露导致的非法扩散。
6. **离线激活友好**：激活码内含完整签名 Payload，客户端可在完全离线环境下完成验证。
7. **可独立部署**：支持 `edition_license` 裁剪编译，作为轻量级许可服务器独立运行。

## 9. 适用场景

- SaaS / 私有化部署软件的商业授权管理
- 插件、模块、功能开关的按能力分级售卖
- 需要严格离线验证的嵌入式软件、IoT 设备授权
- 多租户场景下的客户级许可证生命周期运营
