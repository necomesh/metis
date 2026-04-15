## Why

ITSM 服务目录当前为空白——没有内置分类数据，用户需要从零手动创建。同时目录管理页面采用单一树形表格布局，在分类较多时不够直观。需要参照 bklite-cloud 已验证的方案，内置 6 大域 18 个标准分类作为开箱即用的种子数据，并将管理页面改为左右分栏布局（左侧一级分类导航 + 右侧子分类管理），提升可用性。

## What Changes

- **Model 新增 `code` 字段** — `ServiceCatalog` 增加 `code string`（unique index），作为分类的稳定标识，用于 seed 幂等和未来服务绑定
- **Seed 内置 18 条服务目录分类** — 6 个一级域（账号与权限、终端与办公、基础设施与网络、应用与平台、安全与合规、监控与告警），每域 3 个子分类，沿用 bklite-cloud 的 `domain:subdomain` 编码规则
- **前端左右分栏布局** — catalogs 管理页面改为左侧固定宽度面板展示一级分类列表，右侧展示选中分类的子分类表格和 CRUD 操作
- **图标映射** — 将 bklite-cloud 的 Ant Design 图标名转换为 Metis 使用的 Lucide 图标名

## Capabilities

### New Capabilities

（无新增 capability）

### Modified Capabilities

- `itsm-service-catalog`: 新增 `code` 字段要求；新增种子数据要求；前端布局从树形表格改为左右分栏

## Impact

- **后端 Model**: `itsm_service_catalogs` 表新增 `code` 列（GORM AutoMigrate 自动处理）
- **后端 Seed**: `seed.go` 新增 `seedCatalogs()` 函数
- **后端 API**: CatalogResponse 增加 `code` 字段返回
- **前端页面**: `web/src/apps/itsm/pages/catalogs/index.tsx` 重构布局
- **前端类型**: `api.ts` 中 CatalogItem 增加 `code` 字段
- **无 Breaking Change**: code 字段有默认空值，已有数据不受影响
