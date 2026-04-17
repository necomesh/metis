## MODIFIED Requirements

### Requirement: Builtin tool registration via seed
The AI module seed SHALL register predefined builtin tools during AI module seed, EXCLUDING `organization.org_context` which is now owned by the Org App. Each tool SHALL have a unique name, display_name, description (for LLM), and parameters_schema (JSON Schema for function calling). Builtin tools SHALL NOT be created or deleted by users.

The `GeneralToolRegistry` SHALL no longer include an `org_context` handler. It SHALL retain `general.current_time` and `system.current_user_profile`. The `current_user_profile` handler SHALL use `app.OrgResolver` (resolved from IOC, may be nil) instead of the former `ai.OrgResolver` interface.

#### Scenario: Initial seed registers builtin tools without org_context
- **WHEN** the AI module runs seed for the first time
- **THEN** the system creates builtin tool records: search_knowledge, read_document, http_request, current_time, current_user_profile. The system SHALL NOT create `organization.org_context` (owned by Org App)

#### Scenario: Subsequent seed is idempotent
- **WHEN** the AI module runs seed and builtin tools already exist
- **THEN** no duplicate records are created

#### Scenario: current_user_profile with Org App installed
- **WHEN** `system.current_user_profile` is executed and `app.OrgResolver` is available in IOC
- **THEN** the handler SHALL call `OrgResolver.GetUserDepartment` and `OrgResolver.GetUserPositions` to enrich the result

#### Scenario: current_user_profile without Org App
- **WHEN** `system.current_user_profile` is executed and `app.OrgResolver` is nil
- **THEN** the handler SHALL return user info without department and positions fields
