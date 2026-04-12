# Capability: Knowledge Embedding

## Purpose
TBD

## Requirements

### Requirement: Embedding provider and model configuration per knowledge base
The system SHALL allow each KnowledgeBase to configure its own Embedding provider and model via `embedding_provider_id` and `embedding_model_id` fields. These reference existing records in `ai_providers` and `ai_models` tables.

#### Scenario: Configure embedding model for knowledge base
- **WHEN** user creates or updates a KnowledgeBase with embedding_provider_id and embedding_model_id
- **THEN** system stores the configuration and uses it for subsequent compilations

#### Scenario: Embedding not configured
- **WHEN** a KnowledgeBase has no embedding_provider_id or embedding_model_id set
- **THEN** compilation SHALL still proceed (nodes and edges are written to FalkorDB)
- **THEN** vector embeddings SHALL NOT be generated; vector-based recall SHALL be unavailable for this KB
- **THEN** recall falls back to full-text search only

### Requirement: Batch embedding generation after compilation
The system SHALL generate vector embeddings for all KnowledgeNodes after successful compilation. Embedding input SHALL be `title + "\n" + summary` for each node.

#### Scenario: Generate embeddings after compile
- **WHEN** compilation completes and embedding model is configured for the KB
- **THEN** system collects all KnowledgeNode titles and summaries from FalkorDB
- **THEN** system calls `llm.Client.Embedding()` with the configured provider/model in batches
- **THEN** system writes embeddings back to FalkorDB: `MATCH (n:KnowledgeNode {id: $id}) SET n.embedding = vecf32($vec)`

#### Scenario: Embedding API call fails
- **WHEN** Embedding API returns an error for a batch
- **THEN** system logs the error in knowledge_logs
- **THEN** nodes without embeddings SHALL have `embedding = null`; vector recall is degraded but graph structure remains intact

#### Scenario: Index node excluded from embedding
- **WHEN** generating embeddings
- **THEN** system SHALL skip nodes with `node_type = 'index'` — index nodes do not need vector representation

### Requirement: HNSW vector index management
The system SHALL manage HNSW vector indexes on the `embedding` property of KnowledgeNode in FalkorDB. Indexes SHALL be rebuilt after each compilation to avoid concurrent write issues.

#### Scenario: Create vector index after embedding generation
- **WHEN** all embeddings have been written to FalkorDB
- **THEN** system drops any existing vector index and creates a new one: `CREATE VECTOR INDEX FOR (n:KnowledgeNode) ON (n.embedding) OPTIONS {dimension: $dim, similarityFunction: 'cosine'}`
- **THEN** dimension is inferred from the first embedding's length

#### Scenario: Vector index dropped before compilation
- **WHEN** a compilation (compile or recompile) starts
- **THEN** system drops the existing vector index (if any) before writing new data
- **THEN** this prevents HNSW concurrent write issues during the compilation write phase

### Requirement: Embedding-based semantic recall
The system SHALL support semantic recall by converting a text query to a vector and searching FalkorDB's HNSW index.

#### Scenario: Semantic recall with graph expansion
- **WHEN** a recall query is submitted with a text string
- **THEN** system calls Embedding API to convert query to vector
- **THEN** system executes Cypher: vector top-K search → 1-2 hop graph traversal
- **THEN** system returns seed nodes (with similarity scores) and expanded neighbor nodes with relationship metadata

#### Scenario: Recall without embedding configuration
- **WHEN** a recall query is submitted but the KB has no embedding model configured
- **THEN** system falls back to full-text search (no vector similarity, no score)
- **THEN** graph expansion still applies to the full-text search results
