# ai-agent-memory Specification

## Purpose
TBD - created by archiving change ai-agent-runtime. Update Purpose after archive.
## Requirements
### Requirement: Agent memory entity
The system SHALL support AgentMemory as a per-agent-per-user entity. Each memory entry SHALL have: agent_id (FK), user_id (FK), key (string, unique within agent+user), content (text), source (`agent_generated` | `user_set` | `system`), created_at, updated_at.

#### Scenario: Unique key per agent-user pair
- **WHEN** a memory entry is created with a key that already exists for the same agent+user
- **THEN** system SHALL update the existing entry's content and updated_at instead of creating a duplicate

#### Scenario: Memory isolation between users
- **WHEN** user A has a memory entry "偏好语言=Go" for agent X
- **THEN** user B interacting with agent X SHALL NOT see or be affected by user A's memory

### Requirement: Agent auto-extraction of memory
During execution, the Gateway SHALL instruct the LLM (via system prompt injection) to identify user preferences and facts worth remembering. The LLM MAY emit a special `memory_update` event with key+content pairs. The Gateway SHALL store these as `agent_generated` memory entries.

#### Scenario: LLM extracts preference
- **WHEN** user says "我习惯用 PostgreSQL" during conversation
- **THEN** the LLM MAY emit `memory_update` with key="database_preference", content="用户偏好使用 PostgreSQL"
- **AND** system SHALL upsert this as an `agent_generated` memory entry

#### Scenario: Memory injection into context
- **WHEN** Gateway assembles context for execution
- **THEN** all memory entries for the current agent+user SHALL be formatted and injected into the system prompt section

### Requirement: Memory management API
The system SHALL provide REST endpoints under `/api/v1/ai/agents/:id/memories` with JWT auth:
- `GET /` — list current user's memories for this agent
- `POST /` — create/update a memory entry (source=`user_set`)
- `DELETE /:mid` — delete a specific memory entry

#### Scenario: User views memories
- **WHEN** user requests `GET /api/v1/ai/agents/:id/memories`
- **THEN** system SHALL return all memory entries for the current user and this agent

#### Scenario: User deletes memory
- **WHEN** user deletes a memory entry (regardless of source)
- **THEN** system SHALL soft-delete the entry and it SHALL no longer be injected into context

#### Scenario: User manually sets memory
- **WHEN** user creates a memory via API with key and content
- **THEN** system SHALL store it with source `user_set`

### Requirement: Memory limits
The system SHALL enforce a maximum of 100 memory entries per agent-user pair. When the limit is reached, new `agent_generated` entries SHALL evict the oldest `agent_generated` entry. `user_set` entries SHALL NOT be auto-evicted.

#### Scenario: Memory limit reached
- **WHEN** agent_generated memory count reaches 100 and LLM emits a new memory_update
- **THEN** system SHALL delete the oldest agent_generated entry and store the new one

#### Scenario: User-set entries protected
- **WHEN** memory limit is reached and all entries are user_set
- **THEN** system SHALL NOT auto-evict; new agent_generated entries SHALL be silently dropped

