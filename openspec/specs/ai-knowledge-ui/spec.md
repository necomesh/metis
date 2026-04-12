### Requirement: Knowledge base list page
The system SHALL provide a page listing all knowledge bases with name, description, source_count, node_count, compile_status, and action buttons (compile, edit, delete).

#### Scenario: View knowledge base list
- **WHEN** user navigates to the knowledge base management page
- **THEN** system displays a paginated table of knowledge bases with status indicators

#### Scenario: Create knowledge base via sheet
- **WHEN** user clicks "Create" button
- **THEN** system opens a Sheet (drawer) with form fields: name, description, compile_model_id (select from available LLM models), auto_compile toggle, crawl_enabled toggle, crawl_schedule input

### Requirement: Knowledge base detail page
The system SHALL provide a detail page for a single knowledge base with two tabs: Sources and Knowledge Graph.

#### Scenario: View sources tab
- **WHEN** user opens a knowledge base detail and selects Sources tab
- **THEN** system displays a list of sources with title, format icon, extract_status badge, byte_size, created_at
- **THEN** each source shows its content preview on click

#### Scenario: Upload file source
- **WHEN** user clicks upload button and selects files
- **THEN** system uploads files, creates Source records, shows extract_status as "pending"
- **THEN** status updates to "completed" or "error" as extraction finishes

#### Scenario: Add URL source
- **WHEN** user clicks "Add URL" button
- **THEN** system opens a Sheet with fields: URL, crawl_depth (0/1/2 selector), url_pattern (optional)
- **THEN** after submission, source appears with extract_status=pending

#### Scenario: View knowledge graph tab
- **WHEN** user selects Knowledge Graph tab
- **THEN** system displays a list of concept nodes with title, summary, has_content indicator, and edge count
- **THEN** clicking a node shows its full article content and related nodes

### Requirement: Compile controls
The system SHALL provide UI controls to trigger and monitor knowledge compilation.

#### Scenario: Trigger compilation
- **WHEN** user clicks "Compile" button on the knowledge base detail page
- **THEN** system sends POST /compile, button changes to loading state with compile_status indicator
- **THEN** compile_status updates reflect progress (compiling → completed/error)

#### Scenario: Trigger recompilation
- **WHEN** user clicks "Recompile" from the action menu
- **THEN** system shows a confirmation dialog warning that all existing nodes will be regenerated
- **THEN** upon confirmation, sends POST /recompile

### Requirement: Compilation log viewer
The system SHALL display compilation history for a knowledge base.

#### Scenario: View compilation logs
- **WHEN** user accesses compilation logs (via detail page)
- **THEN** system displays a chronological list of compile operations with: timestamp, action type, model used, nodes created/updated, lint issues count
