## Why

有了灵魂定义（Agent Soul）和节点基础设施（Node App + Sidecar），还需要一个 AI 运行时来真正执行智能体。metis-ai-agent 是运行在节点上的**无状态常驻进程**，由 Sidecar 托管，作为纯执行引擎接收 Server 下发的完整请求、调用 LLM、执行 Tool call 循环、流式上报结果。

核心原则：**Server 是大脑，Agent 是手脚。** Agent 不存任何状态，不做任何决策，所有状态和控制逻辑在 Server 端。

## What Changes

### AI Agent 二进制（cmd/agent/ — 无状态执行引擎）

- 新增 `cmd/agent/main.go` + `internal/agent/` 包
- 由 Sidecar 启动和托管，配置文件由 Sidecar 配置下发
- 常驻进程，维护 Instance Pool（根据 Soul 配置创建运行时实例）
- **无状态**：不存 Session、不存消息历史、不做截断决策、不做权限判断
- 收到完整请求 → 调 LLM → 跑 Tool call 循环 → 流式上报 → 结束
- 进程可随时重启，丢失的仅是正在进行的 LLM 调用

### Instance Pool 与优雅 Reload

Agent 进程内维护按 Soul 配置创建的 Instance Pool：

```
metis-ai-agent（常驻进程）
│
├── Instance: "coding-agent-v2"  ← 持有 LLM 客户端配置 + 工具绑定
├── Instance: "ops-agent-v1"
└── ...
```

配置更新时增量调整（不粗暴重启）：
- 新增的 Soul → 直接创建 Instance
- 删除的 Soul → 等当前请求完成后销毁
- 修改的 Soul → 新请求用新配置，进行中的请求继续用旧配置

### Server 端 Agent Gateway（大脑）

Server 端负责所有决策和状态管理：

**请求组装**：收到用户消息后，Server 负责：
1. 鉴权 + 权限校验
2. 创建或恢复 Session
3. 存储用户消息到 DB
4. 从 DB 加载消息历史 + 执行截断策略（context window 管理）
5. 组装完整请求体发给 Agent

**请求体格式**（Server → Agent）：
```json
{
  "session_id": "xxx",
  "soul_config": {
    "model": "claude-sonnet",
    "system_prompt": "你是...",
    "tools": [...],
    "temperature": 0.7,
    "max_tokens": 4096
  },
  "messages": [
    {"role": "user", "content": "之前的问题..."},
    {"role": "assistant", "content": "之前的回答..."},
    {"role": "user", "content": "帮我重构这个函数"}
  ]
}
```

Agent 收到后直接执行，不需要回拉任何数据。

**结果接收**：收到 Agent 上报的事件流后：
1. 按类型存档到 DB（messages、tool_calls、token_usage）
2. 通过 SSE 转发给前端（content_delta、tool_call 等用户关心的事件）
3. 记录 AILog（调用日志 + Token 用量 + 成本）

### Agent 上报协议（Agent → Server）

Agent 通过 HTTP POST streaming body 推送 NDJSON 事件流：

```
POST /api/v1/ai/sessions/{sid}/events
Content-Type: application/x-ndjson

{"type":"llm_start",     "turn":1, "model":"claude-sonnet"}
{"type":"content_delta",  "text":"让我先看看代码..."}
{"type":"tool_call",      "id":"tc_1", "name":"read_file", "args":{"path":"main.go"}}
{"type":"tool_result",    "id":"tc_1", "output":"package main\n...", "duration_ms":12}
{"type":"llm_start",     "turn":2, "model":"claude-sonnet"}
{"type":"content_delta",  "text":"找到问题了，在第 42 行..."}
{"type":"tool_call",      "id":"tc_2", "name":"write_file", "args":{"path":"main.go","content":"..."}}
{"type":"tool_result",    "id":"tc_2", "output":"ok", "duration_ms":5}
{"type":"llm_start",     "turn":3, "model":"claude-sonnet"}
{"type":"content_delta",  "text":"已修复，主要改动是..."}
{"type":"done",           "total_turns":3, "input_tokens":2340, "output_tokens":891}
```

### 全链路时序

```
Browser                    Server                         Agent                  LLM
   │                         │                              │                     │
   │──POST /sessions/:sid    │                              │                     │
   │  /messages ────────────▶│                              │                     │
   │                         │ 鉴权 + 权限校验               │                     │
   │                         │ 存 user message              │                     │
   │                         │ 加载历史 + 截断              │                     │
   │                         │ 组装完整请求体                │                     │
   │                         │──POST /internal/run─────────▶│                     │
   │                         │                              │──调 LLM────────────▶│
   │◀───────SSE stream───────│◀──POST /sessions/:sid/events─│◀──SSE stream───────│
   │  "正在读取文件..."       │  存 tool_call                │  tool_call          │
   │                         │                              │──执行 tool──┐       │
   │                         │                              │◀────────────┘       │
   │                         │                              │──调 LLM────────────▶│
   │◀───────SSE stream───────│◀──HTTP POST stream───────────│◀──SSE stream───────│
   │  "已修复..."            │  存 assistant message         │  最终回复           │
   │                         │  存 token usage              │                     │
   │  SSE: [DONE]            │  记录 AILog                  │                     │
```

### 中断机制

用户点击"停止"按钮时：
1. Browser → Server: `POST /api/v1/ai/sessions/:sid/cancel`
2. Server 通过 SSE 指令通道下发 cancel 给 Agent
3. Agent 中断当前 LLM 调用，上报 `{"type":"cancelled"}` 事件
4. Server 存档已产生的部分结果

### Runtime 抽象

```go
type AgentRuntime interface {
    Init(config SoulConfig) error
    Run(ctx context.Context, req RunRequest) (<-chan Event, error)
    Stop() error
}
```

**LLM Runtime**（chat / ops / assistant 类型）：
- 调用 internal/llm 统一客户端
- 处理 Tool Calls 循环（调用内置工具或 webhook）
- 每步产生 Event 流式输出

**Coding Runtime**（coding 类型）：
- 根据 config 中的 runtime 字段选择编码工具
- Spawn 子进程（claude-code / opencode / aider）
- 注入 instructions + knowledge 到编码工具配置
- 桥接 stdin/stdout/stderr，转为 Event 流
- 管理子进程生命周期

### API 设计

**Browser 端 API**（JWT 鉴权，Server 处理）：
```
POST   /api/v1/ai/sessions                    创建会话
GET    /api/v1/ai/sessions                    会话列表
GET    /api/v1/ai/sessions/:sid               会话详情（含完整消息历史）
POST   /api/v1/ai/sessions/:sid/messages      发送消息（触发 Agent 执行）
GET    /api/v1/ai/sessions/:sid/stream         SSE 接收流式输出
POST   /api/v1/ai/sessions/:sid/cancel        中断执行
DELETE /api/v1/ai/sessions/:sid               销毁会话
```

**Agent 端 API**（Node Token 鉴权，Agent 调用）：
```
POST   /api/v1/ai/sessions/:sid/events        Agent 上报事件流（NDJSON streaming）
```

**Server → Agent 内部通信**（Agent SSE 连接接收指令）：
```
GET    /api/v1/ai/agent/connect               SSE 长连接，接收 run/cancel 指令
```

### 数据模型

**AgentSession**: id, agent_code, node_id(FK), user_id, app_source, status(running | paused | stopped | error), created_at, stopped_at

**SessionMessage**: session_id(FK), role(user | assistant | tool_call | tool_result), content(text), metadata(JSON: tool_name, tool_args, duration_ms, turn), token_count, created_at

## Capabilities

### New Capabilities
- `ai-agent-runtime`: metis-ai-agent 无状态执行引擎（Instance Pool + LLM Runtime + Coding Runtime + 优雅 Reload）
- `ai-agent-gateway`: Server 端请求组装 + 历史截断 + 路由转发 + 事件流接收存档 + SSE 推送前端
- `ai-session`: 会话管理 CRUD + 消息历史存储 + 状态追踪

### Dependencies
- `ai-llm-client` (from ai-provider-model): LLM Runtime 调用
- `ai-agent-definition` (from ai-agent-soul): Agent Soul 配置
- `ai-tool-registry` (from ai-tool-registry): 工具执行
- `ai-knowledge-base` (from ai-knowledge): 知识检索
- `node-management` (from node-management): Sidecar 进程托管 + 配置下发

## Impact

- **新二进制**: `cmd/agent/` + `internal/agent/` ~1200 行
- **后端**: `internal/app/ai/` 新增 gateway + session 相关 handler/service ~600 行
- **前端**: 对话面板 + 会话历史 + 实例监控页面
- **数据库**: 新增 2 张表（ai_agent_sessions, ai_session_messages）
- **Makefile**: 新增 agent 编译目标
