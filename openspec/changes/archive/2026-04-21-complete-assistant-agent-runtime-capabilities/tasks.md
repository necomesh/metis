## 1. Runtime Assembly Foundation

- [x] 1.1 Add an assistant runtime assembly structure that captures system prompt fragments, knowledge context, tool definitions, and executable tool handlers.
- [x] 1.2 Refactor Gateway assistant execution to build runtime assembly before constructing `ExecuteRequest`.
- [x] 1.3 Reuse canonical Agent binding getters so assembly resolves selected active capability set items with legacy flat binding fallback.
- [x] 1.4 Add tests for selected, unselected, inactive, deleted, duplicate, and invalid runtime resources.

## 2. Knowledge Context Loading

- [x] 2.1 Implement the AI App `app.AIKnowledgeSearcher` interface using the unified `KnowledgeAsset` and `KnowledgeEngine` search path.
- [x] 2.2 Add Gateway knowledge recall for selected active knowledge base and knowledge graph assets using the latest user message.
- [x] 2.3 Format bounded recall snippets with source labels and append them to the assistant system prompt.
- [x] 2.4 Add tests for successful recall injection, empty recall, partial recall failure, and no selected knowledge assets.

## 3. Skill Runtime Loading

- [x] 3.1 Load selected active skills during assistant runtime assembly.
- [x] 3.2 Append prompt-only skill instructions to the assistant system prompt.
- [x] 3.3 Parse and validate endpoint skill tool schemas before exposing them as LLM tool definitions.
- [x] 3.4 Add a skill tool executor path for supported endpoint contracts, or skip unsupported endpoint schemas with logged warnings.
- [x] 3.5 Add tests for prompt-only skill injection, endpoint skill tool exposure, inactive skill omission, and malformed schema omission.

## 4. MCP Runtime Discovery and Dispatch

- [x] 4.1 Add an MCP client abstraction for discovery and tool calls across configured server transports.
- [x] 4.2 Replace Gateway MCP placeholder meta-tools with discovered MCP tool definitions.
- [x] 4.3 Maintain a deterministic owner mapping from exposed MCP tool names to MCP server/tool identity.
- [x] 4.4 Route matching MCP tool calls through the MCP executor and return structured tool results.
- [x] 4.5 Reuse the discovery path for SSE MCP connection tests.
- [x] 4.6 Add tests for discovery success, discovery failure, inactive MCP omission, MCP call success, MCP call failure, and unknown MCP tool names.

## 5. Executor Hardening

- [x] 5.1 Ensure ReAct only exposes tools with executable handlers and returns tool-not-found results for unexpected tool calls.
- [x] 5.2 Add ReAct tests for executable tool alignment, tool execution errors, and unknown tool calls.
- [x] 5.3 Update Plan-and-Execute to preserve prior step context across steps.
- [x] 5.4 Emit `step_done` for completed Plan-and-Execute steps.
- [x] 5.5 Enforce a clear per-step turn budget and emit an error when a step exceeds it.
- [x] 5.6 Add Plan-and-Execute tests for plan parsing, step context carryover, tool use, step completion, cancellation, and per-step turn budget errors.

## 6. Verification

- [x] 6.1 Run `go test ./internal/app/ai`.
- [x] 6.2 Run focused ITSM smart-engine tests that cover `decision.knowledge_search` when AI knowledge search is available.
- [x] 6.3 Run `go build -tags dev ./cmd/server`.
- [x] 6.4 Update design or specs if implementation reveals a different MCP or skill endpoint contract.
