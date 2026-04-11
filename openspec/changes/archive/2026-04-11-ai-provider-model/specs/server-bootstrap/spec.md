## MODIFIED Requirements

### Requirement: Edition full imports all apps
The `edition_full.go` file SHALL import all available app packages including the AI app.

#### Scenario: AI app registered in full edition
- **WHEN** the server binary is built without edition tags (default full edition)
- **THEN** `cmd/server/edition_full.go` includes `import _ "metis/internal/app/ai"` and the AI app is registered
