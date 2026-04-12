## Why

当前聊天界面在第一轮改造后仍有明显的体验短板：用户消息保留了右对齐气泡风格与文档流布局矛盾，操作按钮默认隐藏（opacity-0）导致不可发现，侧边栏缺少日期分组/搜索/删除确认等基础功能，新会话无欢迎页和建议提示，流式生成体验（思考过程、计划步骤、性能指标）完全缺失。对标 ChatGPT / Claude / Kimi / DeepSeek 等一线产品，这些是构成"好用"的基础门槛。

## What Changes

- 用户消息从右对齐 pill 改为左对齐卡片风格（浅灰背景 + "You" 标签），保持文档流一致性
- 消息区内容宽度从 `max-w-5xl` 收窄到 `max-w-3xl`（~768px），匹配最佳阅读宽度
- AI 回复增加 Agent 名称标识
- 操作按钮（复制）改为始终可见，其他操作 hover 显示
- 新增 Thinking Block 组件——流式展示推理过程，完成后自动折叠
- 新增 Plan Progress 组件——展示 Plan-and-Execute 策略的步骤进度
- 新增消息编辑功能——用户可编辑已发送消息并从该点重新生成
- 输入区视觉升级为悬浮卡片样式（shadow + 圆角 + 半透明背景）
- 新增空状态欢迎页——展示 Agent 信息和建议提示
- 侧边栏增加日期分组（今天/昨天/最近7天/更早）、会话重命名、删除确认
- 流式体验增强：停止按钮居中、完成后显示耗时和 token 数、取消后保留已生成内容和"继续生成"按钮
- 错误状态从 toast 改为内联显示 + 重试按钮
- Tool Call 渲染升级——按工具类型展示友好的摘要信息，而非原始 JSON

## Capabilities

### New Capabilities
- `ai-chat-ui`: 聊天会话界面的完整 UI 规格，包括消息渲染、输入区、流式体验、空状态
- `ai-chat-sidebar`: 聊天侧边栏的 UI 规格，包括会话列表、日期分组、搜索、管理操作

### Modified Capabilities
- `shared-ui-patterns`: 新增消息卡片、悬浮输入框、thinking block 等通用 UI 模式

## Impact

- **前端文件**：`web/src/apps/ai/pages/chat/` 下所有组件重构
- **新增组件**：thinking-block、plan-progress、welcome-screen、message-actions toolbar
- **Locales**：`en.json` / `zh-CN.json` 新增 thinking/plan/welcome 相关键
- **后端**：需少量适配——SSE 事件增加 thinking 类型字段、session API 增加 rename/edit message 端点
- **依赖**：无新依赖引入，复用现有 shadcn/ui + react-markdown + prism 技术栈
