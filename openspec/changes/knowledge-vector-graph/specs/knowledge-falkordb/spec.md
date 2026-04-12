## ADDED Requirements

### Requirement: FalkorDB connection management
The system SHALL manage a FalkorDB client connection configured via `metis.yaml` (`falkordb.addr`, `falkordb.password`, `falkordb.database`). The client SHALL be registered in the IOC container and implement `do.Shutdowner` for graceful cleanup.

#### Scenario: FalkorDB configured and available
- **WHEN** AI App starts with `falkordb.addr` configured in `metis.yaml`
- **THEN** system creates a FalkorDB client, verifies connectivity with a PING, and registers it in the IOC container

#### Scenario: FalkorDB not configured
- **WHEN** AI App starts without `falkordb` section in `metis.yaml`
- **THEN** system logs a warning and knowledge graph features (compile, recall) SHALL be unavailable
- **THEN** other AI features (models, providers, tools, skills) SHALL remain functional

#### Scenario: FalkorDB connection lost at runtime
- **WHEN** FalkorDB becomes unreachable during operation
- **THEN** knowledge-related API calls SHALL return HTTP 503 with a clear error message
- **THEN** system SHALL attempt reconnection on subsequent requests

### Requirement: Graph lifecycle management
The system SHALL manage one FalkorDB named graph per KnowledgeBase using the naming convention `kb_<knowledge_base_id>`.

#### Scenario: Graph created on first compile
- **WHEN** a KnowledgeBase is compiled for the first time
- **THEN** system creates a new FalkorDB graph named `kb_<id>` by executing the first MERGE/CREATE query

#### Scenario: Graph deleted on knowledge base deletion
- **WHEN** a KnowledgeBase is deleted (soft-delete in GORM)
- **THEN** system executes `GRAPH.DELETE kb_<id>` to remove the entire graph
- **THEN** deletion is eventually consistent — GORM delete completes first, FalkorDB cleanup follows

#### Scenario: Graph rebuilt on recompile
- **WHEN** user triggers recompile for a KnowledgeBase
- **THEN** system executes `GRAPH.DELETE kb_<id>` to clear the existing graph
- **THEN** system proceeds with full compilation, writing new nodes and edges

### Requirement: Knowledge node and edge storage in FalkorDB
The system SHALL store knowledge nodes as `(:KnowledgeNode)` graph nodes and edges as typed relationships in FalkorDB. Each node SHALL have properties: `id` (UUID string), `title`, `summary`, `content` (nullable), `node_type` ("concept"/"index"), `source_ids` (JSON array string), `compiled_at` (unix timestamp), `embedding` (vecf32, nullable).

#### Scenario: Write nodes during compilation
- **WHEN** compile service produces node output
- **THEN** system executes Cypher `MERGE (n:KnowledgeNode {title: $title}) SET n.summary = $summary, n.content = $content, ...` to upsert nodes

#### Scenario: Write edges during compilation
- **WHEN** compile service produces relationship output
- **THEN** system executes Cypher `MATCH (a:KnowledgeNode {title: $from}), (b:KnowledgeNode {title: $to}) MERGE (a)-[r:<RELATION_TYPE>]->(b) SET r.description = $desc`
- **THEN** relationship types SHALL be one of: `RELATED_TO`, `EXTENDS`, `CONTRADICTS`, `PART_OF`

#### Scenario: Query node count and edge count
- **WHEN** API needs node_count or edge_count for a KnowledgeBase
- **THEN** system queries FalkorDB: `MATCH (n:KnowledgeNode) WHERE n.node_type <> 'index' RETURN count(n)` and `MATCH ()-[r]->() RETURN count(r)`

### Requirement: Full-text search index
The system SHALL maintain a FalkorDB full-text index on KnowledgeNode `title` and `summary` properties for keyword-based searching in the management panel.

#### Scenario: Full-text index created after compilation
- **WHEN** compilation completes and nodes are written
- **THEN** system creates a full-text index: `CREATE FULLTEXT INDEX FOR (n:KnowledgeNode) ON (n.title, n.summary)`

#### Scenario: Keyword search via full-text index
- **WHEN** management panel sends a keyword search query
- **THEN** system executes `CALL db.idx.fulltext.queryNodes('node_ft_idx', $keyword) YIELD node RETURN node`
