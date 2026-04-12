## Context

当前聊天界面经过第一轮 `chat-ui-redesign` 改造，已从气泡式迁移到文档流布局，但实现与设计存在偏差（用户消息仍为右对齐 pill），且多项一线产品标配功能缺失。

现有技术栈：React 19 + TypeScript 6 + React Compiler + shadcn/ui + Tailwind CSS 4 + react-markdown + react-syntax-highlighter。SSE 流式架构已就绪（`use-chat-stream.ts`），已定义 `steps`/`stepIndex` 等字段但 UI 未消费。

**现有组件结构：**
```
chat/
├── [sid].tsx                  → 主会话页（布局 + 状态 + 流式控制）
├── index.tsx                  → Agent 选择页
├── components/
│   ├── message-item.tsx       → QAPair + AIResponse + UserQuery + ToolCall/Result
│   ├── session-sidebar.tsx    → 会话列表（展开/折叠两种模式）
│   └── memory-panel.tsx       → Agent 记忆管理面板
└── hooks/
    └── use-chat-stream.ts     → SSE 连接管理
```

## Goals / Non-Goals

**Goals:**
- 消息渲染对齐一线产品视觉标准（左对齐文档流、操作可发现、Agent 标识）
- 流式生成体验完整化（thinking block、plan progress、性能指标）
- 侧边栏提升到可用级别（日期分组、重命名、删除确认）
- 空状态 / 欢迎页提供引导感
- 输入区视觉和交互提升
- 错误恢复和取消后体验完善

**Non-Goals:**
- 附件上传 / 图片粘贴（需要后端存储适配，放到 Change 3）
- @ 提及知识库（需要后端搜索 API，放到 Change 3）
- 对话导出 / 分享（独立功能，放到 Change 3）
- 对话分支 / fork（架构复杂度高，放到后续）
- Artifacts 独立渲染面板（需要 sandbox 隔离，放到后续）
- 语音输入 / 输出
- 长对话虚拟滚动（性能优化，后续按需）

## Decisions

### D1: 用户消息样式 → 左对齐浅灰卡片 + "You" 标签

**选项：**
| 方案 | 描述 | 优劣 |
|------|------|------|
| A. 浅灰卡片 + 标签 | `bg-muted rounded-xl` 带 "You" 文字标签 | 视觉区分强，可容纳编辑按钮和附件预览 |
| B. 纯文本加粗 | 无背景，仅字体加粗 | 最简洁但与 AI 回复区分度低 |
| C. 左侧竖线 | 左侧 accent 色 border-l | 优雅但扩展性差（编辑/附件难放置） |

**选择 A**。理由：Claude 和 Kimi 最新版均采用此方案；卡片容器天然适合放置编辑按钮、附件缩略图等交互元素；视觉层次分明。

### D2: 消息区宽度 → `max-w-3xl`（768px）

当前 `max-w-5xl`（1024px）在宽屏上阅读体验差。一线产品内容列宽均在 650-780px 之间。选择 `max-w-3xl` 作为内容区约束，侧边栏和输入区不受此限制。

### D3: 操作按钮可见性 → 分层策略

```
始终可见：Copy 按钮（最高频操作）、Edit 按钮（用户消息上）
Hover 显示：Regenerate、ThumbsUp/Down、More menu
消息底部右下角常驻：性能指标（token 数 · 耗时）
```

当前 `opacity-0 hover:opacity-100` 全部隐藏的做法废弃。Copy 按钮使用 `text-muted-foreground` 低调但可见。

### D4: Thinking Block → 可折叠展开组件

**方案：** 新建 `<ThinkingBlock>` 组件。

- 流式阶段：展开态，显示脉动圆点 + 计时器 + 实时文本
- 完成后：自动折叠为一行 `▸ 思考过程（Xs）`，点击可展开
- SSE 事件映射：新增 `thinking_delta` 事件类型，或复用 `content_delta` 配合 metadata 标记

**后端适配**：需要在 SSE 事件流中区分 thinking content 和 final content。两种方案：
1. 新增 `type: "thinking_delta"` 事件 → **选择此方案**，语义清晰
2. 在 `content_delta` 中加 `isThinking` 字段 → 侵入性强

### D5: Plan Progress → 步骤进度组件

**方案：** 新建 `<PlanProgress>` 组件。

SSE hook 已定义 `steps` 和 `stepIndex` 字段。UI 渲染为带进度条的步骤列表：
- `✅` 已完成步骤（带耗时）
- `⏳` 当前步骤（脉动动画）
- `○` 待执行步骤
- 底部进度条 `n/total`

完成后折叠为 `✅ 计划完成（N步 · Xs）`。

### D6: 输入区 → 悬浮卡片 + 底部工具栏

```
结构：
┌─ 悬浮卡片（shadow-lg, rounded-2xl, bg-background/95 backdrop-blur）──┐
│  [附件预览区]（未来扩展，本期不实现）                                   │
│  textarea（自适应高度）                                                │
│  ─────────────────────────────────────────────────────────────────── │
│  工具栏：[📎]（灰色占位）        [■ 停止] 或 [▶ 发送]                  │
└─────────────────────────────────────────────────────────────────────┘
```

底部工具栏预留左侧附件按钮位置（本期灰色 disabled），右侧放发送/停止按钮。工具栏与 textarea 用细线分隔。

### D7: 侧边栏日期分组 → 前端计算

日期分组在前端用工具函数计算（不需要后端改动）：
```typescript
groupSessionsByDate(sessions): Map<string, AgentSession[]>
// keys: "today" | "yesterday" | "last7days" | "last30days" | "older"
```

i18n key 映射到对应标签文本。

### D8: 会话重命名 → inline edit

侧边栏会话标题支持双击进入编辑模式（inline input），Enter 确认，Escape 取消。需要后端新增 `PATCH /api/v1/ai/sessions/:sid` 端点来更新 title。

### D9: 消息编辑 → 编辑 + 重新生成

用户消息卡片右上角显示编辑图标。点击后：
1. 消息内容变为可编辑 textarea
2. 显示 "保存并重新生成" / "取消" 按钮
3. 提交后，后端截断该消息之后的所有消息，重新生成

需要后端新增 `PUT /api/v1/ai/sessions/:sid/messages/:mid` 端点。

### D10: 取消后继续生成 → 保留部分内容

取消流式生成时：
1. 已生成的文本保留在界面上（不清空 `streamingText`）
2. 显示 `⚠️ 生成已停止` 提示
3. 提供 "继续生成" 和 "重新生成" 两个按钮
4. "继续生成" 调用后端 `POST /api/v1/ai/sessions/:sid/continue`

### D11: Tool Call 富展示 → 按类型定制

为已知工具类型提供定制化渲染：

| 工具类型 | 展示 |
|---------|------|
| `search_knowledge` | 🔍 搜索图标 + 知识库名 + 结果数量摘要 |
| `execute_code` | 💻 代码执行 + 语言标签 + 输出预览 |
| 未知工具 | 🔧 通用工具名 + 可展开 JSON（当前行为） |

通过 `toolRenderers` 注册表实现，支持后续扩展。

### D12: 错误内联展示 → 替代 Toast

流式错误不再使用 toast，改为在消息流中内联展示错误卡片：
```
┌─ ⚠ 生成失败 ──────────────────────────┐
│ 模型响应超时                            │
│                         [🔄 重试]      │
└────────────────────────────────────────┘
```

发送失败的错误仍用 toast（不影响消息流）。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|------|------|------|
| React Compiler 兼容性 | 新组件可能触发 hook 顺序问题 | 所有 hooks 在 early return 之前声明，避免 IIFE，测试每个新组件 |
| 后端 API 新增 | rename / edit message / continue 需要后端配合 | 前端先实现 UI 骨架，后端 API 就绪后对接。不阻塞核心视觉改造 |
| Thinking block 后端适配 | 需要新的 SSE 事件类型 | 先用 `content_delta` 模拟，后续切换到 `thinking_delta` |
| 消息区宽度收窄 | 代码块在窄屏可能需要更多横向滚动 | 代码块允许 overflow-x-auto，不受 max-w-3xl 限制 |
| 侧边栏重构量 | 日期分组 + 重命名 + 搜索改动较大 | 保持组件 API 不变，内部重构。搜索放 P1 不在本期 |
