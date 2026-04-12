## 0. Bug 修复：恢复 index 节点 + 图例

- [x] 0.1 后端 `GetFullGraph` 去掉 index 节点过滤逻辑，恢复为返回全部节点和边
- [x] 0.2 前端 KnowledgeGraphView 恢复 index 节点图例（概念 + 索引）

## 1. i18n 补充

- [x] 1.1 在 `en.json` 和 `zh-CN.json` 的 `knowledge` 下新增 `recall` 子对象：`recall.title`、`recall.searchPlaceholder`、`recall.search`、`recall.empty`、`recall.noResults`、`recall.edgeCount`、`recall.viewContent`、`recall.hideContent`
- [x] 1.2 新增 `knowledge.nodes.sources`（来源）、`knowledge.nodes.viewSource`（查看来源）相关 i18n 键

## 2. 节点穿透到 raw 来源

- [x] 2.1 前端 NodeItem 接口新增 `sourceIds: number[]` 字段
- [x] 2.2 图谱视图：点击节点的详情面板中，展示该节点关联的来源列表（从已缓存的 sources 数据中按 sourceIds 匹配），显示来源 title + format，可点击展开查看来源的 raw content
- [x] 2.3 表格视图：NodeRow 展开区域除了展示节点 content 外，增加「来源」区块，列出 sourceIds 对应的来源 title

## 3. RecallPanel 组件

- [x] 3.1 在 `[id].tsx` 中新增 `RecallPanel({ kbId, onHighlight })` 组件：搜索输入框 + 搜索按钮，调用 `GET /api/v1/ai/knowledge-bases/${kbId}/nodes?keyword=${query}&pageSize=20`
- [x] 3.2 搜索结果渲染为卡片列表：标题、摘要（line-clamp-2）、关联数
- [x] 3.3 每张卡片支持展开/折叠：展开时调 `GET /knowledge-bases/${kbId}/nodes/${nid}` 获取完整 content，用 pre 块展示
- [x] 3.4 搜索结果变化时，调用 `onHighlight(nodeIds: Set<number>)` 通知父组件；面板关闭时调用 `onHighlight(new Set())`
- [x] 3.5 空查询不发请求；无结果时展示空状态

## 4. KnowledgeGraphTab 布局重构

- [x] 4.1 KnowledgeGraphTab 新增 `compileMethod` prop，新增 `recallOpen` 状态和 `highlightedNodeIds` 状态
- [x] 4.2 重构布局为 flex 左右分栏：左侧 `flex-1 min-w-0` 放图谱/表格，右侧条件渲染 RecallPanel（`w-80`，带 `transition-all duration-300`）
- [x] 4.3 toolbar 区域右侧新增「召回测试」按钮（FlaskConical 图标），切换 recallOpen 状态
- [x] 4.4 `compileMethod !== "knowledge_graph"` 时，隐藏图谱视图按钮，只显示表格视图

## 5. 图谱高亮联动

- [x] 5.1 KnowledgeGraphView 新增 `highlightedNodeIds` prop
- [x] 5.2 在 `nodeCanvasObject` 中，命中节点绘制绿色外环（区别于选中节点的橙色）
- [x] 5.3 面板关闭时清除 highlightedNodeIds

## 6. 集成与验证

- [x] 6.1 Component 页面传递 `compileMethod={kb.compileMethod}` 给 KnowledgeGraphTab
- [x] 6.2 `go build -tags dev ./cmd/server/` 编译通过
- [x] 6.3 `cd web && bun run lint` 无新增 error
