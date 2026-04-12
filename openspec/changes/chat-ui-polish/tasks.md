## 1. 消息布局重构

- [x] 1.1 将 `UserQuery` 组件从右对齐 pill 改为左对齐卡片（`bg-muted rounded-xl` + "You" 标签 + 编辑图标）
- [x] 1.2 为 `AIResponse` 组件顶部添加 Agent 名称标识（需从 session 数据传入 agent name）
- [x] 1.3 消息区容器宽度从 `max-w-5xl` 改为 `max-w-3xl` 居中
- [x] 1.4 调整 `QAPair` 组件结构，移除右对齐相关样式，统一文档流排版

## 2. 操作按钮可见性修复

- [x] 2.1 `AIResponse` 中 Copy 按钮改为始终可见（`text-muted-foreground`），移除 `opacity-0`
- [x] 2.2 Regenerate、ThumbsUp、ThumbsDown 保持 hover 显示，但改用 `group-hover` 而非整个 action bar 的 opacity
- [x] 2.3 `UserQuery` 添加始终可见的 Edit 图标按钮（右上角）
- [x] 2.4 AI 回复底部右侧添加性能指标显示区域（token 数 · 耗时），数据从 SSE `done` 事件获取

## 3. Thinking Block 组件

- [x] 3.1 新建 `components/thinking-block.tsx` 组件，支持 expanded/collapsed 两种状态
- [x] 3.2 展开态：脉动圆点指示器 + 计时器 + 实时文本内容
- [x] 3.3 折叠态：单行摘要 `▸ 思考过程（Xs）`，点击切换
- [x] 3.4 在 `use-chat-stream.ts` 中添加 `thinking_delta` 事件处理，累积到独立的 `thinkingText` 状态
- [x] 3.5 在 `[sid].tsx` 中集成 ThinkingBlock，在 AIResponse 上方渲染

## 4. Plan Progress 组件

- [x] 4.1 新建 `components/plan-progress.tsx` 组件，接收 `steps` 数组和 `currentStepIndex`
- [x] 4.2 渲染步骤列表：✅ 已完成（带耗时）、⏳ 当前（脉动动画）、○ 待执行
- [x] 4.3 底部进度条 `n/total`
- [x] 4.4 完成后自动折叠为 `✅ 计划完成（N步 · Xs）`
- [x] 4.5 在 `use-chat-stream.ts` 中消费 `steps` 和 `stepIndex` 字段，维护 plan 状态
- [x] 4.6 在 `[sid].tsx` 中集成 PlanProgress，在 AIResponse 上方渲染（当有 steps 时）

## 5. 用户消息编辑

- [x] 5.1 `UserQuery` 点击编辑图标进入编辑模式：内容变为 textarea + "保存并重新生成" / "取消" 按钮
- [x] 5.2 保存时调用 `PUT /api/v1/ai/sessions/:sid/messages/:mid` 更新消息内容
- [x] 5.3 前端截断该消息之后的所有 QA pairs，触发新的 SSE 流式生成
- [x] 5.4 后端新增 `PUT /api/v1/ai/sessions/:sid/messages/:mid` 端点（更新 content + 删除后续消息）

## 6. 输入区视觉升级

- [x] 6.1 输入区外层改为悬浮卡片样式：`shadow-lg rounded-2xl bg-background/95 backdrop-blur-sm`
- [x] 6.2 拆分为上下两区：上方 textarea 区域，下方工具栏（`border-t border-border/50` 分隔）
- [x] 6.3 工具栏左侧放附件按钮（本期 disabled 灰色占位），右侧放发送/停止按钮
- [x] 6.4 流式生成时，停止按钮从工具栏移到消息区下方居中显示

## 7. 空状态欢迎页

- [x] 7.1 新建 `components/welcome-screen.tsx` 组件，接收 agent 信息
- [x] 7.2 展示 Agent 图标（按类型）、名称、描述
- [x] 7.3 展示最多 4 个建议提示卡片（2x2 grid），点击即发送
- [x] 7.4 建议提示数据来源：Agent 配置的 `suggestedPrompts` 字段，无则按 agent type 提供默认集合
- [x] 7.5 在 `[sid].tsx` 中当 `messages.length === 0 && !isStreaming` 时渲染 WelcomeScreen 替代空消息区

## 8. 侧边栏增强

- [x] 8.1 新增 `groupSessionsByDate()` 工具函数，返回 today/yesterday/last7days/last30days/older 分组
- [x] 8.2 侧边栏展开模式中，按日期分组渲染会话列表，每组带翻译后的 section header
- [x] 8.3 会话条目增加 "⋯" 更多按钮（hover 显示），弹出 DropdownMenu（重命名、置顶、删除）
- [x] 8.4 删除操作改为先弹出确认 popover/dialog，确认后再执行
- [x] 8.5 双击会话标题进入 inline 编辑模式，Enter 保存调用 `PATCH /api/v1/ai/sessions/:sid`，Escape 取消
- [x] 8.6 后端新增 `PATCH /api/v1/ai/sessions/:sid` 端点（更新 title 和 pinned 状态）

## 9. 流式体验增强

- [x] 9.1 取消流式生成时保留已生成文本（不清空 `streamingText`），显示 "⚠️ 生成已停止" 内联提示
- [x] 9.2 取消后显示 "继续生成" 和 "重新生成" 两个操作按钮
- [x] 9.3 "继续生成" 调用 `POST /api/v1/ai/sessions/:sid/continue`（后端新增端点）
- [x] 9.4 流式错误改为内联错误卡片（红色左边框 + 错误信息 + 重试按钮），移除 toast.error
- [x] 9.5 SSE `done` 事件中的 `durationMs`、`inputTokens`、`outputTokens` 数据传递给 AIResponse 组件显示

## 10. Tool Call 富展示

- [x] 10.1 新建 `components/tool-renderers.tsx`，定义 `toolRenderers` 注册表（Map<string, React.FC>）
- [x] 10.2 为 `search_knowledge` 实现定制渲染：搜索图标 + 知识库名 + 结果摘要
- [x] 10.3 `ToolCall` 组件改为先查 registry，有匹配则用定制渲染，否则 fallback 到通用 JSON 展示
- [x] 10.4 工具执行耗时显示（从 tool_result metadata 中获取）

## 11. 国际化补充

- [x] 11.1 `en.json` / `zh-CN.json` 新增 thinking block 相关 keys（thinking、thinkingProcess、thinkingDuration）
- [x] 11.2 新增 plan progress 相关 keys（plan、step、planCompleted、planSteps）
- [x] 11.3 新增 welcome screen 相关 keys（welcome、suggestedPrompts、defaultPrompts）
- [x] 11.4 新增侧边栏日期分组 keys（today、yesterday、last7Days、last30Days、older）
- [x] 11.5 新增消息编辑相关 keys（edit、saveAndRegenerate、cancelEdit）
- [x] 11.6 新增流式增强相关 keys（stopped、continueGenerating、retry、generationError）

## 12. 后端 API 适配

- [x] 12.1 新增 `PATCH /api/v1/ai/sessions/:sid` — 更新 session title 和 pinned 字段
- [x] 12.2 新增 `PUT /api/v1/ai/sessions/:sid/messages/:mid` — 编辑消息内容 + 截断后续消息
- [x] 12.3 新增 `POST /api/v1/ai/sessions/:sid/continue` — 继续生成（从上次中断点恢复）
- [x] 12.4 AgentSession model 添加 `pinned` 布尔字段（默认 false），AutoMigrate
- [x] 12.5 SSE 事件流中区分 `thinking_delta` 和 `content_delta` 事件类型
- [x] 12.6 Agent model 添加 `suggested_prompts` JSON 字段（字符串数组），管理页面可配置
