## Context

Agent capability binding currently has two shapes:

- Builtin tools are grouped by `toolkit` in the list API and UI, but Agent persistence still stores direct `tool_id` bindings.
- MCP servers, skills, knowledge bases, and knowledge graphs are presented and stored as flat item lists.

The requested product model is different: the outer card is a Set, and the user enters the Set to choose which items inside it are enabled for the Agent.

```text
Agent
  |
  +-- Capability Set: IT Service Management
  |     +-- draft_confirm      enabled
  |     +-- draft_prepare      enabled
  |     +-- new_request        disabled
  |
  +-- Capability Set: Internal Knowledge
        +-- VPN Guide KB       enabled
        +-- HR Policy KB       disabled
```

This affects backend persistence, Agent CRUD payloads, runtime assembly, and the shared Agent form/detail UI. It is also a migration-sensitive change because existing Agents already have flat binding records.

## Goals / Non-Goals

**Goals:**

- Represent capability sets as first-class, typed groups across tools, MCP servers, skills, knowledge bases, and knowledge graphs.
- Keep runtime access explicit: an Agent only receives selected active leaf items inside bound sets.
- Make create/edit/detail UI use Set cards consistently for all capability categories.
- Preserve existing Agents through compatibility migration.
- Keep existing resource management screens for tools, MCP servers, skills, knowledge bases, and knowledge graphs intact.

**Non-Goals:**

- Redesign the standalone tool, MCP, skill, knowledge base, or knowledge graph management pages.
- Implement nested sets or sets containing mixed capability types.
- Change the semantics of individual builtin tools, MCP server connections, skill packages, or knowledge search.
- Automatically grant every future item added to a set to all Agents that bind that set.

## Decisions

### Decision: Use a Unified Capability Set Model

Create one shared set model instead of one table per resource type.

```text
ai_capability_sets
  id
  type              tool | mcp | skill | knowledge_base | knowledge_graph
  name
  description
  icon
  sort
  is_active

ai_capability_set_items
  set_id
  item_id
  sort

ai_agent_capability_sets
  agent_id
  set_id

ai_agent_capability_set_items
  agent_id
  set_id
  item_id
  enabled
```

Rationale: a unified model keeps the Agent binding UI and API consistent. The set type scopes validation so `item_id` points to the correct existing table for that set.

Alternative considered: separate `ToolSet`, `MCPSet`, `KnowledgeBaseSet`, and similar tables. This would make foreign keys more direct but would duplicate repository, API, and UI logic across five resource categories.

### Decision: Explicit Leaf Selection Wins Over Automatic Inheritance

Binding a set does not automatically expose every current or future item in that set. The Agent stores explicit enabled items per set.

Rationale: tool calls, MCP access, skill packages, and knowledge sources are permission-sensitive. New items should be discoverable in the set but not silently granted to existing Agents.

Alternative considered: set binding plus exclusion list. That is convenient for broad capability packs but makes security review harder because future items become enabled by default.

### Decision: Preserve Leaf-Based Runtime Assembly

Runtime assembly resolves selected set items into the same leaf resource types currently used by the Gateway and sidecar assembly:

```text
Agent Set Bindings -> selected active item IDs -> Tool/MCP/Skill/KB/KG runtime config
```

Rationale: executors and tool runners already operate on concrete tools, MCP servers, skills, and knowledge assets. Set semantics belong to configuration and access resolution, not the execution loop.

### Decision: Provide Compatibility Sets for Migration

Existing direct bindings are migrated into deterministic compatibility sets:

- Builtin tools use existing `toolkit` groups as tool capability sets.
- MCP servers, skills, knowledge bases, and knowledge graphs receive default sets if no richer grouping exists.
- Existing bound leaf IDs are recorded as selected items under those sets.

Rationale: existing Agents should retain the same runtime capabilities after migration, while the UI immediately gains the Set-based interaction model.

### Decision: Keep Backward-Compatible Response Fields During Transition

Agent detail responses may continue returning legacy `toolIds`, `mcpServerIds`, `skillIds`, `knowledgeBaseIds`, and `knowledgeGraphIds` as derived fields while also returning set-scoped bindings.

Rationale: this lowers frontend migration risk and avoids breaking internal consumers that still read flat IDs. New writes should use set-scoped fields.

## Risks / Trade-offs

- Compatibility sets could feel artificial for MCP/skills/knowledge if all items start in one default set -> Allow administrators or future seed logic to create more meaningful sets later.
- The same item could appear in multiple sets -> Runtime resolution MUST deduplicate leaf items by capability type and item ID.
- Legacy and set-scoped fields can drift if both are writable -> Treat set-scoped bindings as canonical for new writes; derive legacy fields from canonical bindings.
- Soft-deleted or inactive items could remain selected -> Runtime assembly filters inactive/deleted items while detail UI surfaces selected-but-unavailable state where possible.
- Migration mistakes could remove capabilities from existing Agents -> Add migration tests that compare pre/post flattened binding IDs.

## Migration Plan

1. Add capability set and set binding tables.
2. Seed tool capability sets from existing builtin toolkits.
3. Seed default MCP, skill, knowledge base, and knowledge graph sets.
4. Backfill each Agent's existing flat binding rows into set-scoped bindings.
5. Update APIs to read and write canonical set-scoped bindings while deriving legacy flat ID arrays.
6. Update frontend form/detail components to consume set-scoped bindings.
7. Update runtime assembly to resolve selected set items.

Rollback should preserve existing flat binding tables until a later cleanup. If rollback is needed, flat derived IDs can be written back from set-scoped selections.

## Open Questions

- Should administrators manage capability sets in a dedicated screen now, or should the first iteration rely on seeded/default sets only?
- Should disabled selected items be shown as warnings in Agent detail, or simply omitted from runtime summaries?
- Should coding Agents expose all capability set types, or should the UI initially limit them to MCP/skills/tools and keep knowledge bindings assistant-focused?
