## MODIFIED Requirements

### Requirement: Knowledge base list page
The system SHALL provide a page listing all knowledge bases with name, description, source_count, node_count, compile_status, and action buttons (compile, edit, delete). node_count and edge_count are fetched dynamically from the API (backed by FalkorDB queries).

#### Scenario: View knowledge base list
- **WHEN** user navigates to the knowledge base management page
- **THEN** system displays a paginated table of knowledge bases with status indicators
- **THEN** node_count reflects real-time count from FalkorDB (0 if never compiled or FalkorDB unavailable)

#### Scenario: Create knowledge base via sheet
- **WHEN** user clicks "Create" button
- **THEN** system opens a Sheet (drawer) with form fields: name, description, compile_model_id (select from available LLM models), embedding_provider_id (select from providers), embedding_model_id (text input or select), auto_compile toggle, crawl_enabled toggle, crawl_schedule input

### Requirement: Knowledge base detail page
The system SHALL provide a detail page for a single knowledge base with tabs: Sources, Knowledge Graph, and Compile Logs.

#### Scenario: View knowledge graph tab
- **WHEN** user selects Knowledge Graph tab
- **THEN** system displays a list of concept nodes with title, summary, has_content indicator, and edge count (all data from FalkorDB via API)
- **THEN** clicking a node shows its full article content and related nodes

#### Scenario: Recall panel search
- **WHEN** user enters a search query in the Recall Panel
- **THEN** system sends the query text to the API, which performs vector similarity search + graph expansion via FalkorDB
- **THEN** results display with similarity scores for seed nodes and "via graph" indicator for expanded neighbor nodes
- **THEN** matched nodes are highlighted on the knowledge graph visualization
