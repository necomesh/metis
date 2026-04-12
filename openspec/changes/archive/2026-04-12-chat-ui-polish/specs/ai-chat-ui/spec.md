## ADDED Requirements

### Requirement: Document-flow message layout
The chat message area SHALL use a single-column left-aligned document-flow layout. Content area SHALL be constrained to `max-w-3xl` (768px) centered horizontally. All messages (user and AI) SHALL be left-aligned within this column.

#### Scenario: User message renders as left-aligned card
- **WHEN** a user message is displayed
- **THEN** it SHALL render as a left-aligned card with `bg-muted rounded-xl` background, a "You" label at the top-left, and the message content below

#### Scenario: AI response renders with agent identity
- **WHEN** an AI response is displayed
- **THEN** it SHALL show the agent name (or fallback "Assistant") at the top-left before the response content

#### Scenario: Content width on wide screens
- **WHEN** the viewport is wider than 768px
- **THEN** the message content area SHALL be centered with `max-w-3xl` and SHALL NOT stretch to fill the viewport

### Requirement: Message action button visibility
The system SHALL use a layered visibility strategy for message action buttons. Copy button and Edit button (on user messages) SHALL be always visible with `text-muted-foreground` styling. Regenerate, ThumbsUp, and ThumbsDown buttons SHALL appear on hover. Performance metrics (token count, duration) SHALL be always visible at the bottom-right of AI responses when available.

#### Scenario: Copy button always visible on AI response
- **WHEN** an AI response is fully rendered (not streaming)
- **THEN** the Copy button SHALL be visible without hover interaction

#### Scenario: Edit button always visible on user message
- **WHEN** a user message is displayed
- **THEN** an Edit (pencil) icon SHALL be visible at the top-right of the message card

#### Scenario: Regenerate button appears on hover
- **WHEN** user hovers over an AI response area
- **THEN** the Regenerate button SHALL become visible

#### Scenario: Performance metrics displayed after completion
- **WHEN** an AI response streaming completes with duration and token data
- **THEN** the bottom-right of the response SHALL display metrics like "128 tok/s · 3.2s"

### Requirement: Thinking block display
The system SHALL render a collapsible Thinking Block when the AI model produces reasoning/thinking content. During streaming, the block SHALL be expanded showing a pulsing indicator, elapsed timer, and real-time thinking text. After completion, the block SHALL automatically collapse to a single line showing "▸ 思考过程（Xs）" which is expandable on click.

#### Scenario: Thinking block during streaming
- **WHEN** SSE events with `type: "thinking_delta"` are received
- **THEN** a Thinking Block SHALL render in expanded state with pulsing dot indicator, elapsed time counter, and accumulated thinking text

#### Scenario: Thinking block after completion
- **WHEN** the thinking phase completes and final response begins
- **THEN** the Thinking Block SHALL collapse to a single clickable line showing total thinking duration

#### Scenario: Thinking block expand/collapse
- **WHEN** user clicks the collapsed thinking block summary line
- **THEN** the full thinking text SHALL expand/collapse with smooth animation

### Requirement: Plan-and-Execute progress display
The system SHALL render a Plan Progress component when the AI uses Plan-and-Execute strategy. The component SHALL display each plan step with status indicators: `✅` for completed steps (with duration), `⏳` for the current step (with pulsing animation), and `○` for pending steps. A progress bar SHALL show `n/total` completion.

#### Scenario: Plan steps rendering during execution
- **WHEN** SSE events contain `steps` array and `stepIndex` field
- **THEN** each step SHALL render with the appropriate status icon based on whether its index is less than, equal to, or greater than `stepIndex`

#### Scenario: Plan progress after completion
- **WHEN** all plan steps are completed
- **THEN** the plan component SHALL collapse to a single line "✅ 计划完成（N步 · Xs）" which is expandable on click

### Requirement: User message editing
The system SHALL allow users to edit previously sent messages. Clicking the edit button SHALL transform the message content into an editable textarea. The user SHALL have "Save & Regenerate" and "Cancel" buttons. Saving SHALL update the message content and trigger regeneration from that point, discarding all subsequent messages.

#### Scenario: Enter edit mode
- **WHEN** user clicks the edit icon on a user message
- **THEN** the message content SHALL become an editable textarea pre-filled with the original content, with "Save & Regenerate" and "Cancel" buttons below

#### Scenario: Save and regenerate
- **WHEN** user edits content and clicks "Save & Regenerate"
- **THEN** the system SHALL call `PUT /api/v1/ai/sessions/:sid/messages/:mid` with new content, remove all subsequent messages from the UI, and initiate a new AI response stream

#### Scenario: Cancel edit
- **WHEN** user clicks "Cancel" during editing
- **THEN** the message SHALL revert to its original content in read-only display

### Requirement: Welcome screen for empty sessions
The system SHALL display a welcome screen when a chat session has no messages. The welcome screen SHALL show the agent's icon (based on type), name, description, and up to 4 suggested prompt cards. Clicking a suggested prompt SHALL immediately send it as the first message.

#### Scenario: New session shows welcome screen
- **WHEN** a session is loaded with zero messages and is not streaming
- **THEN** the welcome screen SHALL display centered in the message area with agent info and suggestion cards

#### Scenario: Clicking suggested prompt
- **WHEN** user clicks a suggested prompt card
- **THEN** the prompt text SHALL be sent as a user message and streaming SHALL begin

#### Scenario: Welcome screen disappears after first message
- **WHEN** the first message is sent or loaded
- **THEN** the welcome screen SHALL no longer be displayed

### Requirement: Streaming experience enhancements
The system SHALL provide enhanced streaming UX: a centered stop button during generation, preserved partial content after cancellation with "Continue Generating" and "Regenerate" action buttons, and inline error display with retry capability instead of toast notifications.

#### Scenario: Stop button during streaming
- **WHEN** the AI is generating a response
- **THEN** a centered "■ Stop" button SHALL appear below the streaming content

#### Scenario: Content preserved after cancellation
- **WHEN** user cancels an in-progress generation
- **THEN** the already-generated text SHALL remain visible, a "⚠️ 生成已停止" indicator SHALL appear, and "Continue Generating" and "Regenerate" buttons SHALL be shown

#### Scenario: Inline error with retry
- **WHEN** a streaming error occurs
- **THEN** an inline error card SHALL appear in the message flow with the error message and a "Retry" button, instead of a toast notification

### Requirement: Rich tool call rendering
The system SHALL render tool calls with type-specific rich formatting. Known tool types (e.g., knowledge search) SHALL display a friendly summary with icon, description, and result count. Unknown tool types SHALL fall back to the expandable JSON display. A `toolRenderers` registry SHALL map tool names to custom render components.

#### Scenario: Knowledge search tool call
- **WHEN** a tool call with `tool_name: "search_knowledge"` is rendered
- **THEN** it SHALL display a search icon, the knowledge base name, search query, and result count summary instead of raw JSON

#### Scenario: Unknown tool fallback
- **WHEN** a tool call with an unregistered tool name is rendered
- **THEN** it SHALL display the generic wrench icon, tool name, and expandable JSON arguments (current behavior)

#### Scenario: Tool call with execution timing
- **WHEN** a tool result is received with timing metadata
- **THEN** the tool call display SHALL include the execution duration (e.g., "0.8s")
