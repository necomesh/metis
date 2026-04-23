## MODIFIED Requirements

### Requirement: Agent creation wizard
The system SHALL provide a multi-step creation wizard via Sheet (drawer). Step 1: choose type (AI 助手 / 编程助手) with visual cards. Step 2: basic info (name, description, avatar). Step 3: type-specific configuration. Step 4: review and create. Capability binding controls SHALL present outer cards as capability sets and SHALL open set-scoped item selection when a set card is clicked.

#### Scenario: Create assistant agent
- **WHEN** admin selects "AI 助手" type
- **THEN** step 3 SHALL show: model selector, strategy dropdown (ReAct / Plan & Execute), system prompt textarea, temperature/max_tokens/max_turns inputs, and capability set binding sections for knowledge bases, knowledge graphs, tools, MCP servers, and skills

#### Scenario: Create coding agent
- **WHEN** admin selects "编程助手" type
- **THEN** step 3 SHALL show: runtime selector (Claude Code / Codex / OpenCode / Aider), runtime-specific config form (dynamic based on runtime), execution mode radio (本机 / 远程节点), workspace path input, and node selector (shown only when remote mode selected)

#### Scenario: Create from template
- **WHEN** admin clicks a template card on the creation page
- **THEN** wizard SHALL pre-fill all configuration from the template, starting at step 2

#### Scenario: Select items inside capability set
- **WHEN** admin clicks a capability set card in the Agent form
- **THEN** the system SHALL open a Sheet listing the items inside that set with checkbox selection
- **AND** the set card SHALL show selected count and total item count after selection

### Requirement: Agent edit page
The system SHALL provide an Agent detail/edit page at `/ai/agents/:id` with tabs: Overview (basic info + config), Bindings (capability sets and selected items), Sessions (list of recent sessions), and Settings (visibility, danger zone with delete). Binding summaries SHALL group selected resources by capability set rather than showing only flat category rows.

#### Scenario: Edit assistant configuration
- **WHEN** admin edits an assistant agent's model or capability set selections
- **THEN** changes SHALL take effect for new sessions; existing running sessions continue with old config

#### Scenario: Delete agent
- **WHEN** admin clicks delete and confirms
- **THEN** system SHALL soft-delete the agent if no running sessions exist

#### Scenario: View bound capability sets
- **WHEN** admin opens the Agent detail bindings tab
- **THEN** the system SHALL display capability set cards with selected item count and total item count

#### Scenario: Inspect selected set items
- **WHEN** admin clicks a bound capability set card
- **THEN** the system SHALL show the selected items inside that set, including unavailable items when the system can identify that a previously selected item is inactive or deleted
