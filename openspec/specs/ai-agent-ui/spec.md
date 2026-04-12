# ai-agent-ui Specification

## Purpose
TBD - created by archiving change ai-agent-runtime. Update Purpose after archive.
## Requirements
### Requirement: Agent list page
The system SHALL provide an Agent management page at `/ai/agents` accessible to admins. The page SHALL display agents in a card grid layout showing: avatar, name, type badge (AI 助手 / 编程助手), description, visibility badge, status indicator, and creation date.

#### Scenario: View agent list
- **WHEN** admin navigates to `/ai/agents`
- **THEN** system SHALL display all agents with type and visibility filters, keyword search, and pagination

#### Scenario: Type filter
- **WHEN** admin filters by type "assistant"
- **THEN** only assistant-type agents SHALL be shown

### Requirement: Agent creation wizard
The system SHALL provide a multi-step creation wizard via Sheet (drawer). Step 1: choose type (AI 助手 / 编程助手) with visual cards. Step 2: basic info (name, description, avatar). Step 3: type-specific configuration. Step 4: review and create.

#### Scenario: Create assistant agent
- **WHEN** admin selects "AI 助手" type
- **THEN** step 3 SHALL show: model selector, strategy dropdown (ReAct / Plan & Execute), system prompt textarea, temperature/max_tokens/max_turns inputs, and capability binding sections (knowledge bases, tools, MCP servers, skills)

#### Scenario: Create coding agent
- **WHEN** admin selects "编程助手" type
- **THEN** step 3 SHALL show: runtime selector (Claude Code / Codex / OpenCode / Aider), runtime-specific config form (dynamic based on runtime), execution mode radio (本机 / 远程节点), workspace path input, and node selector (shown only when remote mode selected)

#### Scenario: Create from template
- **WHEN** admin clicks a template card on the creation page
- **THEN** wizard SHALL pre-fill all configuration from the template, starting at step 2

### Requirement: Agent edit page
The system SHALL provide an Agent detail/edit page at `/ai/agents/:id` with tabs: Overview (basic info + config), Bindings (tools/knowledge/MCP/skills for assistant), Sessions (list of recent sessions), and Settings (visibility, danger zone with delete).

#### Scenario: Edit assistant configuration
- **WHEN** admin edits an assistant agent's model or tools
- **THEN** changes SHALL take effect for new sessions; existing running sessions continue with old config

#### Scenario: Delete agent
- **WHEN** admin clicks delete and confirms
- **THEN** system SHALL soft-delete the agent if no running sessions exist

### Requirement: Agent test dialog
The system SHALL provide a "测试对话" button on the agent detail page that opens an inline chat panel. This allows admins to test the agent's behavior before publishing.

#### Scenario: Test conversation
- **WHEN** admin clicks "测试对话"
- **THEN** system SHALL create a temporary session and display the chat interface inline

### Requirement: Menu and permission seeding
The system SHALL seed a menu entry "Agents" under the AI module menu group, and corresponding Casbin policies for agent CRUD operations.

#### Scenario: Menu seed
- **WHEN** AI App seed runs
- **THEN** "Agents" menu item SHALL appear in the AI module navigation with icon and correct route

