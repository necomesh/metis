## Why

智能体需要领域知识来回答专业问题。采用 Vectorless 路线（非传统 RAG），利用全文检索 + LLM 路由代替向量嵌入，保持零外部依赖（无向量数据库），完全兼容 SQLite/PostgreSQL 双数据库策略，保持 CGO_ENABLED=0 纯 Go 编译。

## What Changes

- 新增 KnowledgeBase 和 Document 数据模型
- KnowledgeBase 作为知识容器，Document 存储原文（不切片、不嵌入）
- 文档入库时通过 Scheduler 异步生成 LLM 摘要（调用 ai-provider-model 提供的统一 LLM 接口）
- 全文检索基于数据库原生能力：SQLite FTS5 / PostgreSQL tsvector
- 前端新增知识库管理页面：知识库 CRUD + 文档上传与管理 + 检索测试

### Vectorless 知识使用方式

Agent 使用知识的三种模式（由 ai-agent-runtime 在运行时决策）：
- **上下文注入**：短知识库内容直接塞进 System Prompt
- **工具检索**：Agent 调用 search_knowledge 工具 → FTS 全文检索 + LLM Rerank 返回相关文档
- **摘要导航**：Agent 先看各文档摘要索引 → 决定读哪些 → 调用 read_document 获取全文

### 数据模型

**KnowledgeBase**: name, description(帮助 Agent 判断是否需要查阅), type(documents | wiki | api_spec)

**Document**: knowledge_base_id(FK), title, content(原文存储), format(markdown | text | pdf | url), summary(LLM 生成的摘要), metadata(JSON: source, author, updated_at), summary_status(pending | completed | error)

## Capabilities

### New Capabilities
- `ai-knowledge-base`: 知识库 CRUD + 全文检索（SQLite FTS5 / PostgreSQL tsvector）
- `ai-document`: 文档管理 + 上传 + LLM 摘要异步生成

### Dependencies
- `ai-llm-client` (from ai-provider-model): 摘要生成需要调用 LLM

## Impact

- **后端**: `internal/app/ai/` 新增 knowledge 相关 model/repo/service/handler ~400 行
- **前端**: 新增 `web/src/apps/ai/pages/knowledge/` 知识库管理页面
- **数据库**: 新增 2 张表（ai_knowledge_bases, ai_documents）+ FTS 索引
- **Scheduler**: 新增 `ai-document-summary` 异步任务
