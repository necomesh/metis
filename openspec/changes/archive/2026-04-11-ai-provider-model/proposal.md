## Why

所有 AI 能力的基座是供应商和模型管理。上层的知识库（LLM 摘要生成）、智能体（LLM 对话）、工具（function calling）全部依赖统一的 LLM 调用接口。需要先建设这一层，支持多供应商（OpenAI、Anthropic、Ollama 等）、多模型类型（LLM / Embedding / ReRank / TTS / STT / Image），并提供 Go 层面的统一调用 SDK。

## What Changes

- 新增 `internal/app/ai/` 目录，实现 AI Infra App（第一批实体：Provider + Model）
- 新增 `internal/llm/` 包，提供统一的 LLM 调用接口（Chat / ChatStream / Embedding），支持 OpenAI 兼容协议和 Anthropic 协议
- Provider 支持连通性测试、启用/禁用、API Key 加密存储
- Model 按类型分类（llm / embed / rerank / tts / stt / image），LLM 类型支持能力标签（vision / tool_use / reasoning / coding / long_context）
- 前端新增供应商管理页面，模型按类型分组展示
- 新增基础 AILog 模型（调用日志），每次 LLM 调用自动记录 token 用量和成本

### 数据模型

**Provider**: name, type(openai_compatible | anthropic | google | ollama | custom), base_url, api_key(加密), status(active | inactive | error), health_check 时间戳

**Model**: model_id, display_name, provider_id(FK), type(llm | embed | rerank | tts | stt | image), capabilities[](仅 LLM: vision / tool_use / reasoning / coding / long_context), context_window, input_price, output_price, is_default, status(active | deprecated)

**AILog**: agent_code, model_id, provider_id, user_id, app_source, input_tokens, output_tokens, total_cost, latency_ms, status(success | error | timeout), created_at

### 统一 LLM 接口（internal/llm）

```go
type LLM interface {
    Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error)
    ChatStream(ctx context.Context, req ChatRequest) (<-chan ChatChunk, error)
}
```

Provider 的 `type` 决定协议适配：openai_compatible 走 OpenAI Chat Completion API，anthropic 走 Messages API。

## Capabilities

### New Capabilities
- `ai-provider`: 供应商管理 CRUD + 连通性测试 + API Key 加密存储
- `ai-model`: 模型管理 CRUD + 类型分类 + 能力标签 + 供应商自动同步模型列表
- `ai-llm-client`: 统一 LLM 调用 SDK（internal/llm），OpenAI 兼容 + Anthropic 适配
- `ai-log`: 调用日志记录，自动追踪 token 用量和成本

### Modified Capabilities
- `server-bootstrap`: edition_full.go 新增 `import _ "metis/internal/app/ai"`
- `frontend-routing`: registry.ts 新增 `import './ai/module'`

## Impact

- **后端**: 新增 `internal/app/ai/`（model, repository, service, handler, seed）~500 行；新增 `internal/llm/` ~300 行
- **前端**: 新增 `web/src/apps/ai/pages/providers/` 供应商管理页面；新增 `web/src/apps/ai/module.ts` 注册路由
- **数据库**: 新增 3 张表（ai_providers, ai_models, ai_logs）
- **Seed**: 新增 AI 管理菜单项 + Casbin 策略
