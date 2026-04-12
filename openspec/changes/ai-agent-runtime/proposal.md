## Why

Metis 已有 AI 基础设施（Provider/Model/Tool/MCP/Skill/Knowledge），但缺少将它们串联为可交互智能体的运行时。用户需要创建 Agent、与之对话、让它调用工具完成任务。这是 AI 模块从"配置管理"到"真正能用"的关键一步。

## What Changes

### Agent 定义与管理

- 新增 Agent 实体，支持两种类型：
  - **assistant**（AI 助手）：Server 内执行，支持可扩展的执行策略（ReAct / Plan & Execute 等），配置模型、工具、知识库、MCP、技能、系统提示词
  - **coding**（编程助手）：委托外部编程工具（Claude Code / Codex / OpenCode / Aider），支持本机执行（Server subprocess）和远程执行（Node/Sidecar 托管）
- Agent CRUD API + 可见性控制（private / team / public）
- 预设模板系统，快速创建常见场景 Agent

### 会话与消息

- Agent Session 生命周期管理（创建、对话、中断、销毁）
- 消息持久化存储（user / assistant / tool_call / tool_result）
- 上下文窗口管理（历史消息截断策略）
- Server → Browser SSE 流式输出

### 记忆系统

- Per-Agent-Per-User 的跨会话记忆
- 结构化条目（key + content），支持 Agent 自动提取和用户手动管理
- 记忆注入到 Agent 上下文

### 执行引擎（Gateway + Executors）

- Agent Gateway 接收用户消息，组装完整上下文（历史 + 记忆 + 知识），分发到对应 Executor
- **ReactExecutor**：Server 内 LLM → Tool Call → Observe 循环
- **PlanAndExecuteExecutor**：Server 内先规划再逐步执行
- **LocalCodingExecutor**：Server 本机 spawn 编程工具子进程
- **RemoteCodingExecutor**：通过 Node/Sidecar SSE 下发到远程节点执行
- 统一事件协议（content_delta / tool_call / tool_result / done / cancelled）
- 中断机制（用户取消 → Gateway 通知 Executor 停止）

### 前端

- Agent 管理页面（列表、创建向导、配置编辑、测试对话）
- 对话界面（统一聊天 UI、会话历史列表、工具调用展示）
- 记忆管理面板（查看/删除 Agent 记住的个人信息）

## Capabilities

### New Capabilities

- `ai-agent`: Agent 实体定义、两种类型（assistant/coding）、配置 schema、CRUD API、模板系统、可见性控制
- `ai-agent-session`: 会话生命周期、消息持久化、上下文窗口截断、对话 API
- `ai-agent-memory`: 跨会话记忆、per-agent-per-user、结构化条目、自动提取与手动管理
- `ai-agent-gateway`: 请求编排、Executor 分发（React/PlanAndExecute/LocalCoding/RemoteCoding）、事件协议、SSE 流式推送、中断机制
- `ai-agent-ui`: Agent 管理后台 UI（列表、创建向导、配置、测试）
- `ai-agent-chat-ui`: 对话界面 UI（聊天、会话历史、工具展示、记忆面板）

### Modified Capabilities

_无。消费已有 capability（ai-llm-client、ai-provider、ai-model、ai-tool-registry、ai-mcp-registry、ai-skill-registry、ai-knowledge、node-management、process-def、node-sidecar-sse）但不修改其需求。_

## Impact

- **后端**: `internal/app/ai/` 新增 agent/session/memory/gateway 相关 handler/service/repository，预估 ~2000 行
- **前端**: `web/src/apps/ai/pages/agent/` 新增管理页面 + 对话界面，预估 ~2500 行
- **数据库**: 新增 5+ 张表（ai_agents, ai_agent_sessions, ai_session_messages, ai_agent_memories, ai_agent_tool_bindings 等关联表）
- **依赖**: 消费 internal/llm 客户端、Node/Sidecar SSE 基础设施、全部 AI 注册表
- **API**: 新增约 15 个 REST 端点（Agent CRUD + Session CRUD + Message + Stream + Memory）
- **Seed**: 新增默认 Agent 模板种子数据 + 菜单项 + Casbin 策略
