## ADDED Requirements

### Requirement: Agent entity with two types
The system SHALL support an Agent entity with two types: `assistant` and `coding`. Each Agent SHALL have: name (unique), description, avatar, type, visibility (`private` | `team` | `public`), created_by (FK → User), and is_active status.

#### Scenario: Create assistant agent
- **WHEN** admin creates an Agent with type `assistant`
- **THEN** system stores the agent with assistant-specific fields (strategy, model_id, system_prompt, temperature, max_tokens, max_turns)

#### Scenario: Create coding agent
- **WHEN** admin creates an Agent with type `coding`
- **THEN** system stores the agent with coding-specific fields (runtime, runtime_config, exec_mode, node_id, workspace)

#### Scenario: Agent name uniqueness
- **WHEN** admin creates an Agent with a name that already exists
- **THEN** system SHALL return a 409 conflict error

### Requirement: Assistant agent configuration
An assistant-type Agent SHALL have: strategy (`react` | `plan_and_execute`, default `react`), model_id (FK → AIModel, required), system_prompt (text), temperature (float, default 0.7), max_tokens (int, default 4096), max_turns (int, default 10). Strategy field SHALL be extensible for future values.

#### Scenario: Default strategy
- **WHEN** admin creates an assistant agent without specifying strategy
- **THEN** system SHALL set strategy to `react`

#### Scenario: Invalid model reference
- **WHEN** admin creates an assistant agent with a model_id that does not exist or is inactive
- **THEN** system SHALL return a 400 error

### Requirement: Assistant agent tool binding
An assistant-type Agent SHALL support binding to: Tool IDs (M2M via ai_agent_tools), Skill IDs (M2M via ai_agent_skills), MCP Server IDs (M2M via ai_agent_mcp_servers), Knowledge Base IDs (M2M via ai_agent_knowledge_bases). All bindings are optional.

#### Scenario: Bind tools to agent
- **WHEN** admin updates an assistant agent with tool_ids, skill_ids, mcp_server_ids, and knowledge_base_ids
- **THEN** system SHALL replace the existing bindings with the new set

#### Scenario: Bound resource deleted
- **WHEN** a Tool/Skill/MCP Server/Knowledge Base bound to an agent is deleted
- **THEN** the binding record SHALL be cascade-deleted

### Requirement: Coding agent configuration
A coding-type Agent SHALL have: runtime (`claude-code` | `codex` | `opencode` | `aider`, required), runtime_config (JSON, schema varies by runtime), exec_mode (`local` | `remote`, default `local`), node_id (FK → Node, required when exec_mode=`remote`), workspace (string, project directory path).

#### Scenario: Local coding agent
- **WHEN** admin creates a coding agent with exec_mode `local`
- **THEN** system SHALL store the agent without requiring node_id

#### Scenario: Remote coding agent without node
- **WHEN** admin creates a coding agent with exec_mode `remote` but no node_id
- **THEN** system SHALL return a 400 error

#### Scenario: Runtime config validation
- **WHEN** admin creates a coding agent with runtime `claude-code` and runtime_config missing required fields
- **THEN** system SHALL return a 400 error with field-level validation details

### Requirement: Common agent fields
Both agent types SHALL support an `instructions` text field for injecting contextual guidance. Both types SHALL support `knowledge_base_ids` binding for knowledge context injection.

#### Scenario: Instructions on assistant agent
- **WHEN** an assistant agent has instructions set
- **THEN** instructions SHALL be appended to the system prompt during execution

#### Scenario: Instructions on coding agent
- **WHEN** a coding agent has instructions set
- **THEN** instructions SHALL be injected into the coding tool's instruction mechanism (e.g., CLAUDE.md for claude-code)

### Requirement: Agent CRUD API
The system SHALL provide REST endpoints under `/api/v1/ai/agents` with JWT + Casbin auth:
- `POST /` — create agent
- `GET /` — list agents (with pagination, keyword search, type filter, visibility filter)
- `GET /:id` — get agent detail
- `PUT /:id` — update agent
- `DELETE /:id` — soft-delete agent (blocked if active sessions exist)

#### Scenario: List agents with type filter
- **WHEN** user requests `GET /api/v1/ai/agents?type=assistant`
- **THEN** system SHALL return only assistant-type agents visible to the user

#### Scenario: Delete agent with active sessions
- **WHEN** admin deletes an agent that has sessions with status `running`
- **THEN** system SHALL return a 409 error

### Requirement: Agent visibility
Agents with visibility `private` SHALL be visible only to the creator. Agents with visibility `team` SHALL be visible to all authenticated users. Agents with visibility `public` SHALL be accessible without authentication (future: external API).

#### Scenario: Private agent access
- **WHEN** a non-creator user requests a private agent
- **THEN** system SHALL return 403

#### Scenario: Team agent listing
- **WHEN** an authenticated user lists agents
- **THEN** system SHALL return all `team` and `public` agents, plus the user's own `private` agents

### Requirement: Agent templates
The system SHALL provide seed-based agent templates. Each template SHALL pre-fill agent configuration (type, strategy, system_prompt, suggested tool bindings). Templates are read-only reference data, creating from a template copies the config into a new agent.

#### Scenario: Create agent from template
- **WHEN** admin creates an agent with template_id
- **THEN** system SHALL copy the template's configuration into the new agent, allowing overrides

#### Scenario: List templates
- **WHEN** user requests `GET /api/v1/ai/agents/templates`
- **THEN** system SHALL return all available templates with their pre-filled configurations
