## Context

代码走查发现 AI 模块和内核存在多层面的质量问题。AI 模块是最近密集开发的区域，知识图谱的 compile/extract pipeline 中大量 DB 操作返回值被忽略，这些不是 best-effort 操作，而是状态机的关键步骤。前端同样存在系统性问题：内核页面的 mutation 普遍没有错误提示，知识页面 `[id].tsx` 已膨胀到 1087 行。

当前项目没有 Go 测试，因此不存在"改了会不会挂测试"的担忧，但也意味着修复必须格外小心。

## Goals / Non-Goals

**Goals:**
- 消除所有会导致状态机卡死的错误忽略
- 消除所有 N+1 查询
- 移除欺骗用户的假成功实现
- 统一前端 mutation 错误处理
- 将巨型文件拆分到合理大小
- 消除明显的代码重复

**Non-Goals:**
- 不重构整体架构（如 IOC 模式、中间件链）
- 不补充 Go 测试（那是另一个 change 的事）
- 不拆分 `install/index.tsx`（1040 行，但是一次性向导，优先级低）
- 不拆分 `service/auth.go`（619 行，但职责内聚）
- 不处理 4 个文件格式 TODO（PDF/DOCX/XLSX/PPTX 提取需要引入新依赖，独立处理）
- 不修改 `zodResolver(...) as any` 类型问题（需要上游库支持，投入产出比低）
- 不做分页响应格式统一（内核含 page/pageSize，App 不含 — 前端不依赖这些字段，改动收益低）

## Decisions

### D1: 后端错误处理策略 — 区分"必须成功"和"尽力而为"

**决策**: 将被忽略的错误分为两类处理：

| 类型 | 处理方式 | 示例 |
|------|----------|------|
| **必须成功** | 检查 error 并中断/回退 | `kbRepo.Update(kb)` 状态变更、`DeleteByKbID` 清理 |
| **尽力而为** | 检查 error 并 `slog.Error` 记录 | `UpdateCounts`、`logRepo.Create` |

**原因**: 不是所有操作都需要中断流程。`UpdateCounts` 失败只是计数暂时不准（下次 compile 会修正），但 `kbRepo.Update` 设置 error 状态失败会导致 KB 永久卡在 compiling。

**替代方案**: 全部中断 → 过于激进，一个 count 更新失败就中断整个 compile 不合理。

### D2: N+1 消除 — 批量查询 + 内存计算

**决策**:

1. **KnowledgeNodeHandler.GetFullGraph**: 已经全量加载了 edges，直接在内存中计算每个 node 的 edgeCount，零额外查询。

2. **KnowledgeNodeHandler.List / KnowledgeQueryHandler.Search**: 新增 `KnowledgeEdgeRepo.CountByNodeIDs(nodeIDs []uint) (map[uint]int64, error)` 方法，一条 SQL 用 `GROUP BY` 返回所有 node 的 edge count。

3. **UserHandler.List**: 新增 `UserConnectionRepo.FindByUserIDs(userIDs []uint) ([]UserConnection, error)` 方法，一条 SQL 加载所有 connections，handler 中做内存 group-by。

**原因**: GetFullGraph 的数据已经在内存里了，再查一遍 DB 纯属浪费。List/Search 需要新 repo 方法因为只有 node IDs 没有全量 edges。

### D3: 假实现处理 — 返回明确的"未实现"错误

**决策**: `MCPServerHandler.TestConnection` 和 `SkillService.InstallFromGitHub` 改为返回 HTTP 501 Not Implemented，附带清晰的错误消息说明功能尚未实现。

**替代方案**: 完全实现这两个功能 → 超出本次 sweep 的范围，MCP SSE 测试和 GitHub API 都需要独立设计。

**替代方案**: 隐藏前端入口 → 不如直接返回错误清晰，而且前端已经有按钮了。

### D4: 前端 mutation onError — 统一 toast 模式

**决策**: 内核页面的所有 `useMutation` 统一添加 `onError: (err) => toast.error(err.message)`，与 AI 模块保持一致。

**原因**: 项目已有统一的 toast 体系（sonner），AI 模块已建立了这个模式。不需要发明新模式，只需要把内核页面对齐。

### D5: `knowledge/[id].tsx` 拆分方案

**决策**: 按 tab 拆分为独立组件文件：

```
web/src/apps/ai/pages/knowledge/
├── [id].tsx                          ← 主页面，~200 行（tab 切换 + 顶栏 + mutations）
├── components/
│   ├── sources-tab.tsx               ← SourcesTab
│   ├── knowledge-graph-tab.tsx       ← KnowledgeGraphTab + KnowledgeGraphView
│   ├── node-table-view.tsx           ← NodeTableView + NodeRow
│   ├── recall-panel.tsx              ← RecallPanel
│   ├── compile-logs-tab.tsx          ← CompileLogsTab
│   └── status-badges.tsx             ← CompileStatusBadge + ExtractStatusBadge
```

同时提取 `useKbSources(kbId)` 自定义 hook 消除 3 处重复的 query 声明。

### D6: audit_action 命名规范

**决策**: App 层的 audit_action 统一采用 `<resource>.<verb>` 格式，与内核一致：

| 当前 | 修改为 |
|------|--------|
| `"create"` (KB handler) | `"knowledgeBase.create"` |
| `"update"` (KB handler) | `"knowledgeBase.update"` |
| `"delete"` (KB handler) | `"knowledgeBase.delete"` |
| 同理其他 AI/License/Node handlers... | `"<resource>.<verb>"` |

### D7: `api.ts` 硬编码中文回退

**决策**: 将 `let message = '密码已过期，请修改密码'` 改为英文 `'Password has expired'`。服务端 409 响应正文已包含 i18n 处理后的消息，这只是 fallback。

### D8: formatBytes 去重

**决策**: 将 `formatBytes` 函数移至 `web/src/lib/utils.ts`，三处调用点改为 `import { formatBytes } from '@/lib/utils'`。

### D9: 后端 Compile/Recompile 合并

**决策**: 提取私有方法 `enqueueCompile(c *gin.Context, recompile bool)`，`Compile` 和 `Recompile` handler 各自一行调用，只传不同的 audit action 和 recompile 参数。

### D10: Enqueue payload 构建统一

**决策**: `knowledge_extract_service.go` 内部的 `fmt.Sprintf` 手拼 JSON 全部改为调用已有的 `EnqueueExtract`/`EnqueueCompile` 公开方法。这些方法已经正确使用了结构体 + `json.Marshal`。

### D11: 前端 pageSize=100 伪分页

**决策**: 分场景处理：
- **SourcesTab / NodeTableView**: 保持 pageSize=100 但添加"加载全部"提示或加一个简易分页控件（知识库超过 100 个 source 在产品层面是合理场景）
- **KnowledgeGraphView**: 图形视图需要全量数据，改为不传 pageSize（后端返回全量），同时在后端 FindByKbID 方法中添加合理上限（如 500）
- **CompileLogsTab**: 50 条够用，但显示"最近 50 条"提示

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 后端错误处理变更可能改变 compile 流程行为 | 严格区分"必须成功"和"尽力而为"，后者只加 log 不改流程 |
| `[id].tsx` 拆分可能引入 import 循环或 prop 传递复杂度 | 类型定义提取到 `types.ts`，共享数据通过 React Query key 获取而非 prop drilling |
| audit_action 命名变更影响现有审计日志查询 | 旧日志保持不变，只影响新产生的日志；如有报表依赖需同步更新 |
| MCP TestConnection 和 GitHub Import 从"成功"变为"失败" | 这是正确行为，前端 UI 已有错误显示能力 |
| 删除 `CreateBatch` 死代码可能影响未来使用 | 需要时可以在 git 历史找回，死代码不应保留 |
