### Requirement: Knowledge base CRUD
The system SHALL provide full CRUD operations for knowledge bases. Each knowledge base has name, description, compile_status, compile_model_id, auto_compile flag, crawl_enabled flag, crawl_schedule (cron), and cached counts (source_count, node_count).

#### Scenario: Create knowledge base
- **WHEN** user sends POST /api/v1/ai/knowledge-bases with name and description
- **THEN** system creates the knowledge base with compile_status=idle, auto_compile=false, crawl_enabled=false

#### Scenario: List knowledge bases
- **WHEN** user sends GET /api/v1/ai/knowledge-bases
- **THEN** system returns paginated list with ListParams support (keyword, page, pageSize)

#### Scenario: Update knowledge base
- **WHEN** user sends PUT /api/v1/ai/knowledge-bases/:id with updated fields
- **THEN** system updates the knowledge base, including compile_model_id, auto_compile, crawl_enabled, crawl_schedule

#### Scenario: Delete knowledge base
- **WHEN** user sends DELETE /api/v1/ai/knowledge-bases/:id
- **THEN** system soft-deletes the knowledge base and all associated sources, nodes, edges, and logs

### Requirement: Source ingestion via file upload
The system SHALL support uploading files as knowledge sources. Supported formats: PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), Markdown (.md), and plain text (.txt). Files SHALL be parsed asynchronously via the `ai-source-extract` scheduler task to extract text content into Markdown.

#### Scenario: Upload file source
- **WHEN** user sends POST /api/v1/ai/knowledge-bases/:kbId/sources with a file attachment
- **THEN** system creates a Source record with format detected from extension, extract_status=pending, and enqueues an ai-source-extract task

#### Scenario: File extraction completes
- **WHEN** ai-source-extract task processes a file Source
- **THEN** system extracts text content to Markdown, stores in Source.content, computes content_hash, sets extract_status=completed, updates KB.source_count
- **THEN** if KB.auto_compile=true, system enqueues ai-knowledge-compile task

#### Scenario: File extraction fails
- **WHEN** ai-source-extract task fails to extract content
- **THEN** system sets extract_status=error with error details

### Requirement: Source ingestion via URL
The system SHALL support adding URLs as knowledge sources. URL sources SHALL be fetched and converted from HTML to Markdown. URL sources support crawl_depth (0/1/2) and url_pattern for filtering child pages.

#### Scenario: Add URL source with depth 0
- **WHEN** user sends POST /api/v1/ai/knowledge-bases/:kbId/sources with source_url and crawl_depth=0
- **THEN** system creates a Source record with format=url, extract_status=pending, and enqueues ai-source-extract task
- **THEN** task fetches the URL, converts HTML to Markdown (stripping nav/footer/script/style), stores in Source.content

#### Scenario: Add URL source with depth > 0
- **WHEN** user adds a URL source with crawl_depth=1 or 2
- **THEN** system fetches the main page, extracts same-domain links, filters by url_pattern if set
- **THEN** system creates child Source records (parent_id pointing to main Source) for each matched link
- **THEN** each child Source is fetched and extracted recursively with depth decremented

#### Scenario: URL fetch fails
- **WHEN** URL fetch fails (timeout, 404, etc.)
- **THEN** system sets extract_status=error, does not create child Sources

### Requirement: Source management
The system SHALL allow listing and deleting sources within a knowledge base. Sources are immutable after creation — content cannot be edited, only deleted and re-added.

#### Scenario: List sources
- **WHEN** user sends GET /api/v1/ai/knowledge-bases/:kbId/sources
- **THEN** system returns paginated list of sources with title, format, extract_status, byte_size, created_at

#### Scenario: Delete source
- **WHEN** user sends DELETE /api/v1/ai/knowledge-bases/:kbId/sources/:id
- **THEN** system deletes the source and its child sources (if URL with depth > 0)

### Requirement: LLM knowledge compilation (Wiki mode)
The system SHALL compile all extracted sources in a knowledge base into a knowledge graph using an LLM. Compilation produces concept Nodes (with title, summary, optional content) and relationship Edges. The LLM output uses name-driven references — concept names and source titles, not database IDs. The system resolves names to IDs when writing to the database.

#### Scenario: Trigger compilation
- **WHEN** user sends POST /api/v1/ai/knowledge-bases/:id/compile
- **THEN** system sets compile_status=compiling and enqueues ai-knowledge-compile task

#### Scenario: Compilation produces nodes and edges
- **WHEN** ai-knowledge-compile task runs
- **THEN** LLM receives all Source contents + existing Node titles/summaries
- **THEN** LLM outputs structured JSON with new_nodes and updated_nodes
- **THEN** system writes Nodes to DB, resolves concept names to Node IDs, writes Edges
- **THEN** concepts referenced but without enough content for a full article SHALL be created as Nodes with content=null (graph-only nodes)

#### Scenario: Incremental compilation with cascade updates
- **WHEN** new Sources have been added since last compilation
- **THEN** LLM receives new Sources + all existing Node titles/summaries
- **THEN** LLM outputs new_nodes AND updated_nodes (existing concepts affected by new information)
- **THEN** system updates existing Nodes and Edges accordingly

#### Scenario: Full recompilation
- **WHEN** user sends POST /api/v1/ai/knowledge-bases/:id/recompile
- **THEN** system deletes all existing Nodes and Edges for this KB
- **THEN** system runs full compilation from all Sources

#### Scenario: Compilation generates index node
- **WHEN** compilation completes
- **THEN** system creates or updates an index Node (node_type=index) containing a summary table of all concept titles and their summaries

### Requirement: Post-compilation lint
After compilation completes, the system SHALL automatically run quality checks on the knowledge graph.

#### Scenario: Lint detects orphan nodes
- **WHEN** a Node has no Edges connecting to any other Node
- **THEN** system logs a warning in ai_knowledge_logs with lint_issues count

#### Scenario: Lint detects sparse nodes
- **WHEN** a concept Node has content=null and is referenced by 3+ Edges
- **THEN** system logs a suggestion to enrich this concept

#### Scenario: Lint detects contradictions
- **WHEN** two Nodes with a "contradicts" Edge exist
- **THEN** system logs the contradiction for user review

### Requirement: Compilation logging
The system SHALL record every compilation operation in ai_knowledge_logs.

#### Scenario: Compilation log entry
- **WHEN** a compilation completes (success or error)
- **THEN** system writes a log entry with action, model_id, nodes_created, nodes_updated, edges_created, lint_issues, and timestamp

### Requirement: Scheduled URL crawling
The system SHALL support periodic re-crawling of URL sources to detect content changes.

#### Scenario: Crawl schedule triggers
- **WHEN** ai-knowledge-crawl scheduled task fires
- **THEN** system iterates all KBs with crawl_enabled=true
- **THEN** for each URL Source, re-fetches the URL, computes content_hash
- **THEN** if hash differs from stored hash, updates Source.content and content_hash

#### Scenario: Crawl detects changes and auto-compiles
- **WHEN** crawl updates one or more Sources in a KB with auto_compile=true
- **THEN** system enqueues ai-knowledge-compile task for incremental compilation

### Requirement: Agent knowledge query API
The system SHALL expose a read-only API for Agents to search and retrieve knowledge. These endpoints SHALL support Sidecar token authentication in addition to standard JWT auth.

#### Scenario: Search knowledge nodes
- **WHEN** Agent sends GET /api/v1/ai/knowledge/search?q=keyword&kb_id=1
- **THEN** system returns matching Nodes (title + summary + has_content flag) by matching against title and summary fields

#### Scenario: Read node detail
- **WHEN** Agent sends GET /api/v1/ai/knowledge/nodes/:id
- **THEN** system returns the Node with full content (if available), summary, source_ids, and compiled_at

#### Scenario: Get node relationship graph
- **WHEN** Agent sends GET /api/v1/ai/knowledge/nodes/:id/graph?depth=2
- **THEN** system returns all Nodes and Edges within the specified hop depth from the target Node
