## Context

Metis AI App 已建成完整的基础设施层：Provider/Model 管理 LLM 接入，Tool/MCP/Skill 注册可用工具，Knowledge 管理知识图谱，internal/llm 提供统一 LLM 客户端。Node App 提供 Sidecar 进程托管、SSE 命令推送、配置下发能力。

缺失的是将这些基础设施串联为可交互 Agent 的运行时 — 用户目前无法创建 Agent、发起对话、让 Agent 调用工具完成任务。

## Goals / Non-Goals

**Goals:**
- 用户可创建两种类型 Agent（AI 助手 / 编程助手），配置各自所需的模型、工具、知识库等
- 统一的对话体验：无论 Agent 类型，用户通过相同的聊天界面交互
- Agent 记住与每个用户的交互偏好，跨会话持久化
- AI 助手零部署门槛（Server 内执行），编程助手默认本机执行、支持远程 Node
- 执行策略可扩展（ReAct / Plan & Execute / 未来新增）

**Non-Goals:**
- Multi-Agent 协作（Agent 之间对话）
- Agent 市场 / 跨实例分享
- 语音 / 图片输入输出
- Agent 微调
- 编程助手的实时协同编辑

## Decisions

### D1: Agent 两种类型，策略是配置项

**决策**: Agent 有 `assistant` 和 `coding` 两种类型，类型决定执行环境和配置 schema。assistant 类型下的执行策略（ReAct / Plan & Execute）是一个配置项（下拉框），不是独立类型。

**理由**: 类型分界线是执行环境（Server vs Node/subprocess），这是硬性差异，影响整个配置 schema。策略只影响 LLM 编排方式，共享相同的输入（model + tools + knowledge + prompt），是软性差异。新增策略 = 加一个 Go 实现 + 下拉框选项，不改数据模型。

**替代方案**: 每种策略作为独立类型 → 拒绝，因为类型数量会随策略增长失控，且配置 schema 完全重复。

### D2: 执行拓扑 — Server 本地 + 可选远程 Node

**决策**:
- assistant 类型永远在 Server 内执行（goroutine + LLM API 调用）
- coding 类型默认本机执行（Server spawn subprocess），可选远程 Node 执行

**理由**: assistant 的工作是调 LLM API + 执行 Tool Call，全是网络操作，放 Node 只增加延迟。coding 需要文件系统，本机模式（`exec.Command`）几十行代码即可实现，零额外部署。远程模式复用已有 Node/Sidecar 基础设施，给需要资源隔离或多机操作的团队使用。

**替代方案**: 全部走 Node → 拒绝，入门门槛过高。全部放 Server → 拒绝，堵死了远程执行的扩展路径。

### D3: Gateway + Executor 架构

**决策**: Agent Gateway 是统一入口，负责上下文组装、Executor 分发、结果存储、SSE 推送。Executor 是可替换的执行引擎。

```
                    AgentGateway
                    ├── 鉴权 + Session 管理
                    ├── 上下文组装（历史 + 记忆 + 知识）
                    ├── Executor 分发
                    │   ├── ReactExecutor
                    │   ├── PlanAndExecuteExecutor
                    │   ├── LocalCodingExecutor
                    │   └── RemoteCodingExecutor
                    ├── 事件流消费（存储 + 转发）
                    └── SSE 推送 Browser
```

**Executor 接口**:
```go
type Executor interface {
    Execute(ctx context.Context, req ExecuteRequest) (<-chan Event, error)
}
```

所有 Executor 返回统一的 `Event` channel，Gateway 不关心执行细节。

### D4: 统一事件协议

**决策**: 所有 Executor 产出相同格式的事件流：

| 事件类型 | 含义 | 关键字段 |
|---------|------|---------|
| `llm_start` | 开始一轮 LLM 调用 | turn, model |
| `content_delta` | 文本增量输出 | text |
| `tool_call` | 发起工具调用 | id, name, args |
| `tool_result` | 工具返回结果 | id, output, duration_ms |
| `plan` | 执行计划（Plan & Execute） | steps[] |
| `step_start` | 开始执行某步骤 | step_index, description |
| `done` | 执行完成 | total_turns, input_tokens, output_tokens |
| `cancelled` | 用户中断 | reason |
| `error` | 执行出错 | message |

CodingExecutor 需要将子进程的 stdout/stderr 解析映射为这些事件类型。

### D5: Tool Binding 粒度

**决策**: 三类工具分开绑定 — 内置 Tool 和 Skill 按 ID 逐个绑定，MCP Server 按 Server 级整体绑定。

**理由**: MCP 协议的设计粒度是 Server，连一个 Server 拿全部 tools。按 tool 粒度筛选逆协议设计，增加前后端复杂度。内置 Tool 和 Skill 数量可控，逐个选择合理。

### D6: Memory — Per-Agent-Per-User 结构化条目

**决策**: AgentMemory 是 (agent_id, user_id) 维度的结构化条目，每条有 key + content。非向量存储。

```
AgentMemory:
  agent_id, user_id       ← 复合归属
  key: "偏好语言"          ← 结构化 key，支持精确更新
  content: "用户偏好 Go"   ← 自然语言内容
  source: agent_generated | user_set
```

**理由**: Memory 条目少（几十条级别），全量注入 system prompt 或按 key 检索即可，不需要向量检索。向量检索是 Knowledge Base 的职责。key + content 结构让 Agent 可以精确更新某条记忆，而非整段重写。

### D7: Coding Runtime Config 一层多态

**决策**: coding 类型使用 `runtime` 字段选择编程工具，`runtime_config` 存 JSON 格式的工具特定配置。只做一层多态，runtime_config 内部扁平。

```
runtime: "claude-code"
runtime_config: {
  "api_key_ref": "provider:anthropic",
  "model": "claude-sonnet-4-20250514",
  "allowed_tools": ["read", "write", "bash"]
}
```

不同 runtime 的 config schema 不同，前端根据 runtime 渲染不同表单，后端用不同 schema 校验。

### D8: 上下文组装与截断

**决策**: Gateway 在每次请求时组装完整上下文，按优先级截断：

```
Token 预算分配（以 model context_window 为上限）:
  1. System Prompt + Instructions + Memory  → 预留固定额度
  2. Tool Definitions                       → 预留固定额度
  3. Knowledge Context（相关检索结果）       → 预留配置额度
  4. Message History                        → 剩余空间，从旧到新截断
```

截断策略在 Gateway 层实现，Executor 收到的是已截断的完整请求，不做二次处理。

## Risks / Trade-offs

**[LLM 循环失控]** Agent 进入无限 tool call 循环，消耗大量 token
→ `max_turns` 配置（默认 10）硬性限制循环次数；单次请求 token 预算上限；连续相同 tool call 检测

**[编程助手安全]** 本机模式下子进程与 Server 同权限，可能误操作
→ `workspace` 配置限制工作目录；建议生产环境使用远程 Node + Docker 隔离；本机模式定位为开发/小团队场景

**[SSE 连接中断]** Browser SSE 断线后丢失事件
→ 事件带序列号，重连时从 Last-Event-ID 恢复；Gateway 缓存最近 N 条事件；长时间断线降级为拉取完整消息历史

**[上下文窗口溢出]** 历史 + 记忆 + 工具定义超出模型限制
→ 分层 token 预算（D8）；工具定义做摘要压缩；极端情况下裁剪绑定工具数量

**[远程 Coding 延迟]** Node SSE 链路增加 RT
→ 编程任务本身是长时间运行（秒~分钟级），多一跳网络延迟可忽略；事件流是增量推送，不影响用户感知

## Open Questions

1. **Agent 模板** — 是否在 v1 提供预设模板（客服/运维/编程等），还是后续单独做？倾向 v1 提供 3-5 个基础模板作为种子数据
2. **Token 计费** — 是否在 v1 实现 per-agent / per-user 的 token 用量统计和配额？还是先只做 AILog 记录？
3. **Knowledge 注入方式** — 每次对话时是全量注入知识库，还是先用 query 做相关性检索再注入？后者更省 token 但需要 embedding 支持
