## Why

当前知识库召回使用 SQL `LIKE '%keyword%'` 子串匹配，无语义理解、无拆词、无相关性排序，效果极差。同时，知识图谱的节点和边存储在 GORM 关系表中，图遍历依赖 SQL recursive CTE，无法利用图算法（PageRank、最短路径、社区发现等）。

引入 FalkorDB 作为知识图谱 + 向量存储的统一引擎，用一个服务同时解决语义检索和图遍历，支撑 Agent 的高质量知识召回。

## What Changes

- **引入 FalkorDB 依赖**：Docker Compose 新增 FalkorDB 服务，`metis.yaml` 新增连接配置（仅 AI edition 需要）
- **知识数据迁移至 FalkorDB**：`knowledge_nodes` 和 `knowledge_edges` 两张 GORM 表废弃，节点和边全量存入 FalkorDB。一个 KnowledgeBase 对应一个独立的 FalkorDB Graph（`kb_<id>`），物理隔离
- **GORM 最小化存储**：仅保留 `knowledge_bases`（pipeline 配置）、`knowledge_sources`（来源数据）、`knowledge_logs`（编译日志）。移除 `KnowledgeBase.NodeCount`/`EdgeCount` 字段，改为实时查询 FalkorDB
- **新增 Embedding Pipeline**：KnowledgeBase 级别配置 Embedding Provider + Model。编译完成后批量调用 Embedding API 生成向量，写入 FalkorDB 节点属性，重建 HNSW 向量索引
- **召回查询重写**：向量相似度 top-K → 图遍历 1-2 hop 展开关联节点，一条 Cypher 查询完成。替代现有 SQL LIKE 搜索和 recursive CTE
- **管理面板适配**：节点列表、图可视化、节点计数等全部改为查询 FalkorDB。Recall Panel 使用新的向量+图召回接口

## Capabilities

### New Capabilities
- `knowledge-falkordb`: FalkorDB 连接管理、Graph 生命周期（创建/删除/重建）、Cypher 查询封装
- `knowledge-embedding`: Embedding Pipeline —— KB 级别 provider/model 配置、编译后批量向量生成、HNSW 索引管理

### Modified Capabilities
- `ai-knowledge`: 节点/边存储从 GORM 迁移至 FalkorDB；召回查询改为向量+图混合检索；删除 knowledge_nodes/knowledge_edges 表；KnowledgeBase 新增 embedding_provider_id/embedding_model_id 字段，移除 node_count/edge_count 字段
- `ai-knowledge-ui`: Recall Panel 使用向量召回接口；节点列表和图可视化数据源从 REST 切换为 FalkorDB 查询结果

## Impact

- **后端**：`internal/app/ai/` 下 knowledge_node_repository、knowledge_edge_repository 废弃，新增 knowledge_graph_repository（FalkorDB）和 knowledge_embedding_service。knowledge_compile_service 写入目标从 GORM 改为 FalkorDB。knowledge_query_handler 召回逻辑重写
- **基础设施**：新增 FalkorDB Docker 服务（单容器，Redis 协议 :6379）。`internal/config/` MetisConfig 新增 FalkorDB 配置段。IOC 容器注册 FalkorDB client
- **依赖**：新增 `github.com/FalkorDB/falkordb-go/v2`（官方 Go 客户端）
- **数据库迁移**：需要迁移脚本将现有 knowledge_nodes/knowledge_edges 数据导入 FalkorDB，之后可删除这两张表
- **API**：Agent 知识查询 API 响应结构变化（新增 score、context 等字段）。**BREAKING**: 管理面板节点相关 API 的 response 结构调整
- **前端**：`web/src/apps/ai/pages/knowledge/` 下知识库详情页、recall-panel、graph-view、node-table 等组件需适配新 API
