## Context

Metis 的 AI Infra 模块从零开始建设，`ai-provider-model` 是第一个落地的变更——所有上层 AI 能力（知识库、智能体、工具调用）都依赖统一的供应商和模型管理。当前 `internal/app/ai/` 和 `internal/llm/` 均为空目录。

已有的 App 模式（license App）提供了完整参考：App 接口、IOC 注入、seed 模式、Casbin 策略、前端 module 注册。本变更遵循相同模式。

刚加入的 `secret_key`（`metis.yaml`）为 API Key 加密存储提供了专用密钥。

## Goals / Non-Goals

**Goals:**
- Provider CRUD + 连通性测试 + API Key 加密存储
- Model CRUD + 类型分类 + 能力标签 + 默认模型（per type）
- 模型同步（自动 + 手动 + 预置）
- 统一 LLM 客户端（`internal/llm/`），支持 OpenAI 兼容协议和 Anthropic 协议
- AILog 表和模型（仅建表，不接日志中间件）
- AI App 骨架（seed、菜单、Casbin 策略、前端路由）

**Non-Goals:**
- Google / Custom provider type（本轮不实现）
- AILog 写入中间件（等上层模块接入时再做）
- Embedding 接口的实际调用链路（本轮只定义接口）
- 前端模型同步的实时进度展示

## Decisions

### D1: Provider type（品牌标识）与 protocol（协议适配）分离

Provider 有两个维度：
- `type`：品牌身份（`openai` / `anthropic` / `ollama`），决定 UI logo、默认 base_url、API Key 获取指引
- `protocol`：实际 API 协议（`openai` / `anthropic`），决定 LLM 客户端使用哪个适配器

映射关系：

| type | protocol | 说明 |
|------|----------|------|
| openai | openai | OpenAI 官方 |
| anthropic | anthropic | Anthropic 官方 |
| ollama | openai | Ollama 兼容 OpenAI 协议 |

**为什么不合并？** DeepSeek、Groq、Moonshot 等第三方都走 OpenAI 兼容协议但 UI 上需要不同的品牌展示。分离后新增供应商只需加 type，不需要改客户端代码。

**替代方案：** 只用 type 做 switch。缺点：每次新增品牌都要改客户端路由逻辑。

### D2: API Key 加密 — 共享 `internal/pkg/crypto/` 包

新建 `internal/pkg/crypto/` 包，提供通用的 AES-256-GCM 加解密：

```go
func Encrypt(plaintext []byte, key []byte) ([]byte, error)
func Decrypt(ciphertext []byte, key []byte) ([]byte, error)
```

加密密钥来源：`sha256(config.SecretKey)` → 32 字节 AES key，通过 IOC 注入。

**为什么不复用 license/crypto.go？** License 的加密逻辑和 Ed25519 密钥对、license file 格式强耦合。AI 只需要简单的对称加解密。抽共享包后 license 未来也可迁移，但本轮不改 license 代码。

### D3: LLM 客户端使用第三方库

- OpenAI 兼容：`sashabaranov/go-openai`（10.6k stars，活跃维护）
- Anthropic：`anthropics/anthropic-sdk-go`（官方 SDK）

`internal/llm/` 包在这两个库之上封装统一接口：

```go
type Client interface {
    Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error)
    ChatStream(ctx context.Context, req ChatRequest) (<-chan StreamEvent, error)
    Embedding(ctx context.Context, req EmbeddingRequest) (*EmbeddingResponse, error)
}
```

`NewClient(protocol, baseURL, apiKey)` 根据 protocol 返回对应实现。

**替代方案：** 纯 net/http 手写。缺点：需要自己处理 SSE 解析、tool call 编解码、错误映射等，工作量大且容易出 bug。

### D4: Model capabilities 使用 JSON 数组

capabilities 字段存为 `JSONText`（与 license 模块相同的 JSON 列类型），值为字符串数组：

```json
["vision", "tool_use", "reasoning", "coding", "long_context"]
```

仅 LLM 类型模型有 capabilities，其他类型（embed / rerank / tts / stt / image）为空数组。

**为什么不用位掩码/布尔列？** 能力标签会不断扩展，JSON 数组无需改表。查询场景主要是前端筛选和灵魂配置时的匹配，量不大，应用层过滤足够。

### D5: is_default 按 model type 粒度

每种 model type（llm / embed / rerank / tts / stt / image）最多一个默认模型。Service 层在设置新默认时自动清除同 type 的旧默认。

### D6: 连通性测试策略

| protocol | 方法 | 说明 |
|----------|------|------|
| openai | `GET /v1/models` | 轻量，验证 Key + 网络 |
| anthropic | `POST /v1/messages` (max_tokens=1) | 无 list 端点，最小请求验证 |

连通测试在 Provider 创建/编辑时前端可手动触发，不自动运行。

### D7: 模型同步三种模式

1. **自动同步**（openai / ollama）：调 list models API 拉取，与本地对比后增量更新
2. **预置列表**（anthropic）：代码中内置已知模型列表（claude-sonnet-4-20250514 等），创建 provider 时自动填入
3. **手动添加**：始终可用，用户自行填写 model_id 和参数

同步时只新增不删除——已手动添加的模型不会被覆盖。

## Risks / Trade-offs

**[第三方库升级] → 锁版本 + go.sum 校验**
依赖 go-openai 和 anthropic-sdk-go。如果上游有 breaking change，需要跟进升级。通过 go.mod 锁定版本控制风险。

**[API Key 泄露] → AES-GCM 加密 + secret_key 保护**
API Key 存入 DB 前加密，读取时解密。secret_key 在 metis.yaml 中（0600 权限）。如果 secret_key 泄露，所有 API Key 都会暴露。后续可考虑支持外部 KMS。

**[Anthropic 连通测试消耗 token] → max_tokens=1 最小化成本**
每次测试消耗极少量 token（约 1-2 个 output token）。如果用户频繁测试，成本可忽略。

**[模型同步数据量] → 只同步基础信息，不同步定价**
OpenAI 返回的模型列表只有 id，没有 context_window、pricing 等。同步时只创建模型记录，定价等需要手动补充或后续从外部数据源同步。
