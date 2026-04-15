## 1. 后端 Model 补全

- [x] 1.1 在 `model_catalog.go` 的 `ServiceCatalog` struct 添加 `Code string` 字段（gorm tag: `size:64;uniqueIndex`）
- [x] 1.2 在 `ServiceCatalogResponse` 和 `ToResponse()` 中添加 `code` 字段
- [x] 1.3 在 `catalog_handler.go` 的 Create/Update 请求体中添加 `code` 字段，传递到 service 层

## 2. 后端两层限制

- [x] 2.1 在 `catalog_service.go` 的 Create 方法中添加层级校验：如果 parentId 指向的分类自身有 parent，则返回 400 错误

## 3. 后端 Seed 数据

- [x] 3.1 在 `seed.go` 中新增 `seedCatalogs(db *gorm.DB) error` 函数，定义 6 个一级域的 seed 数据（name、code、description、icon、sortOrder）
- [x] 3.2 在 `seedCatalogs` 中定义 18 条子分类的 seed 数据，使用父分类 code 查询 parentID 建立关联
- [x] 3.3 在 `seedITSM()` 中调用 `seedCatalogs(db)`，放在 `seedMenus` 之后

## 4. 前端类型和 API

- [x] 4.1 在 `api.ts` 的 `CatalogItem` 类型中添加 `code` 字段
- [x] 4.2 在创建/编辑 API 调用的请求体中添加 `code` 字段

## 5. 前端左右分栏布局

- [x] 5.1 重构 `catalogs/index.tsx`：移除原有单表格布局，改为 `flex gap-4` 左右分栏容器
- [x] 5.2 实现左侧面板（`w-72 shrink-0`）：Card 包裹的一级分类列表，每项显示 Lucide 图标 + 名称 + 子分类数量 badge，支持选中高亮
- [x] 5.3 实现右侧面板（`flex-1 min-w-0`）：顶部显示选中分类的名称 + 描述 + 编辑按钮 + "新增子分类"按钮，下方 Table 展示子分类列表（名称、编码、描述、状态、操作）
- [x] 5.4 添加选中状态管理：useState 存储当前选中的一级分类 ID，默认选中第一个，切换时右侧刷新
- [x] 5.5 处理空状态：无一级分类时全页面空状态提示；有一级分类但无子分类时右侧空状态提示
- [x] 5.6 左侧图标渲染：根据 icon 字段名动态渲染 Lucide 图标组件（使用 lucide-react 动态导入或映射表）

## 6. 前端表单更新

- [x] 6.1 Sheet 表单中添加 `code` 输入字段（编辑一级分类 / 新增子分类共用同一表单）
- [x] 6.2 Zod schema 添加 code 校验（必填，kebab-case 格式建议但不强制）

## 7. 前端 i18n

- [x] 7.1 在 `locales/zh-CN.json` 和 `locales/en.json` 中添加新增的翻译 key（code 字段标签、子分类相关文案、空状态提示）
