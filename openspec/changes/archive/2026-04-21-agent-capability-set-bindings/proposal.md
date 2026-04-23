## Why

Agent capability binding currently exposes most resources as flat item lists, which makes large installations hard to scan and makes "bind this capability family, then choose the usable items inside it" impossible to express consistently. We need a shared Set model so tools, MCP servers, skills, knowledge bases, and knowledge graphs all use the same outer-card selection pattern and runtime binding semantics.

## What Changes

- Introduce capability sets as first-class binding groups for Agent configuration.
- Allow each capability set to contain selectable items from one capability type: builtin tools, MCP servers, skills, knowledge bases, or knowledge graphs.
- Change Agent create/update/detail payloads to preserve selected sets and selected items per set while maintaining explicit leaf-item runtime behavior.
- Update assistant/coding Agent configuration UI so outer cards represent capability sets and opening a set lets users check or uncheck the items inside it.
- Update Agent detail UI to summarize bound sets and selected item counts instead of presenting all bound resources as flat category rows.
- Update runtime assembly so only selected active items inside bound sets are exposed to execution.
- Provide migration behavior for existing direct bindings by placing existing selected items into compatibility sets.

## Capabilities

### New Capabilities
- `ai-capability-set`: Defines capability set entities, typed set items, agent set bindings, set-item selection semantics, and compatibility behavior for existing direct bindings.

### Modified Capabilities
- `ai-agent`: Agent binding requirements change from flat resource ID bindings to set-scoped bindings with selected leaf items.
- `ai-agent-ui`: Agent create/edit/detail UI requirements change to use capability set cards and set-scoped item selection.
- `ai-agent-gateway`: Runtime assembly requirements change to resolve selected active items from bound capability sets.

## Impact

- Backend models and repositories for Agent capability set persistence, validation, and migration.
- Agent CRUD APIs under `/api/v1/ai/assistant-agents`, `/api/v1/ai/coding-agents`, and legacy `/api/v1/ai/agents`.
- Capability listing APIs used by Agent forms and detail pages.
- Runtime tool/MCP/skill/knowledge resolution in Agent Gateway and sidecar tool assembly.
- Frontend shared Agent form/detail components and AI module translations.
- Database migration or seed logic to create compatibility sets for existing bindings.
