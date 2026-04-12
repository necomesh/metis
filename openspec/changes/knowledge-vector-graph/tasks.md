## 1. Infrastructure — FalkorDB 连接与配置

- [x] 1.1 `internal/config/` MetisConfig 新增 `FalkorDB` 配置段（Addr, Password, Database），更新 yaml 解析
- [x] 1.2 `internal/app/ai/` 新建 `falkordb_client.go` — FalkorDB 客户端封装（连接、PING 健康检查、`do.Shutdowner` 实现、Graph 选择器 `GraphFor(kbID uint) Graph`）
- [x] 1.3 `internal/app/ai/app.go` AIApp.Providers() 注册 FalkorDB client 到 IOC 容器，启动时检测配置是否存在并打印 warning
- [x] 1.4 Docker compose 文件新增 FalkorDB 服务定义（`falkordb/falkordb:latest`，端口 6379，volume 持久化）

## 2. Knowledge Graph Repository — 替代 GORM node/edge repo

- [x] 2.1 新建 `knowledge_graph_repository.go` — 定义接口：CreateNode, UpdateNode, DeleteAllNodes, FindNodeByID, FindNodeByTitle, ListNodes (分页), SearchNodesFullText, CountNodes, CountEdges, CreateEdge, GetSubgraph(nodeID, depth), VectorSearch(vec, topK), VectorSearchWithExpand(vec, topK, hops)
- [x] 2.2 实现 FalkorDB 版本的 KnowledgeGraphRepository — 所有方法通过 Cypher 查询实现，graph name 为 `kb_<id>`
- [x] 2.3 实现 Graph 生命周期方法：CreateGraph（空操作，首次写入自动创建）、DeleteGraph（`GRAPH.DELETE`）、RebuildGraph（delete + recreate）
- [x] 2.4 实现 Full-text index 管理：CreateFullTextIndex、DropFullTextIndex
- [x] 2.5 实现 HNSW vector index 管理：CreateVectorIndex(dimension)、DropVectorIndex

## 3. Embedding Service

- [x] 3.1 `KnowledgeBase` model 新增 `EmbeddingProviderID` 和 `EmbeddingModelID` 字段，GORM migration
- [x] 3.2 `KnowledgeBase` model 移除 `NodeCount` 字段（改为动态查询 FalkorDB）
- [x] 3.3 新建 `knowledge_embedding_service.go` — 职责：根据 KB 的 embedding 配置构建 llm.Client，批量生成 embedding，写入 FalkorDB 节点
- [x] 3.4 实现 `GenerateEmbeddings(ctx, kbID)` — 从 FalkorDB 读取所有非 index 节点的 title+summary → 批量调 Embedding API → SET node.embedding → 重建 HNSW index
- [x] 3.5 处理 Embedding 未配置的降级场景 — 跳过 embedding 生成，日志记录，向量召回不可用

## 4. Compile Service 改造

- [x] 4.1 `KnowledgeCompileService` 依赖注入从 `KnowledgeNodeRepository` + `KnowledgeEdgeRepository` 改为 `KnowledgeGraphRepository` + `KnowledgeEmbeddingService`
- [x] 4.2 改造 `writeCompileOutput()` — 节点和边的写入目标从 GORM 改为 FalkorDB Cypher MERGE
- [x] 4.3 改造增量编译的 "读取已有节点" 逻辑 — 从 FalkorDB 查询现有节点 title+summary（替代 GORM 查询）
- [x] 4.4 改造 `generateIndexNode()` — 写入 FalkorDB 而非 GORM
- [x] 4.5 改造 `runLint()` — orphan/sparse/contradiction 检查通过 Cypher 查询实现
- [x] 4.6 编译 pipeline 末尾新增：调用 EmbeddingService.GenerateEmbeddings()，创建 full-text index
- [x] 4.7 Recompile 流程改造 — 先 GRAPH.DELETE，再执行完整编译
- [x] 4.8 Compile 开始时 DropVectorIndex（防止并发写入 HNSW bug），结束后 CreateVectorIndex

## 5. Handler 和 API 改造

- [x] 5.1 改造 `KnowledgeNodeHandler` — List/Get/Count 等方法改为调用 KnowledgeGraphRepository
- [x] 5.2 改造 `KnowledgeQueryHandler.Search()` — 实现向量召回：query text → Embedding API → vector → FalkorDB VectorSearchWithExpand → 返回带 score 的结果
- [x] 5.3 改造 `KnowledgeQueryHandler.GetNode()` — 从 FalkorDB 读取节点（需要 kb_id 参数来确定 graph name）
- [x] 5.4 改造 `KnowledgeQueryHandler.GetGraph()` — 子图查询改为 FalkorDB Cypher variable-length path
- [x] 5.5 实现 full-text fallback — 当 KB 未配置 embedding 时，Search 退化为 FalkorDB 全文检索 + 图展开
- [x] 5.6 改造 `KnowledgeBaseHandler` — Create/Update 支持 embedding_provider_id/embedding_model_id 字段；List 中 node_count/edge_count 动态查询 FalkorDB
- [x] 5.7 改造 `KnowledgeBaseService` — 删除知识库时调用 GraphRepository.DeleteGraph()

## 6. GORM 清理

- [x] 6.1 从 `KnowledgeModel` 中移除 `KnowledgeNode` 和 `KnowledgeEdge` struct
- [x] 6.2 从 AIApp.Models() 中移除 KnowledgeNode 和 KnowledgeEdge 的 AutoMigrate 注册
- [x] 6.3 删除 `knowledge_node_repository.go` 和 `knowledge_edge_repository.go`
- [x] 6.4 从 AIApp.Providers() 中移除 KnowledgeNodeRepository 和 KnowledgeEdgeRepository 的 IOC 注册
- [x] 6.5 清理所有对旧 repository 的引用，确保编译通过

## 7. 前端适配

- [ ] 7.1 KnowledgeBase 创建/编辑 Sheet 新增 Embedding Provider 和 Embedding Model 下拉选择
- [ ] 7.2 Recall Panel 改造 — 发送 query text 到新 API，展示带 score 的向量召回结果，区分 seed 节点和 graph 展开节点
- [ ] 7.3 Node Table View 适配 — 确认列表数据从新 API 正常加载（字段结构可能变化）
- [ ] 7.4 Knowledge Graph View 适配 — 图可视化数据源确认兼容
- [ ] 7.5 知识库列表页 node_count 展示确认（API 返回格式可能变化）

## 8. 数据迁移与验证

- [ ] 8.1 编写一次性迁移逻辑 — 读取 GORM knowledge_nodes/knowledge_edges 表数据 → 按 kb_id 分组 → 写入对应 FalkorDB graph（可作为 CLI subcommand 或 seed 逻辑）
- [ ] 8.2 迁移后验证 — 对比 GORM 和 FalkorDB 中的节点/边数量是否一致
- [ ] 8.3 确认旧表可安全删除后，移除 GORM AutoMigrate 中的表定义
