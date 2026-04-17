## ADDED Requirements

### Requirement: Org App implements ToolRegistryProvider
The Org App SHALL implement `app.ToolRegistryProvider` to expose an `OrgToolRegistry` that handles `organization.org_context` tool calls. The registry SHALL be registered in the IOC container during `Providers()`.

#### Scenario: OrgToolRegistry discovered by AI CompositeToolExecutor
- **WHEN** the AI App's `collectToolRegistries()` scans all apps
- **THEN** the Org App's `OrgToolRegistry` SHALL be returned and `organization.org_context` calls SHALL be routed to it

#### Scenario: Org App not installed
- **WHEN** the system runs in edition_lite without the Org App
- **THEN** `organization.org_context` SHALL not exist as a BuiltinTool record, and no OrgToolRegistry SHALL be available

### Requirement: OrgToolRegistry handles org_context tool
The `OrgToolRegistry` SHALL implement the `ToolHandlerRegistry` interface with `HasTool(name string) bool` and `Execute(ctx, toolName, userID, args) (json.RawMessage, error)`. It SHALL handle the `organization.org_context` tool by delegating to `app.OrgResolver.QueryContext`.

#### Scenario: Execute org_context with username filter
- **WHEN** `Execute` is called with toolName `organization.org_context` and args `{"username": "zhangsan"}`
- **THEN** the handler SHALL call `OrgResolver.QueryContext("zhangsan", "", "", false)` and return the result as JSON

#### Scenario: Execute org_context with department filter
- **WHEN** `Execute` is called with toolName `organization.org_context` and args `{"department_code": "it"}`
- **THEN** the handler SHALL call `OrgResolver.QueryContext("", "it", "", false)` and return the result as JSON

#### Scenario: HasTool returns true for org_context
- **WHEN** `HasTool("organization.org_context")` is called
- **THEN** it SHALL return true

#### Scenario: HasTool returns false for unknown tools
- **WHEN** `HasTool("unknown.tool")` is called
- **THEN** it SHALL return false

### Requirement: org_context BuiltinTool seeded by Org App
The Org App's Seed method SHALL create the `organization.org_context` BuiltinTool record with toolkit `organization`, display name "组织架构查询", and the appropriate parameter schema (username, department_code, position_code, include_inactive).

#### Scenario: Org seed creates org_context tool
- **WHEN** the Org App seed runs and no BuiltinTool with name `organization.org_context` exists
- **THEN** it SHALL create the BuiltinTool record with is_builtin=true, is_active=true

#### Scenario: Org seed is idempotent for org_context tool
- **WHEN** the Org App seed runs and `organization.org_context` BuiltinTool already exists
- **THEN** it SHALL not create a duplicate record
