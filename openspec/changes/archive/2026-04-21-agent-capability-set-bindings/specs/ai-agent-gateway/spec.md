## ADDED Requirements

### Requirement: Capability set runtime resolution
The Agent Gateway SHALL resolve Agent capability set bindings into selected active leaf resources before tool, MCP, skill, or knowledge execution. The Gateway SHALL ignore unselected items, inactive sets, inactive items, and deleted resources.

#### Scenario: Resolve selected tool from bound set
- **WHEN** an Agent has a bound tool capability set with one selected active builtin tool
- **THEN** the Gateway SHALL expose exactly that builtin tool to the executor

#### Scenario: Ignore unselected set item
- **WHEN** an Agent binds a capability set that contains an item not selected for that Agent
- **THEN** the Gateway SHALL NOT expose the unselected item during execution

#### Scenario: Deduplicate item selected through multiple sets
- **WHEN** the same active item is selected through more than one bound capability set
- **THEN** the Gateway SHALL expose that leaf resource only once during execution

## MODIFIED Requirements

### Requirement: Gateway request orchestration
The Agent Gateway SHALL be the single entry point for all agent execution. Upon receiving a user message, the Gateway SHALL: (1) validate the session and agent, (2) store the user message, (3) load message history with truncation, (4) load user memories for this agent, (5) resolve selected knowledge resources from bound capability sets and query them for relevant context, (6) assemble the full ExecuteRequest, (7) dispatch to the appropriate Executor, (8) consume the event stream, (9) store results to DB, (10) translate events to Data Stream lines, (11) forward lines to browser via flushed SSE.

#### Scenario: Full orchestration flow
- **WHEN** user sends a message to a session
- **THEN** Gateway SHALL execute all steps in order and stream Data Stream lines to the browser in real-time

#### Scenario: Agent not found or inactive
- **WHEN** session references an agent that is deleted or inactive
- **THEN** Gateway SHALL return 404 and not attempt execution
