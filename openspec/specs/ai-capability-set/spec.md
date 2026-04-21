# ai-capability-set Specification

## Purpose
TBD - created by archiving change agent-capability-set-bindings. Update Purpose after archive.
## Requirements
### Requirement: Capability set entity
The system SHALL support capability sets as typed groups of Agent-bindable resources. Each capability set SHALL have a type of `tool`, `mcp`, `skill`, `knowledge_base`, or `knowledge_graph`, plus name, description, sort order, active status, and optional icon metadata.

#### Scenario: Create typed capability set
- **WHEN** the system creates or seeds a capability set with type `tool`
- **THEN** the set SHALL only accept builtin tool items

#### Scenario: Reject unsupported capability set type
- **WHEN** a capability set is created with an unsupported type
- **THEN** the system SHALL reject the set as invalid

### Requirement: Capability set item membership
The system SHALL allow a capability set to contain item references that match the set type. A set item reference SHALL be valid only when the referenced resource exists and belongs to the expected resource table/category.

#### Scenario: Add matching item to set
- **WHEN** a knowledge base item is added to a capability set with type `knowledge_base`
- **THEN** the system SHALL store the membership

#### Scenario: Reject mismatched item type
- **WHEN** a knowledge graph item is added to a capability set with type `knowledge_base`
- **THEN** the system SHALL reject the membership as invalid

### Requirement: Agent capability set binding
The system SHALL allow an Agent to bind capability sets and select enabled items within each bound set. Binding a set SHALL NOT automatically enable every item in the set; enabled item selections SHALL be explicit.

#### Scenario: Bind set with selected items
- **WHEN** an Agent is saved with a capability set and two enabled item IDs from that set
- **THEN** the system SHALL persist the set binding and exactly those enabled item selections

#### Scenario: New item added to bound set
- **WHEN** a new item is added to a capability set that is already bound to an Agent
- **THEN** the new item SHALL appear as available for selection
- **AND** it SHALL NOT be enabled for that Agent until explicitly selected

### Requirement: Capability set listing for Agent configuration
The system SHALL expose capability set listing data for Agent configuration screens, including each set's metadata, total item count, and item details needed for checkbox selection.

#### Scenario: List capability sets by type
- **WHEN** the frontend requests capability sets for type `mcp`
- **THEN** the response SHALL include MCP capability sets with their MCP server items

#### Scenario: Hide inactive set from selection
- **WHEN** a capability set is inactive
- **THEN** it SHALL NOT be offered as a new selectable set in Agent create/edit forms

### Requirement: Compatibility migration for direct bindings
The system SHALL migrate existing direct Agent bindings into capability set bindings without changing each Agent's effective runtime capabilities.

#### Scenario: Migrate existing tool bindings
- **WHEN** an Agent has existing direct builtin tool bindings
- **THEN** the migration SHALL place those selected tools under tool capability sets derived from their toolkit grouping

#### Scenario: Preserve flattened effective bindings
- **WHEN** an Agent is read after migration
- **THEN** the flattened selected item IDs SHALL match the Agent's pre-migration direct binding IDs for each capability type

