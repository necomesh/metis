## Why

Metis 是一个 Agent First 的应用平台。所有上层应用（软件工坊、智能运维、智能监控等）都需要一个统一的 AI 基础设施层来提供能力。当前 AI 模块（`internal/app/ai/`、`web/src/apps/ai/`）是空目录，需要从零设计和建设这个核心模块。

## What Changes

本提案是 AI Infra 模块的**总体架构设计**，不直接产生代码，而是定义整个模块的分层结构、核心概念、通信协议和建设路线，作为后续各子提案的顶层指导。

### 核心理念：灵魂与躯壳

- **AI Infra = 灵魂工坊**：定义智能体的大脑（Provider + Model）、知识（Knowledge）、能力（Tool）、人格（Agent = 灵魂）
- **应用层 App = 躯壳**：例如软件工坊的"前端工程师"角色 = 躯壳（角色、权限、工作流）+ 灵魂（Coding Agent）
- 灵魂可以复用，应用层只需声明"我需要哪个灵魂"，不关心 LLM 调用细节

### 模块内部分层

```
Layer 4: Agent（灵魂定义）— 人格 + 模型 + 工具 + 知识的组合
Layer 3: Tool（工具注册）— 内置 / 自定义 / MCP
Layer 2: Knowledge（知识管理）— Vectorless, 全文检索 + LLM 路由
Layer 1: Provider & Model（供应商与模型）— 最底层基座
横切面: Node（节点管理）— Sidecar 进程托管 + 配置下发
横切面: Observability（可观测）— 调用日志 + Token 用量 + 成本追踪
```

### 三个二进制

| 二进制 | 入口 | 职责 |
|--------|------|------|
| `metis` (server) | `cmd/server/` | Web UI + API + AI Infra 管理 + 直接调 LLM（轻量场景） |
| `metis-sidecar` | `cmd/sidecar/` | 节点进程管家：心跳、拉指令、配置生成、进程管理、健康探针 |
| `metis-ai-agent` | `cmd/agent/` | AI 运行时：Session 管理、LLM Runtime、Coding Runtime |

共享代码通过 `internal/llm/` 包实现，Server 和 AI Agent 二进制共用统一 LLM 客户端。

### 通信协议：全 HTTP + SSE，零外部依赖

- **Sidecar ↔ Server（控制面）**：HTTP 轮询（心跳上报 + 长轮询拉指令 + 配置下载）
- **AI Agent ↔ Server（数据面）**：SSE 接收指令 + HTTP POST streaming 推送输出
- **Browser ↔ Server（用户面）**：HTTP POST 发消息 + SSE 接收流式输出
- **AI Agent ↔ LLM Provider**：标准 LLM API（HTTP POST → SSE 响应）

### Go 项目结构

```
internal/
  llm/           # 统一 LLM 客户端（Server + AI Agent 共用）
  app/ai/        # AI Infra App（仅 Server 用）
  agent/         # Agent 运行时（仅 AI Agent 二进制用）
  sidecar/       # Sidecar 逻辑（仅 Sidecar 二进制用）
cmd/
  server/        # metis（已有）
  sidecar/       # metis-sidecar（新）
  agent/         # metis-ai-agent（新）
```

### 建设路线

1. **ai-provider-model** — Provider + Model CRUD + 统一 LLM 调用接口
2. **ai-knowledge** — 知识库 + 文档管理（Vectorless, FTS）
3. **ai-tool-registry** — 工具注册表（内置 + 自定义）
4. **ai-agent-soul** — 智能体/灵魂定义（常规 + Coding）
5. **ai-node-sidecar** — 节点管理 + Sidecar 二进制 + Token 鉴权
6. **ai-agent-runtime** — metis-ai-agent 二进制 + SSE 通信 + Session 管理

## Capabilities

### New Capabilities
- `ai-infra-architecture`: AI 基础设施模块总体架构定义，包含分层结构、通信协议、二进制拆分、共享代码组织

## Impact

- 本提案为架构设计文档，不直接修改代码
- 后续 6 个子提案将依据此架构逐步实现
- 最终新增一个完整的 AI Infra App（`internal/app/ai/`）+ 两个新二进制（`cmd/sidecar/`、`cmd/agent/`）
