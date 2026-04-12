## 1. 后端：错误处理修复（P0 — 状态机卡死）

- [x] 1.1 修复 `knowledge_compile_service.go` HandleCompile 中所有 `kbRepo.Update(kb)` 调用 — 错误时 `slog.Error` 记录（状态回写是 best-effort，函数已经要 return error 了）
- [x] 1.2 修复 `knowledge_compile_service.go` 中 `edgeRepo.DeleteByKbID` 和 `nodeRepo.DeleteByKbID` 的返回值 — recompile 清库失败必须中断
- [x] 1.3 修复 `knowledge_compile_service.go` writeCompileOutput 中 `nodeRepo.Create/Update` 的返回值 — 降级路径中的 Create 需要 log
- [x] 1.4 修复 `knowledge_extract_service.go` 中 `sourceRepo.Update` 的返回值 — 错误路径中的状态写入需要 log
- [x] 1.5 修复 `knowledge_extract_service.go` 中 `engine.Enqueue` 的返回值 — 失败时 log，不中断主流程
- [x] 1.6 修复 `knowledge_base_service.go` Delete 中三个 `DeleteByKbID` — 任一失败则返回错误，不删主记录
- [x] 1.7 修复 `knowledge_source_service.go` 中两处 `kbRepo.UpdateCounts` — 失败时 log
- [x] 1.8 修复多个 service 的 `FindByID` 错误处理 — 区分 `gorm.ErrRecordNotFound` 和其他 DB 错误（`KnowledgeSourceService.Delete`、`SkillService.Get`、`ProviderService.Get`、`ModelService.Get`）

## 2. 后端：N+1 查询消除（P1 — 性能）

- [x] 2.1 新增 `KnowledgeEdgeRepo.CountByNodeIDs(nodeIDs []uint) (map[uint]int64, error)` — 单条 SQL `GROUP BY from/to node_id`
- [x] 2.2 重构 `KnowledgeNodeHandler.List` 使用批量 edge count
- [x] 2.3 重构 `KnowledgeNodeHandler.GetFullGraph` 从已加载的 edges 在内存中计算 edgeCount
- [x] 2.4 重构 `KnowledgeQueryHandler.Search` 使用批量 edge count
- [x] 2.5 新增 `UserConnectionRepo.FindByUserIDs(userIDs []uint) ([]UserConnection, error)` — 单条 SQL `WHERE user_id IN (?)`
- [x] 2.6 重构 `UserHandler.List` 使用批量 connections 加载

## 3. 后端：假实现清理（P0 — 欺骗用户）

- [x] 3.1 修改 `MCPServerHandler.TestConnection` — 返回 HTTP 501 "MCP SSE connection test is not yet implemented"
- [x] 3.2 修改 `SkillService.InstallFromGitHub` — 返回错误 "GitHub skill import is not yet implemented"，handler 层返回 HTTP 501

## 4. 后端：代码重复消除

- [x] 4.1 合并 `KnowledgeBaseHandler.Compile` 和 `Recompile` 为共享 helper `enqueueCompile(c *gin.Context, recompile bool)`
- [x] 4.2 提取 `writeCompileOutput` 中 `KnowledgeNode` 构造为工厂函数 `newConceptNode(kbID uint, n LLMNode, sourceIDs []uint) *KnowledgeNode`
- [x] 4.3 统一 `knowledge_extract_service.go` 内部 enqueue 调用 — `fmt.Sprintf` 手拼 JSON 改为调用 `EnqueueExtract`/`EnqueueCompile`
- [x] 4.4 删除 `KnowledgeEdgeRepo.CreateBatch` 死代码

## 5. 后端：约定统一

- [x] 5.1 统一 AI App 所有 handler 的 `audit_action` 为 `<resource>.<verb>` 格式（knowledge_base_handler、knowledge_source_handler、provider_handler、model_handler、skill_handler、mcp_server_handler、knowledge_node_handler）
- [x] 5.2 统一 License App handler 的 `audit_action` 格式
- [x] 5.3 统一 Node App handler 的 `audit_action` 格式

## 6. 前端：mutation 错误处理（P0 — 静默失败）

- [x] 6.1 为 `pages/announcements/` 的 create/update/delete mutation 添加 `onError` toast
- [x] 6.2 为 `pages/auth-providers/` 的 toggle/save mutation 添加 `onError` toast
- [x] 6.3 为 `pages/menus/` 的 sort/create/update mutation 添加 `onError` toast
- [x] 6.4 为 `pages/roles/` 的 delete/permission-save/create/update mutation 添加 `onError` toast
- [x] 6.5 为 `pages/sessions/kick-dialog.tsx` 的 kick mutation 添加 `onError` toast
- [x] 6.6 为 `pages/settings/` 的 connections/logo/scheduler/site-name mutation 添加 `onError` toast
- [x] 6.7 为 `pages/tasks/` 的 pause/resume/trigger mutation 添加 `onError` toast
- [x] 6.8 为 `pages/users/` 的 delete mutation 添加 `onError` toast

## 7. 前端：api.ts 修复

- [x] 7.1 将 `api.ts:162` 硬编码中文回退 `'密码已过期，请修改密码'` 改为英文 `'Password has expired'`

## 8. 前端：knowledge/[id].tsx 拆分

- [x] 8.1 创建 `components/status-badges.tsx` — 提取 CompileStatusBadge + ExtractStatusBadge
- [x] 8.2 创建 `components/sources-tab.tsx` — 提取 SourcesTab
- [x] 8.3 创建 `components/knowledge-graph-view.tsx` — 提取 KnowledgeGraphView（ForceGraph2D 可视化）
- [x] 8.4 创建 `components/recall-panel.tsx` — 提取 RecallPanel
- [x] 8.5 创建 `components/node-table-view.tsx` — 提取 NodeTableView + NodeRow
- [x] 8.6 创建 `components/compile-logs-tab.tsx` — 提取 CompileLogsTab
- [x] 8.7 重构 `[id].tsx` 主文件 — import 拆分出的组件，目标 ~200 行
- [x] 8.8 提取 `useKbSources(kbId)` 自定义 hook 消除 3 处重复 query 声明

## 9. 前端：代码去重与类型修复

- [x] 9.1 将 `formatBytes` 移至 `web/src/lib/utils.ts`，更新三处 import（`skill-upload-sheet.tsx`、`source-upload.tsx`、`[id].tsx`）
- [x] 9.2 修复 `GraphNode` 接口 — 补充 `x?: number; y?: number` 运行时字段
- [x] 9.3 将 `compileStatus`/`compileMethod` 类型从 `string` 改为对应联合类型

## 10. 前端：pageSize 伪分页处理

- [x] 10.1 SourcesTab 和 NodeTableView — 添加 "showing first 100" 提示（当数据超过 pageSize 时）
- [x] 10.2 KnowledgeGraphView — 使用后端 graph 端点全量返回，节点数量在图上已有展示
