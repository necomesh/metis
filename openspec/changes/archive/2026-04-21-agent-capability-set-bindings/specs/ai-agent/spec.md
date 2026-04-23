## MODIFIED Requirements

### Requirement: Assistant agent tool binding
An assistant-type Agent SHALL support binding to capability sets for builtin tools, skills, MCP servers, knowledge bases, and knowledge graphs. Each bound capability set SHALL include explicit selected item IDs scoped to that set. All bindings are optional. Legacy flat binding ID arrays MAY be returned as derived compatibility fields, but set-scoped bindings SHALL be canonical for create and update operations.

#### Scenario: Bind capability sets to agent
- **WHEN** admin updates an assistant agent with selected capability sets and selected item IDs inside each set
- **THEN** system SHALL replace the existing set-scoped bindings with the new set selections
- **AND** system SHALL expose derived flat selected IDs for compatibility consumers

#### Scenario: Bound resource deleted
- **WHEN** a Tool/Skill/MCP Server/Knowledge Base/Knowledge Graph selected by an agent is deleted
- **THEN** the selected item reference SHALL no longer be included in the Agent's effective runtime bindings

#### Scenario: Reject item outside selected set
- **WHEN** admin updates an assistant agent with a selected item ID that is not a member of the referenced capability set
- **THEN** system SHALL return a 400 error

### Requirement: Common agent fields
Both agent types SHALL support an `instructions` text field for injecting contextual guidance. Both types SHALL support capability set bindings for knowledge context injection where the selected set items resolve to knowledge base or knowledge graph resources.

#### Scenario: Instructions on assistant agent
- **WHEN** an assistant agent has instructions set
- **THEN** instructions SHALL be appended to the system prompt during execution

#### Scenario: Instructions on coding agent
- **WHEN** a coding agent has instructions set
- **THEN** instructions SHALL be injected into the coding tool's instruction mechanism (e.g., CLAUDE.md for claude-code)

#### Scenario: Knowledge set bindings on agent
- **WHEN** an Agent has selected knowledge base or knowledge graph items through capability set bindings
- **THEN** those selected knowledge resources SHALL be available as the Agent's knowledge context
