## 1. Data Model & Repository

- [x] 1.1 Create Agent model (`internal/app/ai/agent_model.go`): Agent struct with all fields (type, strategy, model_id, system_prompt, temperature, max_tokens, max_turns, runtime, runtime_config, exec_mode, node_id, workspace, instructions, visibility, created_by, is_active), M2M join table structs (AgentTool, AgentSkill, AgentMCPServer, AgentKnowledgeBase)
- [x] 1.2 Create AgentTemplate model: id, name, description, type, config (JSON with pre-filled agent fields)
- [x] 1.3 Create AgentSession model (`internal/app/ai/session_model.go`): id, agent_id, user_id, status (running/completed/cancelled/error), title, created_at, updated_at
- [x] 1.4 Create SessionMessage model: id, session_id, role (user/assistant/tool_call/tool_result), content, metadata (JSON), token_count, sequence, created_at
- [x] 1.5 Create AgentMemory model (`internal/app/ai/memory_model.go`): id, agent_id, user_id, key, content, source (agent_generated/user_set/system), created_at, updated_at; unique index on (agent_id, user_id, key)
- [x] 1.6 Create AgentRepository (`internal/app/ai/agent_repository.go`): CRUD with preloaded bindings, list with type/visibility/keyword filters, template listing
- [x] 1.7 Create SessionRepository (`internal/app/ai/session_repository.go`): CRUD, list by user+agent, get with messages
- [x] 1.8 Create MemoryRepository (`internal/app/ai/memory_repository.go`): upsert by key, list by agent+user, delete, count by source
- [x] 1.9 Register all models in AIApp.Models() for AutoMigrate

## 2. Agent CRUD Service & Handler

- [x] 2.1 Create AgentService (`internal/app/ai/agent_service.go`): Create (validate type-specific fields, validate model_id/node_id FKs), Update (re-validate), Delete (check no running sessions), List (filter by visibility for current user), Get, template-based creation
- [x] 2.2 Create AgentHandler (`internal/app/ai/agent_handler.go`): REST endpoints for `/api/v1/ai/agents` — POST, GET list, GET :id, PUT :id, DELETE :id; GET `/api/v1/ai/agents/templates`
- [x] 2.3 Register AgentService and AgentHandler in AIApp.Providers()
- [x] 2.4 Register agent routes in AIApp.Routes()
- [x] 2.5 Add runtime_config JSON schema validation per runtime type (claude-code, codex, opencode, aider)

## 3. Session & Message Service & Handler

- [x] 3.1 Create SessionService (`internal/app/ai/session_service.go`): CreateSession, GetSession (with messages), ListSessions (by user+agent), DeleteSession, UpdateStatus
- [x] 3.2 Create SessionHandler (`internal/app/ai/session_handler.go`): REST endpoints for `/api/v1/ai/sessions` — POST, GET list, GET :sid, DELETE :sid
- [x] 3.3 Create message handling in SessionService: StoreMessage (with auto-sequence), GetMessages (ordered), ConcatenateDeltasToMessage
- [x] 3.4 Register session routes in AIApp.Routes()

## 4. Memory Service & Handler

- [x] 4.1 Create MemoryService (`internal/app/ai/memory_service.go`): UpsertMemory (with limit enforcement), ListMemories, DeleteMemory, InjectMemoriesIntoPrompt (format entries for system prompt)
- [x] 4.2 Create MemoryHandler (`internal/app/ai/memory_handler.go`): REST endpoints for `/api/v1/ai/agents/:id/memories` — GET, POST, DELETE :mid
- [x] 4.3 Register memory routes in AIApp.Routes()

## 5. Event Protocol & Executor Interface

- [x] 5.1 Define Event types (`internal/app/ai/event.go`): Event struct with Type, Sequence, and type-specific fields; constants for llm_start, content_delta, tool_call, tool_result, plan, step_start, done, cancelled, error, memory_update
- [x] 5.2 Define Executor interface (`internal/app/ai/executor.go`): `Execute(ctx context.Context, req ExecuteRequest) (<-chan Event, error)`; ExecuteRequest struct with messages, system_prompt, tools, model config
- [x] 5.3 Define ToolExecutor interface for builtin/MCP/skill tool dispatch

## 6. ReactExecutor

- [x] 6.1 Implement ReactExecutor (`internal/app/ai/executor_react.go`): LLM loop using ai-llm-client ChatStream, parse tool calls, execute tools, re-call LLM with results, max_turns enforcement
- [x] 6.2 Implement tool dispatch: resolve tool_call name against bound builtin tools, MCP server tools, and skill tools; execute and return result
- [x] 6.3 Implement MCP tool execution: connect to MCP server (SSE or STDIO transport), send tool call, receive result
- [x] 6.4 Add memory_update event detection: parse LLM output for memory extraction instructions, emit memory_update events

## 7. PlanAndExecuteExecutor

- [x] 7.1 Implement PlanAndExecuteExecutor (`internal/app/ai/executor_plan.go`): Phase 1 — call LLM with planning prompt, parse plan into steps, emit plan event; Phase 2 — execute each step with ReAct sub-loop, emit step_start events
- [x] 7.2 Define planning prompt template that instructs LLM to output structured plan (JSON or numbered list)

## 8. LocalCodingExecutor

- [x] 8.1 Implement LocalCodingExecutor (`internal/app/ai/executor_coding_local.go`): spawn subprocess (claude/codex/opencode/aider) with workspace as cwd, inject instructions, bridge stdout to Event channel
- [x] 8.2 Implement runtime-specific subprocess configuration: CLI flags, env vars, config file injection per runtime type
- [x] 8.3 Implement subprocess lifecycle management: start, monitor, graceful shutdown (SIGTERM → SIGKILL), cleanup
- [x] 8.4 Implement stdout/stderr parsing into unified Event format per runtime

## 9. RemoteCodingExecutor

- [x] 9.1 Implement RemoteCodingExecutor (`internal/app/ai/executor_coding_remote.go`): send run command via NodeHub SSE, track execution state
- [x] 9.2 Create sidecar event ingestion endpoint: `POST /api/v1/ai/sessions/:sid/events` with Node Token auth, parse NDJSON body, feed events to Gateway channel
- [x] 9.3 Implement cancel via NodeHub SSE: send cancel command to sidecar
- [x] 9.4 Handle node offline detection: check node status before dispatch, return error event if offline

## 10. Agent Gateway

- [x] 10.1 Implement AgentGateway (`internal/app/ai/gateway.go`): orchestrate the full flow — validate, store message, load history, load memories, query knowledge, assemble ExecuteRequest, dispatch to executor, consume events
- [x] 10.2 Implement context window management: token counting for system prompt + tools + knowledge + history, truncation strategy (oldest messages first)
- [x] 10.3 Implement knowledge context assembly: query bound knowledge bases using session context, inject relevant results into ExecuteRequest
- [x] 10.4 Implement event consumption loop: read from executor channel, store messages/tool_calls to DB, record AILog (token usage), handle memory_update events
- [x] 10.5 Create SendMessage handler (`internal/app/ai/gateway_handler.go`): `POST /api/v1/ai/sessions/:sid/messages` — store user message, trigger Gateway, return 202
- [x] 10.6 Implement SSE streaming endpoint: `GET /api/v1/ai/sessions/:sid/stream` — SSE with event ID tracking, Last-Event-ID reconnection support, event buffering
- [x] 10.7 Implement cancel endpoint: `POST /api/v1/ai/sessions/:sid/cancel` — signal executor context cancellation, emit cancelled event

## 11. Seed Data

- [x] 11.1 Add Agent menu item seed to AIApp.Seed(): "Agents" menu entry under AI module, Casbin policies for agent CRUD
- [x] 11.2 Add "Chat" menu item seed: user-facing chat entry point
- [x] 11.3 Create default agent templates seed: 3-5 templates (通用助手, 客服助手, 运维助手, 编程助手, 数据分析助手)

## 12. Frontend — Agent Management UI

- [x] 12.1 Create agent list page (`web/src/apps/ai/pages/agents/index.tsx`): card grid with type/visibility badges, filters, search, pagination
- [x] 12.2 Create agent creation wizard Sheet (`web/src/apps/ai/pages/agents/components/agent-sheet.tsx`): type-conditional form — basic info → type-specific config (assistant/coding)
- [x] 12.3 Create assistant config form component: model selector, strategy dropdown, system prompt textarea, temperature/max_tokens/max_turns inputs
- [x] 12.4 Create coding config form component: runtime selector, exec_mode radio, workspace input, node selector (conditional)
- [x] 12.5 Create capability binding components: bindings tab on detail page shows knowledge/tool/MCP/skill IDs
- [x] 12.6 Create agent detail/edit page (`web/src/apps/ai/pages/agents/[id].tsx`): tabbed layout (Overview, Bindings, Sessions)
- [x] 12.7 Create template selection component for creation wizard
- [x] 12.8 Add API client functions in `web/src/lib/api.ts`: agent CRUD, template list
- [x] 12.9 Add i18n entries for agent management (en.json + zh-CN.json)
- [x] 12.10 Register agent pages in AI app module routes

## 13. Frontend — Chat UI

- [x] 13.1 Create agent selector page (`web/src/apps/ai/pages/chat/index.tsx`): agent card grid showing visible agents with "开始对话" action
- [x] 13.2 Create chat page layout (`web/src/apps/ai/pages/chat/[sid].tsx`): session sidebar + chat area, responsive (sidebar hidden on mobile)
- [x] 13.3 Create message bubble components: user bubble (right), assistant bubble (left), tool_call/tool_result collapsible block
- [x] 13.4 Create SSE streaming hook (`web/src/apps/ai/pages/chat/hooks/use-chat-stream.ts`): connect to SSE endpoint, parse events, update message state
- [x] 13.5 Create chat input component: textarea with send button, disable during execution, show cancel button during streaming
- [x] 13.6 Create session sidebar component: session list with title, new conversation button, delete
- [x] 13.7 Create memory panel component: list memories with delete, accessible via brain icon in chat header
- [x] 13.8 Add API client functions: session CRUD, send message, cancel, memory CRUD
- [x] 13.9 Add i18n entries for chat UI (en.json + zh-CN.json)
- [x] 13.10 Register chat pages in AI app module routes
