## Context

知识库详情页（`[id].tsx`）的「知识图谱」tab 当前有图谱视图和表格视图，但缺少验证召回效果的入口。后端已有两套搜索能力：
- **Agent API**: `GET /ai/knowledge/search`（NodeToken 鉴权，供 Sidecar 用）
- **管理 API**: `GET /ai/knowledge-bases/:id/nodes?keyword=xxx`（JWT+Casbin 鉴权）

前端管理界面走 JWT 鉴权，应复用管理 API。

当前组件层次：
```
Component (page)
  └─ Tabs
      ├─ SourcesTab
      ├─ KnowledgeGraphTab({ kbId })
      │    ├─ toggle: graph | table
      │    ├─ KnowledgeGraphView  ← 力导向图 (react-force-graph-2d)
      │    └─ NodeTableView       ← 节点表格
      └─ CompileLogsTab
```

## Goals / Non-Goals

**Goals:**
- 在知识图谱 tab 内新增可收起的右侧召回测试面板
- 输入查询 → 展示匹配节点列表 → 可展开查看完整 content
- 搜索命中的节点在图谱视图上高亮
- 面板展开/收起时图谱区域自适应宽度
- UI 结构为多编译方法预留（当前只实现 `knowledge_graph`）

**Non-Goals:**
- 不新增后端 API（复用 `GET /knowledge-bases/:id/nodes?keyword=xxx` + `GET /knowledge-bases/:id/nodes/:nid`）
- 不实现向量语义搜索（当前是关键词 LIKE 匹配）
- 不实现其他编译方法的召回面板变体
- 不改动 Agent 查询 API

## Decisions

### 1. 复用管理端 nodes API 做搜索

**选择**: `GET /api/v1/ai/knowledge-bases/${kbId}/nodes?keyword=${q}&pageSize=20`

**替代方案**: 调用 `/ai/knowledge/search?q=xxx&kb_id=1`

**理由**: search API 走 NodeToken 鉴权（供 Agent/Sidecar 用），管理端走 JWT+Casbin。复用 nodes 列表接口最简单，已有 keyword 过滤，无需后端改动。

### 2. 面板布局：flex 左右分栏

**选择**: KnowledgeGraphTab 改为 flex 布局，左侧放图谱/表格（`flex-1`），右侧放召回面板（固定宽度 `w-80`，可收起为 0）。

```
┌────────────────────────────────┬──────────────┐
│  toggle 按钮    [🧪 召回测试]   │              │
├────────────────────────────────┤  RecallPanel  │
│                                │  w-80         │
│  KnowledgeGraphView            │  ┌──────────┐│
│  or NodeTableView              │  │ 搜索输入  ││
│  (flex-1, 自适应宽度)           │  ├──────────┤│
│                                │  │ 结果列表  ││
│                                │  │ 可展开    ││
│                                │  └──────────┘│
└────────────────────────────────┴──────────────┘
```

面板收起时，右侧宽度为 0，`transition-all` 过渡动画。图谱的 ResizeObserver 自动感知宽度变化并重新渲染。

### 3. 图谱高亮联动

**选择**: KnowledgeGraphTab 持有 `highlightedNodeIds: Set<number>` 状态，RecallPanel 搜索结果变化时更新它，传入 KnowledgeGraphView。在 `nodeCanvasObject` 中，命中的节点绘制外发光环（orange ring）。

**替代方案**: 用 ForceGraph2D 的 `nodeColor` prop。

**理由**: 自定义 canvas 绘制更灵活，可以区分「选中」（点击）和「命中」（搜索高亮）两种状态。

### 4. 节点 content 懒加载

搜索结果只展示 title + summary。点击展开时，调 `GET /knowledge-bases/:id/nodes/:nid` 获取完整 content。复用现有 NodeRow 的展开模式。

### 5. compileMethod 条件渲染预留

KnowledgeGraphTab 接收 `compileMethod` prop。当前只处理 `knowledge_graph`（图谱+表格+召回面板），其他值显示纯表格 + 基础召回面板。这是结构预留，不影响当前实现。

## Risks / Trade-offs

- **nodes API 的 keyword 是 LIKE 匹配** — 对于知识图谱场景足够用，但不如语义搜索精准。未来可替换为向量检索。→ 当前可接受，面板结构不依赖搜索实现。
- **大量节点时搜索性能** — LIKE 在无索引列上可能慢。→ pageSize=20 限制返回量，且知识库节点通常在数百以内。
- **图谱 ResizeObserver 可能闪烁** — 面板展开/收起时宽度变化触发图谱重新渲染。→ 使用 CSS `transition-all duration-300` 平滑过渡，ResizeObserver 自然适应。
