## Why

智能体需要领域知识来回答专业问题。借鉴 Karpathy LLM Wiki 理念——"知识应被编译一次，而非每次查询时重新推导"。采用 Vectorless 路线，用 LLM 将原料编译为知识图谱（概念节点 + 关系边），Agent 通过 API 在图谱层导航检索，按需读取原文。无向量数据库、无 FTS，保持零外部依赖，兼容 SQLite/PostgreSQL。

## What Changes

### 知识库与原料采集

- 新增 KnowledgeBase 作为知识编译单元，Source 作为不可变原料
- 支持多种输入源：文件上传（PDF / Word / Excel / PPT / Markdown / 纯文本）和 URL 抓取
- URL 采集支持抓取深度（0/1/2）和 URL 模式过滤，HTML 自动转 Markdown
- 支持定时采集（cron 表达式），自动检测 URL 内容变化并更新

### LLM 知识编译（Wiki 模式）

- LLM 读取所有 Sources，按概念组织编译为知识图谱：Nodes（概念节点）+ Edges（关系边）
- 每个概念节点有 title、summary、content（可选，完整 Markdown 文章）
- 概念间关系类型：related / contradicts / extends / part_of
- 支持增量编译 + 级联更新：新 Source 加入时，LLM 不只生成新节点，还检查已有节点是否需要更新（知识复利）
- 编译后自动 Lint 质检：孤立节点、断链、矛盾检测、稀疏节点标记
- 编译操作日志：记录每次编译的触发方式、新增/更新节点数、模型信息

### Agent 知识查询 API

- Agent 通过 API 搜索知识图谱节点（匹配 title + summary）
- 获取节点详情 + 完整文章内容
- 获取节点关系子图（N 跳内的关联概念网络）
- Agent 启动时通过配置声明可用知识库 + 查询 API endpoint

### 前端知识库管理

- 知识库 CRUD + 编译配置（选择 LLM 模型、自动编译开关、定时采集）
- Source 管理：文件上传、URL 添加、提取状态查看
- 知识图谱浏览：概念节点列表 + 关系可视化 + 文章查看

## Capabilities

### New Capabilities
- `ai-knowledge`: 知识库管理、原料采集（文件/URL）、LLM 知识编译、知识图谱存储（nodes + edges）、Agent 查询 API、编译质检与日志
- `ai-knowledge-ui`: 知识库管理页面、Source 上传/管理、知识图谱浏览与文章查看

### Dependencies
- `ai-llm-client` (existing): 知识编译需要调用 LLM
- `ai-model` (existing): 选择编译用的 LLM 模型

## Impact

- **后端**: `internal/app/ai/` 新增 knowledge 相关 model/repo/service/handler
- **前端**: 新增 `web/src/apps/ai/pages/knowledge/` 知识库管理页面
- **数据库**: 新增 4 张表（ai_knowledge_bases, ai_knowledge_sources, ai_knowledge_nodes, ai_knowledge_edges）+ 日志表
- **Scheduler**: 新增 4 个异步任务（source-extract, knowledge-compile, knowledge-recompile, knowledge-crawl）
- **纯 Go 依赖**: HTML→Markdown 转换库、PDF/Office 文本提取库，保持 CGO_ENABLED=0
