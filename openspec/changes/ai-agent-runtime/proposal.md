## Why

有了灵魂定义（Agent）和节点基础设施（Sidecar），还需要一个 AI 运行时来真正执行智能体。metis-ai-agent 是运行在节点上的常驻进程，由 Sidecar 托管，管理多个 Agent 会话，支持常规 Agent（直接调 LLM）和 Coding Agent（管理 Claude Code / OpenCode 子进程）两种运行时模式。

## What Changes

### AI Agent 二进制（cmd/agent/）

- 新增 `cmd/agent/main.go` + `internal/agent/` 包
- 由 Sidecar 启动，配置文件由 Sidecar 配置下发生成在 `generate/ai-agent/config.yaml`
- 启动后通过 SSE 连接 Server 接收指令（会话创建、用户消息、控制指令）
- 输出通过 HTTP POST streaming body 推送回 Server
- 一个进程管理多个会话，每个会话对应一个 Agent 灵魂

### Session Manager

- 维护 `sessions map[sessionID]*AgentSession`
- 收到 `session.create` → 从 Server 拉取 Agent 定义 → 根据 type 初始化对应 Runtime
- 收到 `session.message` → 路由到对应 session 处理
- 收到 `session.cancel` / `session.destroy` → 控制会话生命周期

### Runtime 抽象

```go
type AgentRuntime interface {
    Init(config AgentConfig) error
    HandleMessage(ctx context.Context, msg Message) (<-chan Event, error)
    Stop() error
}
```

**LLM Runtime**（chat / ops / assistant 类型）：
- 调用 internal/llm 统一客户端
- 组装 System Prompt + Knowledge 上下文 + Tool 定义
- 处理 Tool Calls（调用内置工具或 webhook）
- 管理对话历史

**Coding Runtime**（coding 类型）：
- 根据 Agent config 中的 runtime 字段选择编码工具
- Spawn 子进程（claude-code / opencode / aider）
- 注入 instructions + knowledge 到编码工具配置
- 桥接 stdin/stdout/stderr，转为 Event 流
- 管理子进程生命周期

### Server 端 Agent Gateway

- 新增 SSE endpoint: `GET /api/v1/ai/agent/connect?node_id=xxx&token=xxx`
- 新增 streaming 接收: `POST /api/v1/ai/sessions/:sid/events`（Agent 推送输出）
- 新增 Browser 端: `POST /api/v1/ai/sessions` (创建会话), `POST /api/v1/ai/sessions/:sid/messages` (发消息), `GET /api/v1/ai/sessions/:sid/stream` (SSE 接收输出), `DELETE /api/v1/ai/sessions/:sid` (销毁)
- Session Bridge：Agent SSE 输出 → 内存 channel → Browser SSE 转发
- 自动记录 AILog

### 通信协议

全链路 SSE：
```
LLM Provider ──SSE──→ AI Agent ──HTTP Stream──→ Server ──SSE──→ Browser
```

Agent 接收指令（Server → Agent）：
```
GET /api/v1/ai/agent/connect (SSE)
← data: {"type":"session.create","session_id":"abc","agent_code":"fe-coder"}
← data: {"type":"session.message","session_id":"abc","content":"帮我重构"}
← data: {"type":"session.cancel","session_id":"abc"}
← data: {"type":"ping"}  (每 30s 保活)
```

Agent 推送输出（Agent → Server）：
```
POST /api/v1/ai/sessions/{sid}/events
Body (NDJSON streaming):
{"type":"text_delta","content":"好的，"}
{"type":"tool_use","tool":"read_file","input":{...}}
{"type":"tool_result","output":"..."}
{"type":"done","usage":{"input_tokens":100,"output_tokens":50}}
```

### 数据模型

**AgentSession**: id, agent_code, node_id(FK), session_id(unique), user_id, app_source, status(starting | running | paused | stopped | error), started_at, stopped_at

## Capabilities

### New Capabilities
- `ai-agent-runtime`: metis-ai-agent 二进制（Session Manager + LLM Runtime + Coding Runtime）
- `ai-agent-gateway`: Server 端 Agent 连接管理 + Session Bridge + Browser SSE 推流
- `ai-session`: 会话管理 CRUD + 状态追踪

### Dependencies
- `ai-llm-client` (from ai-provider-model): LLM Runtime 调用
- `ai-agent-definition` (from ai-agent-soul): Agent 灵魂定义
- `ai-tool-registry` (from ai-tool-registry): 工具执行
- `ai-knowledge-base` (from ai-knowledge): 知识检索
- `ai-sidecar` (from ai-node-sidecar): 进程托管 + 配置下发

## Impact

- **新二进制**: `cmd/agent/` + `internal/agent/` ~1200 行
- **后端**: `internal/app/ai/` 新增 gateway + session 相关 handler/service ~500 行
- **前端**: 智能体测试对话面板 + 实例监控页面
- **数据库**: 新增 1 张表（ai_agent_sessions）
- **Makefile**: 新增 agent 编译目标
