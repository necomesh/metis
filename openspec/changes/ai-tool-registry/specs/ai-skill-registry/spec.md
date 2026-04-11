## ADDED Requirements

### Requirement: Skill installation from GitHub URL
The system SHALL allow administrators to install skills by providing a GitHub URL pointing to a skill directory. The system SHALL fetch the manifest.json, validate it, and store the skill record in the database.

#### Scenario: Install skill from GitHub URL
- **WHEN** an administrator provides a GitHub URL (e.g., github.com/org/repo/tree/main/skills/jira-ops)
- **THEN** the system fetches manifest.json from the URL, parses it, downloads instructions.md and tools/*.json if present, and creates an ai_skills record with source_type=github

#### Scenario: Invalid GitHub URL
- **WHEN** the provided URL does not contain a valid manifest.json
- **THEN** the system returns an error indicating the skill format is invalid

### Requirement: Skill installation from tar.gz upload
The system SHALL allow administrators to install skills by uploading a tar.gz package. The system SHALL extract and validate the package contents.

#### Scenario: Upload valid skill package
- **WHEN** an administrator uploads a tar.gz containing manifest.json (and optional instructions.md and tools/)
- **THEN** the system extracts the package, validates the manifest, and creates an ai_skills record with source_type=upload

#### Scenario: Upload invalid package
- **WHEN** the uploaded file is not a valid tar.gz or lacks manifest.json
- **THEN** the system returns a validation error

### Requirement: Skill CRUD management
The system SHALL allow administrators to list, view, update (auth config), enable/disable, and delete installed skills.

#### Scenario: List all skills
- **WHEN** a GET request is made to `/api/v1/ai/skills`
- **THEN** the system returns all skills with id, name, display_name, description, source_type, source_url, tool count, has_instructions flag, and is_active

#### Scenario: View skill details
- **WHEN** a GET request is made to `/api/v1/ai/skills/:id`
- **THEN** the system returns full skill details including instructions content and tools_schema

#### Scenario: Update skill auth config
- **WHEN** an administrator updates a skill's auth_type and auth_config
- **THEN** the system encrypts and stores the new credentials

#### Scenario: Delete skill
- **WHEN** an administrator deletes a skill
- **THEN** the record is soft-deleted and all agent bindings referencing it are removed

### Requirement: Skill dual-form support
The system SHALL support two skill forms: prompt-only (instructions only, no tools) and endpoint (instructions + tool definitions with HTTP endpoints).

#### Scenario: Prompt-only skill
- **WHEN** a skill has instructions.md but no tools definitions
- **THEN** the skill only contributes to system_prompt injection, with no function calling tools registered

#### Scenario: Endpoint skill
- **WHEN** a skill has both instructions.md and tools definitions
- **THEN** the skill contributes both system_prompt instructions and function calling tool registrations

### Requirement: Skill authentication
The system SHALL support optional per-skill authentication for endpoint skills. Auth credentials SHALL be encrypted at rest and injected into the skill download package when Agent requests it.

#### Scenario: Skill with API key auth
- **WHEN** a skill is configured with auth_type=api_key and an api_key value
- **THEN** the api_key is encrypted at rest, and decrypted when Agent downloads the skill package

#### Scenario: Skill with no auth
- **WHEN** a skill has auth_type=none
- **THEN** no auth_config is included in the download package

### Requirement: Skill package download API for Agent
The system SHALL provide an internal API endpoint for Agent to download skill packages. The endpoint SHALL return the skill's instructions, tools_schema, and decrypted auth_config as a JSON payload.

#### Scenario: Agent downloads skill package
- **WHEN** an Agent makes a GET request to `/api/v1/ai/internal/skills/:id/package` with valid node token
- **THEN** the system returns the skill's full content (manifest, instructions, tools_schema, decrypted auth) as JSON

### Requirement: Skill soul_config assembly
When assembling soul_config for an Agent, the system SHALL include skill references for all active skills bound to that Agent. Each reference SHALL contain the skill ID, name, download URL, and checksum.

#### Scenario: Assemble skill config for agent
- **WHEN** the Server assembles soul_config for an Agent with bound skills
- **THEN** the skills array includes each bound skill's id, name, download_url (pointing to the internal package API), and checksum
