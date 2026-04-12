## Why

Metis 是一个 Agent First 的应用平台。所有上层应用（软件工坊、智能运维、智能监控等）都需要一个统一的 AI 基础设施层来提供能力。当前 AI 模块（`internal/app/ai/`、`web/src/apps/ai/`）是空目录，需要从零设计和建设这个核心模块。

## What Changes

本提案是 AI Infra 模块的**总体架构设计**，不直接产生代码，而是定义整个模块的分层结构、核心概念、通信协议和建设路线，作为后续各子提案的顶层指导。

### 核心理念：灵魂与躯壳

- **AI Infra = 灵魂工坊**：定义智能体的大脑（Provider + Model）、知识（Knowledge）、能力（Tool）、人格（Agent = 灵魂）
- **应用层 App = 躯壳**：例如软件工坊的"前端工程师"角色 = 躯壳（角色、权限、工作流）+ 灵魂（Coding Agent）
- 灵魂可以复用，应用层只需声明"我需要哪个灵魂"，不关心 LLM 调用细节

### 核心架构决策

**决策 1: Server = 大脑, Agent = 手脚**

Server 是单一事实来源和决策中心，Agent 是纯执行引擎：

| 职责 | Server | Agent |
|------|--------|-------|
| Session 生命周期 | ✅ 创建/恢复/销毁 | ❌ |
| 消息历史 | ✅ 存储 + 截断策略 | ❌ 不存任何状态 |
| Context window 管理 | ✅ 决定发哪些历史 | ❌ |
| 鉴权/权限/审计 | ✅ | ❌ |
| Token 计量 + 配额 | ✅ | ❌ |
| 对话记录查看 | ✅ 管理员 + 用户 | ❌ |
| 路由请求到节点 | ✅ | ❌ |
| 调 LLM + 执行 Tool | ❌ | ✅ |
| Tool call 循环编排 | ❌ | ✅ 跑完整个循环 |

**决策 2: Agent 无状态**

- Session 状态由 Agent 通过 HTTP 上报 Server，Server 存储到 DB
- Server 组装完整请求体（含截断后的历史消息）发给 Agent
- Agent 不回拉任何状态，收到什么就跑什么
- Agent 进程可随时重启，丢失的只是正在进行的 LLM 调用，Session 不丢

**决策 3: Tool call 循环由 Agent 执行，实时上报**

Agent 在一次请求里跑完所有 LLM 轮次（多轮 tool call），每步实时流式上报 Server：

```
Server ──(完整请求)──▶ Agent
                        ├─▶ LLM → tool_call → 执行 → 上报
                        ├─▶ LLM → tool_call → 执行 → 上报
                        ├─▶ LLM → 最终回复 → 上报
Server ◀──(流式上报)──── Agent
```

Server 收到流后：存档到 DB + 通过 SSE 转发给前端。用户可随时中断（Server 下发 cancel 指令）。

**决策 4: Agent 优雅 Reload**

- Agent 是 Sidecar 托管的常驻进程，维护 Instance Pool
- 配置更新时增量调整：新增 Instance 直接创建，修改的 Instance 新 Session 用新配置、旧 Session 继续
- 不粗暴重启，不丢用户会话

**决策 5: 节点管理是独立的平台级 App**

节点管理（Node + Sidecar）不属于 AI 模块，是通用平台基础设施。Sidecar 是节点级进程管家，管理 Telegraf、OTel Collector、AI Agent 等一切进程。AI Agent 只是 Sidecar 托管的进程之一。

### 模块内部分层

```
Layer 4: Agent（灵魂定义）— 人格 + 模型 + 工具 + 知识的组合
Layer 3: Tool（工具注册）— 内置 / 自定义 / MCP
Layer 2: Knowledge（知识管理）— Vectorless, 全文检索 + LLM 路由
Layer 1: Provider & Model（供应商与模型）— 最底层基座
横切面: Agent Runtime — metis-ai-agent 二进制（纯执行引擎）
横切面: Agent Gateway — Server 端请求组装 + 路由 + 流式转发
横切面: Observability（可观测）— 调用日志 + Token 用量 + 成本追踪
```

### 三个二进制

| 二进制 | 入口 | 职责 |
|--------|------|------|
| `metis` (server) | `cmd/server/` | Web UI + API + AI Infra 管理 + Agent Gateway（大脑） |
| `metis-sidecar` | `cmd/sidecar/` | 节点进程管家：心跳、拉指令、配置生成、进程管理、健康探针（平台级，非 AI 专属） |
| `metis-ai-agent` | `cmd/agent/` | AI 执行引擎：接收完整请求、调 LLM、跑 Tool call 循环、流式上报（手脚） |

共享代码通过 `internal/llm/` 包实现，Server（轻量场景如知识库摘要）和 AI Agent（重量场景如多轮对话）共用统一 LLM 客户端。

### 通信协议：全 HTTP + SSE，零外部依赖

**Sidecar ↔ Server（控制面）**：HTTP 轮询（心跳上报 + 长轮询拉指令 + 配置下载）

**AI Agent ↔ Server（数据面）**：

```
Server 发给 Agent 的请求体（完整，Agent 无需回拉）：
{
  "session_id": "xxx",
  "soul_config": { model, tools, system_prompt, ... },
  "messages": [ ... 截断后的历史 ... ],
  "new_message": { role: "user", content: "帮我重构这个函数" }
}

Agent 上报的事件流（HTTP POST streaming，NDJSON）：
{"type":"llm_start",    "turn":1, "model":"claude-sonnet"}
{"type":"content_delta", "text":"让我先看看..."}
{"type":"tool_call",     "id":"tc_1", "name":"read_file", "args":{...}}
{"type":"tool_result",   "id":"tc_1", "output":"...", "duration_ms":12}
{"type":"llm_start",    "turn":2, "model":"claude-sonnet"}
{"type":"content_delta", "text":"已修复..."}
{"type":"done",          "total_turns":2, "input_tokens":2340, "output_tokens":891}
```

**Browser ↔ Server（用户面）**：HTTP POST 发消息 + SSE 接收流式输出

一次完整请求时序：

```
Browser                    Server                         Agent                  LLM
   │                         │                              │                     │
   │──POST /chat/send───────▶│                              │                     │
   │                         │ 鉴权 + 权限校验               │                     │
   │                         │ 存 user message              │                     │
   │                         │ 组装完整请求体（含历史截断）   │                     │
   │                         │──HTTP POST────────────────▶  │                     │
   │                         │                              │──调 LLM───────────▶ │
   │◀───────SSE stream───────│◀──HTTP POST stream───────────│◀──SSE stream────── │
   │  "正在读取文件..."       │  存 tool_call                │  tool_call          │
   │                         │                              │──执行 tool──┐       │
   │                         │                              │◀────────────┘       │
   │                         │                              │──调 LLM───────────▶ │
   │◀───────SSE stream───────│◀──HTTP POST stream───────────│◀──SSE stream────── │
   │  "已修复..."            │  存 assistant message         │  最终回复           │
   │                         │  存 token usage              │                     │
   │  SSE: [DONE]            │                              │                     │
```

### Go 项目结构

```
internal/
  llm/           # 统一 LLM 客户端（Server + AI Agent 共用）
  app/ai/        # AI Infra App（仅 Server 用）
  app/node/      # 节点管理 App（独立于 AI，仅 Server 用）
  agent/         # Agent 运行时（仅 AI Agent 二进制用）
  sidecar/       # Sidecar 逻辑（仅 Sidecar 二进制用）
cmd/
  server/        # metis（已有）
  sidecar/       # metis-sidecar（新，平台级）
  agent/         # metis-ai-agent（新）
```

### App 与 Edition

```
┌──────────────────────────────────┐
│            Kernel（内核）          │  ← 始终存在
└──────────────┬───────────────────┘
     ┌─────────┼──────────┬────────────┐
     ▼         ▼          ▼            ▼
  App: Node  App: AI   App: License   ...
  节点管理    AI Infra   许可管理
```

| Edition | Node | AI | License |
|---------|------|----|---------|
| full（默认） | ✅ | ✅ | ✅ |
| license | ❌ | ❌ | ✅ |
| lite | ❌ | ❌ | ❌ |

### 建设路线

独立平台模块（可先行）：

1. **node-management** — 节点管理 App + Sidecar 二进制（通用平台基础设施）

AI Infra 模块（按序推进）：

1. **ai-provider-model** — Provider + Model CRUD + 统一 LLM 调用接口
2. **ai-knowledge** — 知识库 + 文档管理（Vectorless, FTS）
3. **ai-tool-registry** — 工具注册表（内置 + 自定义）
4. **ai-agent-soul** — 智能体/灵魂定义（常规 + Coding）
5. **ai-agent-runtime** — metis-ai-agent 二进制 + Agent Gateway + Session 管理

Node 和 AI 可部分并行，在 ai-agent-runtime 汇合（Agent 作为 Sidecar 托管的进程）。

## Capabilities

### New Capabilities
- `ai-infra-architecture`: AI 基础设施模块总体架构定义，包含核心决策（Server=大脑/Agent=手脚、Agent 无状态、Tool call 循环、优雅 Reload、节点管理独立）、分层结构、通信协议、二进制拆分、共享代码组织

## Impact

- 本提案为架构设计文档，不直接修改代码
- 后续 6 个子提案（1 个平台级 + 5 个 AI）将依据此架构逐步实现
- 最终新增 AI Infra App（`internal/app/ai/`）+ 节点管理 App（`internal/app/node/`）+ 两个新二进制（`cmd/sidecar/`、`cmd/agent/`）
