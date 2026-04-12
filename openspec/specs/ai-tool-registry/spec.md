### Requirement: Builtin tool registration via seed
The system SHALL register predefined builtin tools during AI module seed. Each tool SHALL have a unique name, display_name, description (for LLM), and parameters_schema (JSON Schema for function calling). Builtin tools SHALL NOT be created or deleted by users.

#### Scenario: Initial seed registers builtin tools
- **WHEN** the AI module runs seed for the first time
- **THEN** the system creates builtin tool records: search_knowledge, read_document, http_request

#### Scenario: Subsequent seed is idempotent
- **WHEN** the AI module runs seed and builtin tools already exist
- **THEN** no duplicate records are created

### Requirement: Builtin tool enable/disable
The system SHALL allow administrators to enable or disable builtin tools. Disabled tools SHALL NOT be included when assembling soul_config for Agent.

#### Scenario: Admin disables a builtin tool
- **WHEN** an administrator sets a builtin tool's is_active to false
- **THEN** the tool is excluded from soul_config assembly for all agents that reference it

#### Scenario: Admin enables a previously disabled tool
- **WHEN** an administrator sets a builtin tool's is_active to true
- **THEN** the tool is included in soul_config assembly for agents that reference it

### Requirement: Builtin tool listing API
The system SHALL provide an API endpoint to list all builtin tools with their status and parameter schemas.

#### Scenario: List all builtin tools
- **WHEN** a GET request is made to `/api/v1/ai/tools`
- **THEN** the system returns all builtin tools with id, name, display_name, description, parameters_schema, and is_active fields

### Requirement: Builtin tool toggle API
The system SHALL provide an API endpoint to toggle a builtin tool's active state.

#### Scenario: Toggle tool active state
- **WHEN** a PUT request is made to `/api/v1/ai/tools/:id` with `{"isActive": false}`
- **THEN** the system updates the tool's is_active field and returns the updated tool
