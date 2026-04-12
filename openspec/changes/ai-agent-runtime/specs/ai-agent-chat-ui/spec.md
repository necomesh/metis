## ADDED Requirements

### Requirement: Unified chat interface
The system SHALL provide a chat page at `/ai/chat/:sid` (or embeddable panel) with a unified interface for all agent types. The interface SHALL display: message bubbles (user on right, assistant on left), tool call/result collapsible blocks, streaming text with typing indicator, and input area with send button.

#### Scenario: Stream text response
- **WHEN** agent streams content_delta events
- **THEN** UI SHALL render text incrementally in the assistant bubble with a typing cursor

#### Scenario: Display tool call
- **WHEN** agent emits tool_call followed by tool_result
- **THEN** UI SHALL show a collapsible block with tool name, arguments, and result

#### Scenario: Display plan (Plan & Execute)
- **WHEN** agent emits a plan event
- **THEN** UI SHALL show a numbered step list with progress indicators, updating as each step_start arrives

### Requirement: Session history sidebar
The chat page SHALL include a session list sidebar showing the user's conversation history with the current agent. Sessions SHALL display: title (auto-generated from first message), relative timestamp, and truncated last message preview.

#### Scenario: Switch session
- **WHEN** user clicks a different session in the sidebar
- **THEN** UI SHALL load and display that session's full message history

#### Scenario: New conversation
- **WHEN** user clicks "+ 新对话" button
- **THEN** system SHALL create a new session and switch to an empty chat view

### Requirement: Cancel button
The chat interface SHALL display a "停止" button while execution is in progress. Clicking it SHALL call the cancel API.

#### Scenario: Cancel mid-execution
- **WHEN** user clicks "停止" while agent is responding
- **THEN** UI SHALL call `POST /api/v1/ai/sessions/:sid/cancel` and display the partial response with a "已中断" indicator

### Requirement: Agent selector
The system SHALL provide an agent selection page at `/ai/chat` listing all agents visible to the current user. Each agent card shows: avatar, name, description, type badge.

#### Scenario: Select agent to chat
- **WHEN** user clicks an agent card
- **THEN** system SHALL navigate to a new session with that agent

#### Scenario: Resume existing session
- **WHEN** user has prior sessions with an agent
- **THEN** the agent card SHALL show a "继续对话" option alongside "新对话"

### Requirement: Memory management panel
The chat page SHALL include a memory panel (accessible via settings icon or dedicated tab) showing what the agent remembers about the current user. Each entry shows key and content with a delete button.

#### Scenario: View memories
- **WHEN** user opens memory panel
- **THEN** system SHALL display all memory entries for this agent+user

#### Scenario: Delete memory
- **WHEN** user clicks delete on a memory entry
- **THEN** system SHALL call DELETE API and remove the entry from the list

### Requirement: Responsive layout
The chat interface SHALL be responsive: on desktop, sidebar + chat area side by side; on mobile, sidebar collapses into a hamburger menu.

#### Scenario: Desktop layout
- **WHEN** viewport width > 768px
- **THEN** session sidebar and chat area SHALL display side by side

#### Scenario: Mobile layout
- **WHEN** viewport width <= 768px
- **THEN** session sidebar SHALL be hidden behind a toggle button
