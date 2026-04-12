## 1. 数据模型与 App 注册

- [x] 1.1 在 `internal/app/ai/` 新增 knowledge 相关模型文件：KnowledgeBase, Source, Node, Edge, KnowledgeLog 五个结构体，含 TableName() 和 ToResponse() 方法
- [x] 1.2 在 AIApp.Models() 中注册新模型，确保 AutoMigrate
- [x] 1.3 在 seed 中添加知识库管理相关菜单和 Casbin 策略

## 2. Source 原料管理（后端）

- [x] 2.1 实现 KnowledgeBase CRUD：repository + service + handler，路由挂载到 /ai/knowledge-bases
- [x] 2.2 实现 Source CRUD：repository + service + handler，路由挂载到 /ai/knowledge-bases/:kbId/sources
- [x] 2.3 实现文件上传接口：接收文件 → 存储 → 创建 Source 记录（extract_status=pending）→ 入队 ai-source-extract 任务
- [x] 2.4 实现 URL 添加接口：接收 URL + crawl_depth + url_pattern → 创建 Source 记录 → 入队 ai-source-extract 任务

## 3. Source 提取（Scheduler 异步任务）

- [x] 3.1 实现 ai-source-extract 任务：根据 format 分发到不同提取器
- [x] 3.2 实现 Markdown/Text 提取器：直接存储 content
- [ ] 3.3 实现 PDF 提取器：纯 Go 库提取文本 → Markdown（占位符，待集成 Go PDF 库）
- [ ] 3.4 实现 Word(.docx) 提取器：XML 解析提取文本 → Markdown（占位符，待集成 Go DOCX 库）
- [ ] 3.5 实现 Excel(.xlsx) 提取器：excelize 读取 → 转 Markdown 表格（占位符，待集成 excelize）
- [ ] 3.6 实现 PPT(.pptx) 提取器：逐页提取文本 → Markdown（占位符，待集成 Go PPTX 库）
- [x] 3.7 实现 URL 提取器：HTTP 抓取 → HTML→Markdown → 去噪处理
- [x] 3.8 实现 URL 深度抓取：crawl_depth>0 时提取同域链接 → url_pattern 过滤 → 创建子 Source → 递归
- [x] 3.9 提取完成后计算 content_hash，更新 extract_status，auto_compile=true 时入队编译任务

## 4. LLM 知识编译（核心）

- [x] 4.1 实现 KnowledgeCompileService：编排编译流程（读 Sources → 调 LLM → 写 Nodes/Edges）
- [x] 4.2 设计编译 Prompt：输入格式（Sources 文本 + 已有 Node title/summary 列表）、输出 JSON schema（new_nodes + updated_nodes）
- [x] 4.3 实现 LLM 结构化输出解析：JSON 解析 + 容错处理
- [x] 4.4 实现名字驱动的关系解析：concept name → Node ID 匹配、source title → Source ID 匹配，未匹配 concept 创建空 Node
- [x] 4.5 实现 Index Node 生成：编译完成后创建/更新 node_type=index 的节点，汇总所有概念 title+summary
- [x] 4.6 实现 ai-knowledge-compile 异步任务（增量编译）
- [x] 4.7 实现 ai-knowledge-recompile 异步任务（全量重编译：清空 Nodes/Edges → 全量编译）

## 5. 编译后 Lint 与日志

- [x] 5.1 实现 Lint 检查：孤立节点检测（无 Edge 连接）、稀疏节点检测（content=null 且被 3+ Edge 引用）、矛盾标记（contradicts 边）
- [x] 5.2 实现 KnowledgeLog 写入：每次编译/重编译/采集操作记录 action、model、nodes_created/updated、lint_issues
- [x] 5.3 实现 KnowledgeLog 查询接口：GET /ai/knowledge-bases/:kbId/logs

## 6. 定时 URL 采集

- [x] 6.1 实现 ai-knowledge-crawl Scheduler 定时任务：遍历 crawl_enabled=true 的 KB → 重新抓取 URL Sources
- [x] 6.2 实现内容变化检测：对比 content_hash → 有变化则更新 content → auto_compile 触发编译
- [x] 6.3 在 AIApp.Tasks() 中注册 ai-knowledge-crawl 定时任务

## 7. Agent 知识查询 API

- [x] 7.1 实现搜索接口：GET /api/v1/ai/knowledge/search?q=&kb_id= → 匹配 Node title+summary
- [x] 7.2 实现节点详情接口：GET /api/v1/ai/knowledge/nodes/:id → 返回完整 content
- [x] 7.3 实现关系子图接口：GET /api/v1/ai/knowledge/nodes/:id/graph?depth= → 递归 CTE 查 N 跳关联
- [x] 7.4 Agent 查询路由支持 Sidecar Token 认证（NodeTokenMiddleware）

## 8. 前端 — 知识库列表页

- [x] 8.1 创建 `web/src/apps/ai/pages/knowledge/` 目录结构
- [x] 8.2 实现知识库列表页：表格展示 name、description、source_count、node_count、compile_status
- [x] 8.3 实现创建/编辑知识库 Sheet：表单含 name、description、compile_model_id 选择、auto_compile 开关、crawl_enabled + crawl_schedule
- [x] 8.4 注册前端路由和菜单项

## 9. 前端 — 知识库详情页

- [x] 9.1 实现详情页框架：三个 Tab（Sources / Knowledge Graph / Compile Logs）
- [x] 9.2 实现 Sources Tab：列表展示 + 文件上传组件 + URL 添加 Sheet + extract_status 状态标签
- [x] 9.3 实现 Knowledge Graph Tab：概念节点列表（title、summary、has_content 标记、edge_count）+ 点击查看文章内容和关联节点
- [x] 9.4 实现编译控制：Compile 按钮 + Recompile 确认 + compile_status 状态指示
- [x] 9.5 实现编译日志查看器：时间线展示编译历史
