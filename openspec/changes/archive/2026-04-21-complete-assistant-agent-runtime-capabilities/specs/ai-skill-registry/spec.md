## ADDED Requirements

### Requirement: Assistant skill runtime loading
The Agent Gateway SHALL load selected active skills during assistant Agent runtime assembly. Prompt-only skills SHALL append their instructions to the assistant system prompt. Endpoint skills SHALL append their instructions and expose validated tool definitions to the LLM only when the endpoint execution contract is supported.

#### Scenario: Load prompt-only skill into assistant prompt
- **WHEN** an assistant Agent has a selected active skill with instructions and no tool definitions
- **THEN** the Gateway SHALL append the skill instructions to the assembled system prompt and SHALL NOT expose a function calling tool for that skill

#### Scenario: Load endpoint skill tool
- **WHEN** an assistant Agent has a selected active endpoint skill with a valid tool schema and executable endpoint contract
- **THEN** the Gateway SHALL expose the skill tool definition to the LLM and route matching tool calls to the skill executor

#### Scenario: Skip inactive skill
- **WHEN** an assistant Agent has a selected skill that is inactive or deleted
- **THEN** the Gateway SHALL omit that skill's instructions and tools from runtime assembly

#### Scenario: Skip invalid skill tool schema
- **WHEN** an active selected skill has malformed tool schema
- **THEN** the Gateway SHALL omit that skill's endpoint tools, log the validation failure, and continue assembling the rest of the runtime context

## MODIFIED Requirements

### Requirement: Skill dual-form support
The system SHALL support two skill forms: prompt-only (instructions only, no tools) and endpoint (instructions + tool definitions with executable endpoint contracts). During assistant Agent runs, prompt-only skills SHALL contribute to system_prompt injection, and endpoint skills SHALL contribute both system_prompt instructions and function calling tool registrations when their tool schemas are valid.

#### Scenario: Prompt-only skill
- **WHEN** a selected active skill has instructions.md but no tools definitions
- **THEN** the skill SHALL contribute to assistant system_prompt injection, with no function calling tools registered

#### Scenario: Endpoint skill
- **WHEN** a selected active skill has both instructions.md and valid executable tools definitions
- **THEN** the skill SHALL contribute both system_prompt instructions and function calling tool registrations

### Requirement: Skill soul_config assembly
When assembling soul_config for an Agent, the system SHALL include skill references for all active skills bound to that Agent. Each reference SHALL contain the skill ID, name, download URL, and checksum. Assistant Gateway runtime assembly SHALL use the same selected active skill set when injecting skill instructions and registering endpoint skill tools.

#### Scenario: Assemble skill config for agent
- **WHEN** the Server assembles soul_config for an Agent with bound skills
- **THEN** the skills array includes each bound skill's id, name, download_url (pointing to the internal package API), and checksum

#### Scenario: Assistant runtime uses selected skill set
- **WHEN** the Gateway assembles runtime context for an assistant Agent with bound skills
- **THEN** it SHALL use the selected active skill set and SHALL NOT include unselected, inactive, or deleted skills
