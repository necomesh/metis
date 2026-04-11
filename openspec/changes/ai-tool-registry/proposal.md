## Why

工具是智能体的"手脚"，决定了它能做什么事。需要一个工具注册表来统一管理三类工具来源：Agent 内建工具（Tools）、MCP 服务连接（MCP）、可下发的技能包（Skills）。三者最终都展平为 LLM function calling 的 tools 列表，但管理方式、生命周期和运行机制各不相同，需要独立的数据模型和管理界面。

## What Changes

### 三类工具模型

**Tools（内建工具）**
- 编译在 Agent 二进制里的 Go 代码实现
- seed 注册到 `ai_tools` 表，管理员只能启用/禁用，不可增删
- 预置工具：search_knowledge、read_document、http_request
- Coding Agent 的工具（read_file, write_file, execute_code）由 Coding Runtime 内置，不在此注册表管理

**MCP（Model Context Protocol 服务）**
- 支持两种传输方式：SSE（远程 HTTP/SSE 连接）和 STDIO（Agent 本地 spawn 子进程）
- 认证可选，支持 api_key / bearer / oauth / custom_header
- 整体绑定到 Agent——一个 MCP Server 暴露的所有工具作为整体启用
- SSE 类型 Agent 运行时直连 MCP Server，STDIO 类型 Agent 在所在节点 spawn 子进程

**Skills（技能包）**
- 通过 HTTP 下发到 Agent workspace 的离线工具包
- Agent 启动/reload 实例时从 Server 下载，解包注册
- 包含可选的 instructions（行为指令，注入 system prompt）+ 可选的 tools 定义（function calling schema + HTTP endpoint）
- 两种形态：prompt-only（纯指令增强）和 endpoint（指令 + 可执行工具）
- 安装来源：GitHub URL 导入（扫描 repo 中的技能包）或管理员上传 tar.gz
- 不做版本管理，reload 时重新下载即为更新
- 认证信息存 DB，Server 下发时注入给 Agent

### 前端

- 三 Tab 卡片模式管理页面：内建工具 | MCP 服务 | 技能包
- Agent 编辑页面工具绑定 UI：按三类分组选择

### Agent 工具装配流程

Server 下发 soul_config 时，将三类工具的完整配置组装到请求体中。Agent 实例启动时：
1. 注册 builtin tools（已编译在二进制里）
2. 连接 MCP Servers（SSE 直连 / STDIO spawn 子进程），发现并注册工具
3. 下载 Skills 到 workspace，解包注册（instructions → system prompt，tools → function calling）

## Capabilities

### New Capabilities
- `ai-tool-registry`: 内建工具管理——seed 注册、启用/禁用、JSON Schema 参数定义
- `ai-mcp-registry`: MCP 服务管理——SSE/STDIO 双传输、连接配置、认证、工具发现
- `ai-skill-registry`: 技能包管理——GitHub 导入/上传安装、instructions + tools 打包、认证配置

### Modified Capabilities
<!-- ai-agent-definition spec 尚未创建（属于 ai-agent-soul change），绑定表需求已包含在三个新 capability 的 soul_config assembly 需求中 -->

## Impact

- **后端**: `internal/app/ai/` 新增 tool/mcp/skill 三组 model/repo/service/handler ~800 行
- **前端**: 新增 `web/src/apps/ai/pages/tools/` 三 Tab 卡片管理页面 + Agent 编辑页工具绑定 UI
- **数据库**: 新增 6 张表（ai_tools, ai_mcp_servers, ai_skills, ai_agent_tools, ai_agent_mcp_servers, ai_agent_skills）
- **Seed**: 预置内建工具记录
