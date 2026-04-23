## ADDED Requirements

### Requirement: MCP runtime tool discovery
The system SHALL discover callable tools from selected active MCP servers before assistant Agent execution. Discovered MCP tools SHALL be converted into LLM tool definitions with valid names, descriptions, parameters, and an owner mapping back to the MCP server.

#### Scenario: Discover tools for assistant runtime
- **WHEN** an assistant Agent has a selected active MCP server
- **THEN** the Gateway SHALL discover that server's callable tools before executor dispatch and expose them as LLM tool definitions

#### Scenario: Skip inactive MCP server
- **WHEN** an assistant Agent has a selected MCP server that is inactive or deleted
- **THEN** the Gateway SHALL omit that MCP server from runtime discovery

#### Scenario: Discovery failure
- **WHEN** MCP discovery fails for one selected MCP server
- **THEN** the Gateway SHALL log the discovery failure and continue assembling tools from other available resources unless the failure makes tool naming ambiguous

### Requirement: MCP runtime tool dispatch
The system SHALL dispatch assistant Agent tool calls for discovered MCP tools to the MCP server that owns the tool. The dispatch SHALL support the configured MCP transport type and SHALL return either the MCP result or a structured tool error to the executor.

#### Scenario: Dispatch discovered MCP tool
- **WHEN** LLM emits a tool_call for a discovered MCP tool
- **THEN** the tool executor SHALL call the owning MCP server with the provided arguments and return the MCP result as the tool_result

#### Scenario: MCP call failure
- **WHEN** the owning MCP server returns an error or is unreachable during a tool call
- **THEN** the tool executor SHALL return a tool_result containing the MCP error and SHALL NOT crash the executor

#### Scenario: Unknown MCP tool name
- **WHEN** LLM emits a tool_call that does not match any discovered MCP tool
- **THEN** the tool executor SHALL return a tool-not-found result

## MODIFIED Requirements

### Requirement: SSE MCP server connection test
The system SHALL provide a "test connection" action for SSE transport MCP servers. The test SHALL attempt to connect to the MCP Server, perform the MCP handshake, and retrieve its tool list using the same discovery path used by assistant runtime assembly.

#### Scenario: Successful SSE connection test
- **WHEN** an administrator triggers test connection for an SSE MCP server
- **THEN** the system connects to the URL, performs MCP handshake, and returns the discovered tool list

#### Scenario: Failed SSE connection test
- **WHEN** an administrator triggers test connection and the MCP server is unreachable
- **THEN** the system returns an error message describing the failure

#### Scenario: STDIO MCP server has no test connection
- **WHEN** the MCP server transport is stdio
- **THEN** the system performs configuration format validation only (command non-empty, args valid JSON array)

### Requirement: MCP server soul_config assembly
When assembling soul_config for an Agent, the system SHALL include full MCP server connection details (transport, url/command/args/env, decrypted auth) for all active MCP servers bound to that Agent. Assistant Gateway runtime assembly SHALL use the same selected active MCP server set for tool discovery and dispatch.

#### Scenario: Assemble MCP config for agent
- **WHEN** the Server assembles soul_config for an Agent with bound MCP servers
- **THEN** the mcp_servers array includes each bound server's full connection configuration with decrypted credentials

#### Scenario: Assistant runtime discovers selected MCP servers
- **WHEN** the Gateway assembles runtime context for an assistant Agent with bound MCP servers
- **THEN** it SHALL discover tools only from selected active MCP servers
