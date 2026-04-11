## Why

工具是智能体的"手脚"，决定了它能做什么事。需要一个工具注册表来管理内置工具和自定义工具的定义，供智能体绑定使用。工具定义遵循 LLM function calling 的 JSON Schema 标准，确保与各供应商的 tool_use 能力兼容。

## What Changes

- 新增 Tool 数据模型，存储工具的名称、描述、参数 Schema、类型和处理方式
- 预置内置工具（search_knowledge、read_document、http_request），随模块 seed 自动注册
- 支持自定义工具（HTTP webhook 方式），管理员通过 UI 创建
- 预留 MCP（Model Context Protocol）类型字段，未来支持 MCP Server 对接
- 前端新增工具管理页面：内置工具展示 + 自定义工具 CRUD

### 数据模型

**Tool**: name(unique), display_name, description(给 LLM 看的描述), type(builtin | custom | mcp), parameters(JSON Schema, LLM function calling 格式), handler_type(internal | webhook | mcp), handler_config(JSON: webhook_url 或内部函数标识), is_active

### 内置工具

| name | 说明 | 依赖 |
|------|------|------|
| search_knowledge | 在指定知识库中全文检索 | ai-knowledge |
| read_document | 读取知识库中某篇文档全文 | ai-knowledge |
| http_request | 发起 HTTP 请求 | 无 |

Coding Agent 的工具（read_file, write_file, execute_code）由 Coding Runtime 内置提供，不在此注册表中管理。

## Capabilities

### New Capabilities
- `ai-tool-registry`: 工具注册表 CRUD + 内置工具 seed + JSON Schema 参数定义

### Dependencies
- `ai-knowledge-base` (from ai-knowledge): 内置工具 search_knowledge / read_document 调用知识库

## Impact

- **后端**: `internal/app/ai/` 新增 tool 相关 model/repo/service/handler ~250 行
- **前端**: 新增 `web/src/apps/ai/pages/tools/` 工具管理页面
- **数据库**: 新增 1 张表（ai_tools）
- **Seed**: 预置内置工具记录
