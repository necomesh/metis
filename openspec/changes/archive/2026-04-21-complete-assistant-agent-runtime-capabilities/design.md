## Context

Assistant Agents already support persisted bindings for builtin tools, MCP servers, skills, knowledge bases, and knowledge graphs. The in-progress capability set work makes those bindings set-scoped, but runtime execution still operates on concrete leaf resources.

Current runtime behavior is uneven:

- Gateway exposes active builtin tools from Agent bindings.
- Gateway exposes MCP servers as placeholder `mcp_<name>` meta-tools, but there is no real MCP tool discovery or dispatch.
- Skill bindings are assembled by `ToolAssemblyService` for sidecar-style configuration, but assistant runs do not inject skill instructions or endpoint tools.
- Knowledge asset bindings are persisted and returned by Agent APIs, but the Gateway does not query selected knowledge before execution.
- ReAct has a basic tool loop, while Plan-and-Execute does not preserve step results across steps, does not emit step completion, and does not consistently surface tool errors.

This design keeps the existing database model and public Agent APIs intact. The main change is to make Gateway runtime assembly consume the same selected active leaf resources that persistence already resolves.

## Goals / Non-Goals

**Goals:**

- Make selected active capability resources actually available during assistant Agent execution.
- Resolve runtime resources from canonical capability set bindings while preserving legacy flat binding fallback.
- Inject bound knowledge recall results into assistant execution context before the first LLM call.
- Inject bound skill instructions into assistant system prompts and expose endpoint skill tools.
- Discover MCP tools from bound active servers and dispatch tool calls to the owning server.
- Harden ReAct and Plan-and-Execute behavior with focused tests.

**Non-Goals:**

- Redesign Agent create/update/detail APIs.
- Change the capability set data model introduced by `agent-capability-set-bindings`.
- Build a full visual management UI for MCP-discovered tools or skill endpoint tools.
- Implement remote coding Agent sidecar event ingestion.
- Change ITSM domain decision tools except where AI knowledge search becomes available through the shared AI knowledge interface.

## Decisions

### Decision: Introduce a Gateway Runtime Assembly Layer

Gateway should assemble an internal runtime bundle before selecting the executor:

```text
Agent ID
  |
  +-- selected active builtin tools
  +-- selected active MCP servers + discovered MCP tools
  +-- selected active skills + instructions + endpoint tool defs
  +-- selected active KB/KG assets + recall context
        |
        v
ExecuteRequest + ToolExecutor
```

Rationale: execution should depend on one assembled view instead of each executor independently re-reading bindings. This also creates one place to test selected/unselected/inactive/deleted behavior.

Alternative considered: extend `ToolAssemblyService` directly. That service is currently shaped for sidecar `soul_config` download URLs and full MCP server config, while assistant execution needs LLM tool definitions, prompt fragments, and callable handlers. Reusing repository helpers is useful, but overloading the service would mix two runtime formats.

### Decision: Keep Capability Sets as Authorization, Not Execution Primitives

Runtime assembly will continue resolving set-scoped bindings to leaf resources using existing repository helpers such as `GetToolIDs`, `GetMCPServerIDs`, `GetSkillIDs`, `GetKnowledgeBaseIDs`, and `GetKnowledgeGraphIDs`.

Rationale: executors and tool handlers operate on concrete tools and resources. Capability sets define what is selected; they should not leak into LLM tool names or tool execution payloads.

Alternative considered: pass capability set IDs into `ExecuteRequest`. This would make executors responsible for authorization and would duplicate filtering logic.

### Decision: Treat Knowledge Recall as Prompt Context, Not a Tool for the First Pass

Gateway will query selected active knowledge assets with the latest user message before execution and append a bounded knowledge context block to the system prompt. Empty or failed asset searches should not prevent an Agent from responding; failures should be logged and omitted.

Rationale: the existing spec requires Gateway to query bound knowledge before assembling `ExecuteRequest`. Prompt injection is the least disruptive path and works for both ReAct and Plan-and-Execute.

Alternative considered: expose a `search_knowledge` tool only. Tool-based recall can be added later, but it changes model behavior and does not satisfy the pre-execution context requirement by itself.

### Decision: Split Tool Definitions by Owning Executor Adapter

The `CompositeToolExecutor` should dispatch across:

- existing app tool registries for builtin tools,
- a skill endpoint executor for tools declared by bound endpoint skills,
- an MCP executor for discovered MCP tools.

Each LLM tool definition should map to one executable handler. If a bound resource cannot produce a callable handler, it should not be exposed as a tool definition.

Rationale: this prevents the current mismatch where an MCP meta-tool is exposed but no registry can execute it.

Alternative considered: keep exposing meta-tools and ask the LLM to call a generic dispatcher with server/tool arguments. That is harder for models to use, weakens tool schemas, and still needs dispatch code.

### Decision: Harden Plan-and-Execute Around Step State

Plan-and-Execute should:

- generate a plan once,
- execute each step with the original conversation plus prior step summaries/results,
- run a bounded ReAct loop per step,
- emit `step_start` and `step_done`,
- return an error if any step exceeds its turn budget or a tool call cannot be executed.

Rationale: without carrying prior step context, later steps can ignore earlier work. Without explicit step completion and errors, the UI and stored session state cannot distinguish success from silent truncation.

Alternative considered: replace Plan-and-Execute with a single ReAct loop. That would reduce complexity but remove a supported strategy already exposed in Agent configuration.

## Risks / Trade-offs

- MCP protocol support can grow in scope -> Start with a narrow client abstraction and focused SSE/STDIO behavior required by existing MCP server records.
- Knowledge recall can overfill prompts -> Apply top-K limits, truncate snippets, and include source labels.
- Skill endpoint schema formats may vary -> Validate stored `tools_schema` before exposing tools and skip invalid entries with warnings.
- Tool name collisions across builtin, skill, and MCP tools can cause ambiguous dispatch -> Namespaced names or deterministic conflict rejection should be enforced during assembly.
- Existing tests may pass despite missing runtime behavior -> Add tests against Gateway assembly and executor dispatch rather than only repository getters.

## Migration Plan

No schema migration is required. Deployment can be incremental:

1. Add runtime assembly helpers and tests while preserving existing Agent API responses.
2. Add knowledge search implementation for the AI App interface and Gateway prompt injection.
3. Add skill instruction/tool assembly for assistant runs.
4. Add MCP discovery/dispatch abstraction and replace placeholder meta-tools.
5. Harden executors and extend tests.

Rollback is code-only: revert runtime assembly changes. Existing persisted bindings remain valid because no data shape changes are introduced.

## Implementation Notes

- MCP-discovered tools are exposed with deterministic namespaced names in the form `mcp__<server>__<tool>`, and dispatch keeps an owner mapping back to the selected server/tool identity.
- Skill endpoint tools are exposed with deterministic namespaced names in the form `skill__<skill>__<tool>`. The first supported endpoint contract is HTTP metadata in `tools_schema`; malformed or unsupported endpoint schemas are skipped.
- Knowledge bases and knowledge graphs use the same bounded recall snippet format for now, with source labels included in the injected prompt context.
