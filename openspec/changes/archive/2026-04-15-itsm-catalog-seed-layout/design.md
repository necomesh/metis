## Context

ITSM 服务目录管理页面当前采用单一树形表格布局（`catalogs/index.tsx`，358 行），所有层级混合展示。ServiceCatalog 模型在 spec 中定义了 `code` 字段但实际代码中尚未实现。Seed 数据只包含菜单、Casbin 策略、优先级和 SLA 模板，不含服务目录分类。

参照项目 bklite-cloud 已验证的方案：CSS Grid 左右分栏（300px | 1fr），左侧展示一级分类导航列表，右侧展示选中分类的子分类表格。严格两层结构。

## Goals / Non-Goals

**Goals:**
- ServiceCatalog 模型补全 `code` 字段（unique index），Response 类型同步更新
- Seed 函数 `seedCatalogs()` 内置 6 域 × 3 子类 = 18 条分类数据，使用 code 幂等
- 前端 catalogs 管理页面改为左右分栏布局
- 图标从 Ant Design 名映射到 Lucide 名

**Non-Goals:**
- 不 seed ServiceDefinition（后续单独做）
- 不调整 SLA 模板种子数据
- 不修改服务目录浏览页（用户提单入口）
- 不做三层及以上深度支持（严格两层）

## Decisions

### D1: code 字段实现

**选择**: 在 `ServiceCatalog` struct 添加 `Code string` 字段，GORM tag `size:64;uniqueIndex`。

**理由**: spec 中已定义该字段，目前是实现缺失。code 用于 seed 幂等检查（`db.Where("code = ?", code).First()`），也为未来 ServiceDefinition 绑定 catalog 提供稳定标识。GORM AutoMigrate 会自动添加列。

**替代方案**: 用 name 做幂等标识 — 不可靠，name 可能被用户修改。

### D2: Seed 数据编码规则

**选择**: 沿用 bklite-cloud 的 `domain:subdomain` 编码格式。

| 一级 code | 子类 code 示例 |
|-----------|---------------|
| `account-access` | `account-access:provisioning` |
| `workplace-support` | `workplace-support:endpoint` |
| `infra-network` | `infra-network:network` |
| `application-platform` | `application-platform:business-app` |
| `security-compliance` | `security-compliance:incident` |
| `monitoring-alerting` | `monitoring-alerting:onboarding` |

**理由**: 编码自描述、层级关系清晰、与参考项目一致便于后续迁移服务定义。

### D3: Seed 执行位置

**选择**: 在 `seedITSM()` 中调用 `seedCatalogs(db)`，放在 `seedMenus` 之后、`seedPriorities` 之前。

**理由**: 分类数据不依赖其他 seed，但其他 seed 可能未来依赖分类（如服务定义需要 catalog_id）。先建分类后建其他。

### D4: 前端左右布局方案

**选择**: Tailwind flex 布局（`flex gap-4`），左侧 `w-72 shrink-0`，右侧 `flex-1 min-w-0`。

```
┌──────────────────────────────────────────────────────┐
│  服务目录管理                              [+ 新增分类] │
├─────────────┬────────────────────────────────────────┤
│ 左侧 w-72   │  右侧 flex-1                           │
│ ┌─────────┐ │  ┌─────────────────────────────────┐  │
│ │ Card     │ │  │ 选中分类名 + 描述 + 编辑/新增子类 │  │
│ │          │ │  ├─────────────────────────────────┤  │
│ │ ● 账号权限│ │  │ Table: 子分类列表                 │  │
│ │ ○ 终端办公│ │  │ [名称] [编码] [状态] [操作]       │  │
│ │ ○ 基础设施│ │  │                                 │  │
│ │ ○ 应用平台│ │  └─────────────────────────────────┘  │
│ │ ○ 安全合规│ │                                      │
│ │ ○ 监控告警│ │                                      │
│ └─────────┘ │                                      │
└─────────────┴────────────────────────────────────────┘
```

**理由**: 与 bklite-cloud 的 grid 方案效果一致，但更符合 Metis 前端使用 Tailwind 的惯例。72 = 288px ≈ bklite-cloud 的 300px。

**替代方案**: CSS Grid `grid-template-columns: 300px 1fr` — 效果相同，但项目中 flex 模式更常见。

### D5: 图标映射

| bklite-cloud icon | Lucide icon | 用途 |
|-------------------|-------------|------|
| `safety` | `ShieldCheck` | 账号与权限 |
| `user` | `User` | 账号开通 |
| `lock` | `Lock` | 权限申请 |
| `safety-certificate` | `ShieldAlert` | 密码与MFA / 安全与合规 |
| `desktop` | `Monitor` | 终端与办公 / 电脑外设 |
| `appstore` | `LayoutGrid` | 办公软件 / 企业应用 |
| `video-camera` | `Video` | 打印与会议室 |
| `global` | `Globe` | 基础设施 / 网络VPN |
| `cloud-server` | `Server` | 服务器与主机 |
| `database` | `Database` | 存储备份 / 数据库 |
| `deployment-unit` | `Container` | 应用平台 / 发布变更 |
| `alert` | `Bell` | 监控告警 |
| `bug` | `Bug` | 漏洞基线 |
| `audit` | `FileSearch` | 审计合规 |
| `line-chart` | `LineChart` | 监控接入 |
| `notification` | `BellRing` | 告警治理 |
| `clock-circle` | `Clock` | 值班通知 |

## Risks / Trade-offs

- **[AutoMigrate 添加 unique index]** → 如果已有数据的 code 为空字符串，unique index 会冲突。缓解：AutoMigrate 先添加列（默认空），seed 时用 `Where("code = ?", code)` 幂等检查。已有空 code 记录不影响新增 seed 数据。用户需手动为已有记录补填 code。
- **[两层限制]** → 前端左右布局假定严格两层。如果用户手动创建三层分类，子分类的子分类不会在管理页面展示。缓解：创建时限制 parentId 只能选顶层分类（无 parent 的节点）。
- **[Seed 幂等]** → 用户可能修改 seed 创建的分类名称或图标。再次 sync 不会覆盖已有记录（只按 code 检查存在性）。这是符合预期的行为。
