## Why

代码走查发现多个严重的质量问题：后端 AI 模块大量 DB 操作返回值被忽略（导致状态机卡死）、N+1 查询（知识图谱页面 100 节点 = 101 条 SQL）、假成功的 TODO 桩函数欺骗用户、前端内核 17 个 mutation 无错误提示、巨型文件超 1000 行难以维护。作为严谨的产品，这些问题必须立即修复。

## What Changes

### 错误处理修复
- 修复 `knowledge_compile_service.go` 中 ~15 处被忽略的 `kbRepo.Update`/`nodeRepo.Create`/`edgeRepo.Delete` 返回值，确保状态机不会卡死
- 修复 `knowledge_extract_service.go` 中 ~10 处被忽略的 `sourceRepo.Update`/`engine.Enqueue` 返回值
- 修复 `knowledge_base_service.go` Delete 方法中 3 处级联删除返回值被忽略
- 修复 `knowledge_source_service.go` 中 2 处 `UpdateCounts` 返回值被忽略
- 修复 service 层 `FindByID` 错误掩盖问题（任何错误都返回 NotFound，掩盖 DB 连接错误）

### 性能修复
- 消除 `knowledge_node_handler.go` List/GetFullGraph 中的 N+1 查询（`CountByNodeID` 循环）
- 消除 `knowledge_query_handler.go` Search 中的 N+1 查询
- 消除 `handler/user.go` List 中的 N+1 查询（`FindByUserID` 循环）

### 假实现清理
- `mcp_server_handler.go` TestConnection：移除假成功返回，改为返回"功能未实现"错误
- `skill_service.go` InstallFromGitHub：移除假成功返回，改为返回"功能未实现"错误

### 前端错误处理
- 为内核页面 17 个 `useMutation` 站点统一添加 `onError` 处理，与 AI 模块保持一致
- 修复 `api.ts:162` 硬编码中文回退字符串

### 代码重复消除
- 合并 `Compile`/`Recompile` handler 为共享 helper
- 提取 `formatBytes` 到 `lib/utils.ts`（消除 3 份拷贝）
- 提取 `ai-kb-sources` query 为自定义 hook（消除 3 处重复声明）
- 统一 enqueue payload 构建方式（`fmt.Sprintf` → 结构体 + `json.Marshal`）
- 提取 `KnowledgeNode` 构造为工厂函数（消除 3 处重复字面量）

### 巨型文件拆分
- `knowledge/[id].tsx`（1087 行）→ 拆分为 5+ 个组件文件
- 移除死代码 `KnowledgeEdgeRepo.CreateBatch`

### 约定统一
- 统一 audit_action 命名：App 层从 `"create"` 改为 `"knowledgeBase.create"` 等命名空间格式

### TypeScript 类型安全增强
- `GraphNode` 接口补充 `x/y` 运行时字段
- `compileStatus`/`compileMethod` 从 `string` 改为联合类型

### 数据截断修复
- `knowledge/[id].tsx` 中 4 处 `pageSize=100` 伪分页，改为支持真分页或全量加载

## Capabilities

### New Capabilities
_无新增能力_

### Modified Capabilities
_本次修改不涉及 spec 级别的行为变更，仅为内部实现质量修复_

## Impact

- **后端 AI 模块**: `internal/app/ai/` 下 ~10 个文件，主要是 service 和 handler 层
- **后端内核**: `internal/handler/user.go`，`internal/service/` 下多个 service 的错误处理
- **前端 AI 模块**: `web/src/apps/ai/pages/knowledge/` 大幅重构
- **前端内核**: `web/src/pages/` 下 ~15 个文件添加 onError
- **前端公共**: `web/src/lib/api.ts`、`web/src/lib/utils.ts`
- **API 行为变更**: MCP TestConnection 和 GitHub Import 将从返回成功变为返回错误 — 这是正确行为，不算 breaking change
- **无数据库迁移**: 不涉及模型变更
