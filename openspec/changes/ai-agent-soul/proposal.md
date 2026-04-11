## Why

智能体（Agent）是 AI Infra 的核心概念——灵魂的定义。它组合了模型、工具、知识、人格指令为一体，供上层应用绑定使用。智能体分为两大类：常规 Agent（Chat / Ops / Assistant，通过统一 LLM 接口直接对话）和 Coding Agent（委托 Claude Code / OpenCode 等外部编码工具执行），两者的配置结构不同，需要分别设计。

## What Changes

- 新增 Agent 数据模型，包含基础字段（所有类型共有）+ 类型特定配置（JSON 字段）
- 常规 Agent 配置：system_prompt、主/降级模型绑定（按用途：llm / rerank / tts / stt）、temperature、max_tokens、绑定工具列表
- Coding Agent 配置：runtime（claude_code / opencode / aider）、instructions（CLAUDE.md 风格指令）、model_hint、allowed_tools、max_turns
- Agent 通过 code 字段全局唯一标识，应用层通过 agent_code 绑定灵魂
- N:M 关联 Tool 和 KnowledgeBase
- 前端新增智能体管理页面：卡片列表 + 按类型区分的编辑表单 + 测试对话面板

### 数据模型

**Agent**: name, code(unique, 应用层绑定用), type(chat | ops | assistant | coding | custom), description, avatar, config(JSON, 按 type 存储不同结构), memory_strategy(conversation | persistent | none), is_active

**AgentTool** (关联表): agent_id, tool_id

**AgentKnowledge** (关联表): agent_id, knowledge_base_id

### Agent Type 决定运行时行为

- `chat / ops / assistant` → LLM Runtime 直接调用，Server 或 metis-ai-agent 执行
- `coding` → Coding Runtime 管理外部编码工具子进程，仅 metis-ai-agent 执行

### 常规 Agent Config 结构

```json
{
  "system_prompt": "你是一位...",
  "models": {
    "llm_primary": "<model_id>",
    "llm_fallback": "<model_id>",
    "rerank": "<model_id>"
  },
  "temperature": 0.7,
  "max_tokens": 4096
}
```

### Coding Agent Config 结构

```json
{
  "runtime": "claude_code",
  "instructions": "你是一位资深前端工程师...",
  "model_hint": "claude-sonnet-4-20250514",
  "allowed_tools": ["read", "write", "terminal"],
  "max_turns": 50
}
```

## Capabilities

### New Capabilities
- `ai-agent-definition`: 智能体/灵魂 CRUD + 类型分化配置 + 工具/知识绑定 + 全局 code 标识

### Dependencies
- `ai-provider` + `ai-model` (from ai-provider-model): 模型引用
- `ai-tool-registry` (from ai-tool-registry): 工具绑定
- `ai-knowledge-base` (from ai-knowledge): 知识库绑定

## Impact

- **后端**: `internal/app/ai/` 新增 agent 相关 model/repo/service/handler ~500 行
- **前端**: 新增 `web/src/apps/ai/pages/agents/` 智能体管理页面（卡片列表 + 编辑表单 + 测试面板）
- **数据库**: 新增 3 张表（ai_agents, ai_agent_tools, ai_agent_knowledge_bases）
- **Seed**: 可预置几个示例灵魂模板
