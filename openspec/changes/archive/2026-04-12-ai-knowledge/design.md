## Context

AI App 已有 Provider + Model + LLM Client 基础设施。现需增加知识管理能力，让 Agent 能访问领域知识。

借鉴 Karpathy LLM Wiki 核心理念：知识编译而非简单存储。原料（文件/URL）入库后由 LLM 编译为知识图谱（概念节点 + 关系边），Agent 在图谱层导航检索。

现有 AI App 结构（`internal/app/ai/`）：Provider → Model → LLM Client。Knowledge 作为同一 App 下的新模块，复用 IOC 容器和 LLM 调用能力。

## Goals / Non-Goals

**Goals:**
- 支持文件（PDF/Word/Excel/PPT/Markdown/文本）和 URL 两类输入源
- URL 采集支持深度抓取和定时更新
- LLM 将原料编译为知识图谱（Wiki 模式），支持增量编译和级联更新
- 编译后自动 Lint 质检
- Agent 通过 REST API 查询图谱、读取文章
- 前端管理页面：知识库 CRUD、Source 管理、图谱浏览

**Non-Goals:**
- 向量嵌入 / 向量数据库
- FTS 全文检索（SQLite FTS5 / PostgreSQL tsvector）
- Graph 编译目标（Mermaid 图谱可视化）— 后续扩展
- QA 编译目标 — 后续扩展
- 查询归档（Agent 优质回答反哺知识库）— 后续扩展
- 外部图数据库（FalkorDB / Neo4j）— 关系表存图足够，保持零外部依赖

## Decisions

### 1. 知识图谱用关系表存储，不引入图数据库

**选择**: ai_knowledge_nodes + ai_knowledge_edges 两张关系表

**替代方案**: FalkorDB（Redis 模块，Cypher 查询）

**理由**:
- Metis 核心优势是单二进制零依赖，引入 Redis + FalkorDB 破坏这一点
- Agent 实际查询模式（关联查询、2 跳遍历）用 SQL JOIN + 递归 CTE 足够
- SQLite 和 PostgreSQL 都支持递归 CTE
- 关系表天然可导出到图数据库，后续需要时零成本迁移

### 2. 数据模型：三层分离

```
KnowledgeBase（编译单元）
  └── Sources（不可变原料）
  └── Nodes + Edges（编译产物 = 知识图谱）
```

**4 张核心表 + 1 张日志表：**

**ai_knowledge_bases**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint PK | BaseModel |
| name | string(128) | 知识库名称 |
| description | text | 帮助 Agent 判断是否查阅 |
| compile_status | string(16) | idle / compiling / completed / error |
| compile_model_id | uint FK | 编译用的 LLM 模型 |
| compiled_at | *time | 最近一次编译完成时间 |
| auto_compile | bool | 新 Source 入库后自动编译 |
| crawl_enabled | bool | 是否启用定时采集 |
| crawl_schedule | string(64) | cron 表达式 |
| last_crawled_at | *time | 最近一次采集时间 |
| source_count | int | 缓存 |
| node_count | int | 缓存 |

**ai_knowledge_sources**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint PK | BaseModel |
| kb_id | uint FK | 所属知识库 |
| parent_id | uint FK nullable | 子页面指向父 Source |
| title | string(256) | 标题 |
| content | text | 提取后的 Markdown |
| format | string(16) | markdown / text / pdf / docx / xlsx / pptx / url |
| source_url | string(1024) | URL 类型的原始地址 |
| crawl_depth | int | 0/1/2，仅 URL |
| url_pattern | string(512) | 限制子页面范围，仅 URL |
| file_name | string(256) | 原始文件名，仅文件类型 |
| byte_size | int64 | 原始文件大小 |
| extract_status | string(16) | pending / completed / error |
| content_hash | string(64) | 内容 SHA256，用于定时采集变化检测 |

**ai_knowledge_nodes**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint PK | BaseModel |
| kb_id | uint FK | 所属知识库 |
| title | string(256) | 概念名称 |
| summary | text | 一句话描述（图谱浏览用） |
| content | text nullable | 完整 Markdown 文章（无则仅为图谱节点） |
| node_type | string(16) | index / concept |
| source_ids | JSON | 溯源到哪些原料（title 列表） |
| compiled_at | time | 编译时间 |

**ai_knowledge_edges**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint PK | |
| kb_id | uint FK | 所属知识库 |
| from_node_id | uint FK | 起点节点 |
| to_node_id | uint FK | 终点节点 |
| relation | string(32) | related / contradicts / extends / part_of |
| description | string(512) nullable | 关系描述 |

**ai_knowledge_logs**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint PK | |
| kb_id | uint FK | |
| action | string(32) | compile / recompile / crawl / lint |
| model_id | string(128) | 使用的模型 |
| nodes_created | int | |
| nodes_updated | int | |
| edges_created | int | |
| lint_issues | int | |
| details | text | JSON 详细信息 |
| created_at | time | |

### 3. LLM 编译流程：结构化输出 + 名字驱动

LLM 编译时输入 Sources 原文 + 已有 Nodes（title + summary），输出结构化 JSON：

```json
{
  "nodes": [
    {
      "title": "概念名",
      "summary": "一句话描述",
      "content": "完整 Markdown 或 null",
      "related": [
        {"concept": "另一概念名", "relation": "related"}
      ],
      "sources": ["原料标题1", "原料标题2"],
      "update_reason": null
    }
  ],
  "updated_nodes": [
    {
      "title": "已有概念名",
      "summary": "更新后的摘要",
      "content": "更新后的内容",
      "related": [...],
      "sources": [...],
      "update_reason": "新来源补充了 XX 细节"
    }
  ]
}
```

**名字驱动**：LLM 只输出概念名和原料标题，系统侧按 title 匹配写入 ID 关联。避免上下文膨胀。

**编译后处理**：
1. 写入新 Nodes
2. 更新已有 Nodes
3. 解析 related 字段 → 按 concept name 匹配 node → 写入 Edges
4. 未匹配的 concept → 创建空 Node（仅 title，无 content）
5. Lint 校验：孤立节点标记、矛盾检测、稀疏节点统计
6. 生成/更新 index Node（所有概念 title + summary 汇总）
7. 写入 knowledge_logs

### 4. 级联更新（知识复利）

增量编译时，LLM 的输入包含已有 Nodes 列表（title + summary）。LLM 不只处理新 Sources，还判断哪些已有节点需要因新信息更新。输出 `updated_nodes` 数组。

这是 Karpathy 的核心精髓："每次新来源让整个图谱变更好，不只是变更大"。

### 5. URL 采集：深度抓取 + 定时更新

**抓取流程**：
1. 抓取主页面 HTML
2. HTML → Markdown（go 库：JohannesKaufmann/html-to-markdown）
3. 如果 crawl_depth > 0：提取同域链接 → 按 url_pattern 过滤 → 每个子链接创建子 Source → 递归（depth-1）
4. 计算 content_hash 存储

**定时采集**（Scheduler cron 任务）：
1. 遍历 crawl_enabled=true 的 KB
2. 对 URL 类型 Source 重新抓取
3. 对比 content_hash，有变化则更新 content
4. KB 内有任何 Source 更新 + auto_compile=true → 触发增量编译

### 6. 文件提取：纯 Go 库

| 格式 | Go 库 | 说明 |
|------|-------|------|
| PDF | unidoc/unipdf 或 ledongthuc/pdf | 文本提取，复杂排版可能丢失结构 |
| Word (.docx) | unidoc/unioffice 或 nguyenthenguyen/docx | XML 解析 |
| Excel (.xlsx) | xuri/excelize | 转 Markdown 表格 |
| PPT (.pptx) | unidoc/unipdf | 逐页文本提取 |
| HTML→MD | JohannesKaufmann/html-to-markdown | 去噪 + 结构保留 |

第一阶段接受"尽力提取"——复杂格式可能丢失排版细节。

### 7. Agent 查询 API（Sidecar Token 认证）

| 端点 | 说明 |
|------|------|
| `GET /api/v1/ai/knowledge/search?q=&kb_id=` | 搜索节点（title + summary 匹配） |
| `GET /api/v1/ai/knowledge/nodes/:id` | 节点详情 + content |
| `GET /api/v1/ai/knowledge/nodes/:id/graph?depth=` | 关系子图（N 跳） |

Agent 通过启动配置获知 API endpoint 和认证 token，按需调用。

### 8. Scheduler 任务

| 任务名 | 类型 | 说明 |
|------|------|------|
| ai-source-extract | async | 文件解析 / URL 抓取 + HTML→MD |
| ai-knowledge-compile | async | LLM 增量编译 + Lint |
| ai-knowledge-recompile | async | 全量重编译（清空 Nodes 重建） |
| ai-knowledge-crawl | scheduled | 定时重新抓取 URL Sources |

## Risks / Trade-offs

- **[LLM 编译质量不稳定]** → 支持全量重编译 + 选择不同模型重跑；Lint 自动检测质量问题
- **[大知识库编译 token 消耗高]** → 增量编译减少重复处理；index Node 只存 title+summary 控制上下文大小
- **[文件提取质量有限]** → 第一阶段 "尽力提取"，复杂排版用户可手动补充 Markdown
- **[URL 抓取目标页面结构变化]** → content_hash 检测变化；定时采集发现变化后重新提取
- **[关系表图查询性能]** → 中小规模（千级节点）SQL 足够；大规模可导出到专用图数据库
- **[编译时 LLM 幻觉]** → source_ids 溯源机制 + Lint 矛盾检测；content 为空的节点标记为"待补充"
