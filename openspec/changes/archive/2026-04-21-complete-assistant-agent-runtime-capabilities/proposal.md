## Why

Assistant Agent runtime currently persists capability bindings, but several bound resources do not reliably reach execution. Builtin tools mostly work, while MCP servers are exposed as placeholder meta-tools, skills are only assembled for sidecar-style config, and bound knowledge assets are not recalled by the Gateway before LLM execution.

This change closes the gap between Agent configuration and runtime behavior so assistant Agents can safely and predictably use selected tools, MCP servers, skills, and knowledge during ReAct and Plan-and-Execute runs.

## What Changes

- Resolve selected active capability set items into concrete runtime resources for builtin tools, MCP servers, skills, knowledge bases, and knowledge graphs.
- Add knowledge recall to the Agent Gateway before execution and inject retrieved context into the assembled prompt.
- Load active prompt-only skill instructions into assistant system prompts and expose endpoint skill tools to the LLM tool list.
- Replace MCP placeholder meta-tools with discovered MCP tool definitions and route matching tool calls to the configured MCP server.
- Harden ReAct execution so exposed tool definitions and executable handlers stay aligned.
- Harden Plan-and-Execute so step execution preserves prior step context, reports step completion, respects turn limits, and surfaces tool execution errors.
- Add tests that cover selected/unselected/inactive resources, knowledge injection, skill prompt/tool loading, MCP dispatch, and Plan-and-Execute failure paths.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ai-agent-gateway`: Complete runtime assembly for selected capability resources, knowledge recall, executor dispatch, ReAct tool execution, and Plan-and-Execute semantics.
- `ai-skill-registry`: Clarify that bound active skills contribute prompt instructions and endpoint tool definitions to assistant Agent runs, not only sidecar package assembly.
- `ai-mcp-registry`: Clarify that bound active MCP servers contribute discovered callable tools and receive matching tool calls during assistant Agent runs.

## Impact

- Backend runtime code under `internal/app/ai/`, especially `gateway.go`, executors, tool execution, skill assembly, MCP integration, and knowledge query paths.
- Existing Agent binding persistence remains compatible, including the in-progress capability set binding model.
- No intended REST API breaking change; existing Agent create/update/detail payloads remain compatible while runtime behavior becomes complete.
- Tests in `internal/app/ai` will expand to cover Gateway assembly, executor behavior, knowledge recall, skill loading, and MCP dispatch.
