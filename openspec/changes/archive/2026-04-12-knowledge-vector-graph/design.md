## Context

当前知识库模块（`internal/app/ai/`）使用 GORM 存储知识图谱的节点（`knowledge_nodes` 表）和边（`knowledge_edges` 表）。召回查询使用 SQL `LIKE '%keyword%'`，图遍历使用 SQL recursive CTE。这种方案在语义理解、相关性排序、图算法能力上均存在严重不足。

经过对 ChromaDB、Qdrant、Milvus、FalkorDB 的调研，选择 FalkorDB 作为知识图谱 + 向量存储的统一引擎。FalkorDB 基于 Redis 协议，支持 Cypher 查询语言、HNSW 向量索引、属性图模型，单 Docker 容器部署，官方提供 Go 客户端。

现有约束：
- Metis 支持 SQLite 和 PostgreSQL，通过 `metis.yaml` 配置
- AI 模块是可插拔 App，通过 build tag 控制
- LLM 客户端（`internal/llm/`）已有 `Embedding()` 接口但未使用
- 编译 pipeline 由 scheduler async task 驱动

## Goals / Non-Goals

**Goals:**
- 用 FalkorDB 统一承载知识图谱的节点、边、向量数据
- 实现向量相似度检索 + 图遍历的混合召回查询
- 每个 KnowledgeBase 对应一个独立的 FalkorDB Graph，物理隔离
- 在编译 pipeline 中集成 Embedding 生成
- GORM 最小化，仅保留 pipeline 元数据（base、source、log）

**Non-Goals:**
- 不引入 Neo4j 或其他独立图数据库
- 不引入独立向量数据库（Qdrant/ChromaDB/Milvus）
- 不实现实时 embedding（查询时计算），仅编译时生成
- 不做多知识库跨库联合检索
- 不迁移 GORM 中的 knowledge_bases、knowledge_sources、knowledge_logs 表
- 不修改非 AI 模块的代码

## Decisions

### D1: FalkorDB 作为唯一知识存储引擎

**选择**: FalkorDB（单服务同时提供图数据库 + 向量索引）

**备选方案**:
- Qdrant + SQL CTE：向量成熟但图能力弱，两个系统协作复杂
- ChromaDB：Python-first，Go 客户端社区维护，镜像大（500MB+）
- Milvus：过度工程（需 etcd + MinIO），Go SDK 已废弃
- pgvector / sqlite-vec：无图能力，需继续用 CTE

**理由**: FalkorDB 用一个 Docker 容器（~100MB 镜像，30-50MB 内存）同时解决向量检索和图遍历，支持 Cypher 查询语言，原生 HNSW 向量索引，适合几百到几千节点的知识图谱规模。Go 官方客户端可用。

### D2: 一个 KnowledgeBase = 一个 FalkorDB Graph

**选择**: 每个知识库使用独立的 named graph（`kb_<id>`），而非共享 graph + `kb_id` 属性过滤

**理由**:
- 物理隔离：查询无需带 `kb_id` 过滤条件
- 删除简洁：`GRAPH.DELETE kb_<id>` 一条命令
- 向量索引独立：各 KB 的 HNSW 索引互不干扰
- 重编译简洁：drop graph + rebuild，不用按条件删除

**Graph 命名规则**: `kb_<knowledge_base_id>`，ID 为 GORM 表的主键（uint）

### D3: GORM 只存 pipeline 元数据

**选择**: 废弃 `knowledge_nodes` 和 `knowledge_edges` 两张 GORM 表，节点和边全量存入 FalkorDB

**GORM 保留**:
- `knowledge_bases` — 名称、描述、编译状态、模型配置、embedding 配置
- `knowledge_sources` — 来源文件/URL、提取状态、原文内容
- `knowledge_logs` — 编译日志

**GORM 移除**:
- `knowledge_nodes` 表 → FalkorDB (:KnowledgeNode)
- `knowledge_edges` 表 → FalkorDB relationship
- `KnowledgeBase.NodeCount` 字段 → 实时查 FalkorDB `MATCH (n:KnowledgeNode) RETURN count(n)`
- `KnowledgeBase.EdgeCount` 字段 → 实时查 FalkorDB

### D4: Embedding 配置在 KnowledgeBase 级别

**选择**: `KnowledgeBase` 新增 `EmbeddingProviderID` 和 `EmbeddingModelID` 字段，每个知识库可以使用不同的 Embedding 模型

**理由**: 不同知识库可能包含不同语言/领域的内容，使用不同维度或不同语言优化的 embedding 模型更合理。复用现有 `ai_providers` + `ai_models` 表的 Provider/Model 体系。

### D5: 编译时生成 embedding，编译后重建索引

**Pipeline 变化**:
1. Source 提取（不变）
2. LLM 编译 → 输出 nodes/edges JSON（不变）
3. 写入 FalkorDB（Cypher MERGE，替代 GORM Create/Update）
4. **新增**: 批量调 Embedding API，SET node.embedding
5. **新增**: DROP + CREATE VECTOR INDEX（重建 HNSW 索引，规避并发写入 bug #1710）
6. 生成 index 节点 + lint（不变，改为 Cypher 操作）

**Embedding 输入**: `title + "\n" + summary`（不含 content，避免超过 embedding 模型 token 限制）

### D6: FalkorDB 连接配置在 metis.yaml

```yaml
falkordb:
  addr: "localhost:6379"
  password: ""
  database: 0
```

仅当编译包含 AI 模块（非 `edition_lite`）时才要求配置。未配置时 AI App 启动打印 warning 日志，知识库相关功能降级（编译和召回不可用，但其他 AI 功能正常）。

### D7: FalkorDB 节点和关系 Schema

```
(:KnowledgeNode {
  id: string,          // UUID
  title: string,
  summary: string,
  content: string,     // nullable
  node_type: string,   // "concept" | "index"
  source_ids: string,  // JSON array string
  compiled_at: int,    // unix timestamp
  embedding: vecf32    // float32 vector
})

-[:RELATED_TO {description: string}]->
-[:EXTENDS {description: string}]->
-[:CONTRADICTS {description: string}]->
-[:PART_OF {description: string}]->
```

索引:
- Full-text index on `title` + `summary`（管理面板关键词搜索）
- HNSW vector index on `embedding`（语义召回）

### D8: 召回查询策略

Agent 召回查询使用两阶段 Cypher:

```cypher
// 阶段 1: 向量搜索找种子节点
CALL db.idx.vector.queryNodes('KnowledgeNode', 'embedding', $topK, vecf32($queryVec))
YIELD node AS seed, score

// 阶段 2: 图遍历展开 1-2 hop 邻居
OPTIONAL MATCH (seed)-[r*1..2]-(neighbor)
RETURN seed, score, collect(DISTINCT neighbor) AS context, collect(DISTINCT r) AS relations
```

管理面板的 Recall Panel 同样使用此查询，前端发送 query text → 后端先调 Embedding API 得到 query vector → 执行 Cypher。

管理面板的节点列表使用 full-text index 做关键词搜索:
```cypher
CALL db.idx.fulltext.queryNodes('node_ft_idx', $keyword)
YIELD node RETURN node
```

## Risks / Trade-offs

**[FalkorDB HNSW 并发写入 bug #1710]** → 编译 pipeline 采用 "先写数据、后建索引" 策略：编译开始时 DROP INDEX，写入完成后 CREATE INDEX。编译期间不允许向量查询。

**[FalkorDB Go 客户端小众 (18 stars)]** → 底层是 Redis 协议，极端情况可用 rueidis 直接发 GRAPH.QUERY 命令。封装一层 repository 接口隔离具体客户端。

**[数据一致性 — GORM 和 FalkorDB 双写]** → 采用最终一致。删除知识库时先删 GORM 记录，再异步删 FalkorDB graph。编译写入失败时回滚 compile_status 为 error，FalkorDB 中的部分数据不影响正确性（下次编译会重建）。

**[Embedding 模型依赖]** → 用户必须配置一个支持 Embedding 的 Provider + Model。未配置时编译仍可进行（只生成图结构），但向量召回不可用，退化为 full-text 搜索。

**[SSPL 许可证]** → FalkorDB 使用 SSPL v1，自用和作为产品内部组件完全合规。若 Metis 未来作为托管 SaaS 提供，需评估许可证影响。

## Migration Plan

1. 新增 `metis.yaml` 的 `falkordb` 配置段，`MetisConfig` 结构体新增对应字段
2. IOC 容器注册 FalkorDB 客户端（`do.Provide`）
3. 实现 `KnowledgeGraphRepository`（FalkorDB），替代 `KnowledgeNodeRepository` + `KnowledgeEdgeRepository`
4. 实现 `KnowledgeEmbeddingService`
5. 改造 `KnowledgeCompileService` 写入目标为 FalkorDB
6. 改造 `KnowledgeNodeHandler` 和 `KnowledgeQueryHandler` 查询 FalkorDB
7. 前端适配新 API 响应格式
8. 数据迁移脚本：读取现有 `knowledge_nodes` + `knowledge_edges` 表 → 写入 FalkorDB graph（一次性脚本）
9. 确认迁移完成后，移除 GORM model 中的 `KnowledgeNode`、`KnowledgeEdge` 以及 AutoMigrate 注册

**Rollback**: 保留旧的 GORM 表结构一个版本周期，迁移脚本可反向执行（FalkorDB → GORM）。FalkorDB 配置为空时自动退化为旧 GORM 模式。

## Open Questions

- Embedding 维度是否需要在 KnowledgeBase 上显式存储？不同 embedding model 维度不同（ada-002 是 1536d，text-embedding-3-small 默认 1536d），HNSW 索引需要知道维度。当前方案：创建索引时从第一个 embedding 的实际长度推断。
- FalkorDB 持久化策略（RDB vs AOF vs 混合）是否需要在 metis.yaml 中暴露配置？还是使用 FalkorDB 默认配置？
