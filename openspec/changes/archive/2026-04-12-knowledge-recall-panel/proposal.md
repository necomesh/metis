## Why

知识库编译完成后，用户需要一种方式来验证知识召回的质量——输入一段查询文本，看看能命中哪些知识节点。当前知识库详情页只有图谱/表格浏览，缺少即时测试召回效果的入口。后端搜索 API 已就绪（`GET /ai/knowledge/search`），只需要前端面板对接。

## What Changes

- 知识库详情页「知识图谱」tab 右侧新增可收起的**召回测试面板**
  - 输入框 + 搜索按钮，调用现有 search API
  - 搜索结果列表：标题、摘要、关联数，可展开查看完整 content
  - 搜索结果与图谱视图联动——命中的节点在力导向图上高亮标记
- 面板默认收起，点击按钮展开（左侧图谱区域自适应收窄）
- UI 根据 `compileMethod` 条件渲染：`knowledge_graph` 显示图谱+表格+召回面板；其他方法（未来）可切换为纯表格+不同召回形态
- 补充 i18n（中英文）

## Capabilities

### New Capabilities
- `knowledge-recall-panel`: 知识库召回测试面板 — 右侧可收起面板，搜索查询、结果展示、图谱高亮联动

### Modified Capabilities

（无现有 spec 需修改，search API 已存在，无需后端改动）

## Impact

- **前端**: `web/src/apps/ai/pages/knowledge/[id].tsx` — 主要改动文件，新增 RecallPanel 组件、图谱高亮逻辑
- **i18n**: `en.json` / `zh-CN.json` 新增 `knowledge.recall.*` 键
- **后端**: 无改动（复用现有 `GET /api/v1/ai/knowledge/search` 和 `GET /api/v1/ai/knowledge-bases/:id/nodes/:nid`）
- **依赖**: 无新增
