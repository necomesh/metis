## 1. Data Model and Migration

- [x] 1.1 Add capability set, set item, agent set binding, and agent selected set item models.
- [x] 1.2 Add database migration/auto-migration coverage for the new capability set tables.
- [x] 1.3 Seed tool capability sets from existing builtin toolkits and create default MCP, skill, knowledge base, and knowledge graph sets.
- [x] 1.4 Backfill existing direct agent bindings into set-scoped bindings while preserving flattened effective IDs.
- [x] 1.5 Add migration tests that compare pre-migration and post-migration effective bindings.

## 2. Backend Services and APIs

- [x] 2.1 Implement repository/service methods for listing active capability sets with typed items.
- [x] 2.2 Implement validation so selected item IDs must belong to the referenced set and match its capability type.
- [x] 2.3 Update assistant, coding, and legacy agent create/update handlers to accept canonical set-scoped bindings.
- [x] 2.4 Update agent detail responses to return set-scoped bindings and derived legacy flat ID arrays.
- [x] 2.5 Add API tests for set binding replace semantics, invalid item rejection, and compatibility flat ID derivation.

## 3. Runtime Resolution

- [x] 3.1 Update Agent Gateway tool definition assembly to resolve selected active builtin tools from capability sets.
- [x] 3.2 Update MCP and skill assembly to resolve selected active servers and skills from capability sets.
- [x] 3.3 Update knowledge context resolution to use selected knowledge base and knowledge graph items from capability sets.
- [x] 3.4 Deduplicate selected leaf resources that appear through multiple sets.
- [x] 3.5 Add runtime tests for selected, unselected, inactive, deleted, and duplicate capability set items.

## 4. Frontend Agent Binding UX

- [x] 4.1 Update Agent form types and API client types to support set-scoped capability bindings.
- [x] 4.2 Refactor shared binding selector so every capability category renders outer Set cards.
- [x] 4.3 Add set Sheet behavior for checking and unchecking items inside a selected Set.
- [x] 4.4 Update Agent detail bindings card to summarize bound sets and selected/total counts.
- [x] 4.5 Update Chinese and English AI locale strings for capability sets and set-scoped selection.

## 5. Verification and Documentation

- [x] 5.1 Run `go build -tags dev ./cmd/server`.
- [x] 5.2 Run focused backend tests for AI agent binding, migration, and gateway resolution.
- [ ] 5.3 Run `cd web && bun run lint`.
- [x] 5.4 Run `cd web && bun run build`.
- [x] 5.5 Update `DESIGN.md` with the confirmed Agent capability Set interaction pattern after implementation verification.
