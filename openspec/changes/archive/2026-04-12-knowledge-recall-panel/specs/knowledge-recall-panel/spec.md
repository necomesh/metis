## ADDED Requirements

### Requirement: Recall test panel toggle
知识库详情页「知识图谱」tab 右上方 SHALL 显示「召回测试」按钮，点击后展开右侧召回面板，再次点击收起。面板默认收起。

#### Scenario: Open recall panel
- **WHEN** 用户在知识图谱 tab 点击「召回测试」按钮
- **THEN** 右侧面板以 `w-80` 宽度滑入，左侧图谱/表格区域自适应收窄

#### Scenario: Close recall panel
- **WHEN** 召回面板已展开，用户再次点击「召回测试」按钮
- **THEN** 面板收起，左侧区域恢复全宽

### Requirement: Recall search input
召回面板 SHALL 包含一个文本输入框和搜索按钮。输入查询文本后点击搜索（或按 Enter），调用 `GET /api/v1/ai/knowledge-bases/${kbId}/nodes?keyword=${query}&pageSize=20` 获取匹配节点。

#### Scenario: Execute search
- **WHEN** 用户在召回面板输入框输入 "context window" 并按 Enter
- **THEN** 系统调用 nodes API 并在面板中展示匹配的节点列表

#### Scenario: Empty query
- **WHEN** 用户未输入任何文本就点击搜索
- **THEN** 不发起请求，保持当前状态

### Requirement: Search result list
搜索结果 SHALL 以卡片列表形式展示，每项包含：节点标题、摘要（截断）、关联数。

#### Scenario: Results displayed
- **WHEN** 搜索返回 3 个匹配节点
- **THEN** 面板展示 3 张结果卡片，每张显示标题、摘要前两行、关联数

#### Scenario: No results
- **WHEN** 搜索关键词无匹配
- **THEN** 面板显示「无匹配结果」空状态

### Requirement: Expand node content
搜索结果中的每个节点 SHALL 支持点击展开查看完整 content。展开时调用 `GET /api/v1/ai/knowledge-bases/${kbId}/nodes/${nodeId}` 获取完整内容。

#### Scenario: Expand node
- **WHEN** 用户点击结果卡片的展开按钮
- **THEN** 系统获取该节点的完整 content 并以 pre/code 块形式展示在卡片下方

#### Scenario: Collapse node
- **WHEN** 已展开的卡片被再次点击
- **THEN** content 区域收起

### Requirement: Graph highlight on search
当用户处于图谱视图且召回面板有搜索结果时，搜索命中的节点 SHALL 在力导向图上以高亮环标记（区别于点击选中的橙色）。

#### Scenario: Highlight matching nodes
- **WHEN** 召回搜索返回节点 A 和 B，且当前是图谱视图
- **THEN** 图谱中 A、B 节点显示高亮环（绿色外环）

#### Scenario: Clear highlights on new search
- **WHEN** 用户执行新的搜索
- **THEN** 旧的高亮被清除，新结果的节点被高亮

#### Scenario: Clear highlights on panel close
- **WHEN** 用户关闭召回面板
- **THEN** 图谱上的高亮全部清除

### Requirement: Compile method aware rendering
KnowledgeGraphTab SHALL 接收 `compileMethod` prop。当 `compileMethod` 为 `knowledge_graph` 时，展示图谱视图 + 表格视图 + 召回面板。其他编译方法展示表格视图 + 召回面板（无图谱）。

#### Scenario: knowledge_graph method
- **WHEN** `compileMethod` 为 `"knowledge_graph"`
- **THEN** 提供图谱视图/表格视图切换，以及召回测试面板

#### Scenario: Other method (future)
- **WHEN** `compileMethod` 为非 `"knowledge_graph"` 的值
- **THEN** 只显示表格视图和召回测试面板，不显示图谱视图切换

### Requirement: Node source traceability
图谱视图和表格视图中的节点 SHALL 能穿透到 raw 来源。节点 API 返回 `sourceIds`（来源 ID 数组），前端据此展示对应来源的 title 和 format，用户可查看来源原文。

#### Scenario: Graph view — node detail shows sources
- **WHEN** 用户在图谱视图点击一个有 sourceIds 的节点
- **THEN** 右侧详情面板除了展示 summary 和 edgeCount 外，还列出关联来源的 title

#### Scenario: Table view — expanded node shows sources
- **WHEN** 用户在表格视图展开一个节点
- **THEN** 展开区域除了 content 外，显示「来源」区块，列出 sourceIds 对应的来源 title + format

### Requirement: Index nodes displayed in graph
GetFullGraph API SHALL 返回全部节点类型（包括 index 和 concept），前端图谱和图例均展示 index 节点。

#### Scenario: Index node visible in graph
- **WHEN** 知识库包含 index 类型节点
- **THEN** index 节点在图谱中以紫色显示，图例中包含「索引」标签
