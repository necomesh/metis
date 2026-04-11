## MODIFIED Requirements

### Requirement: Frontend app registry includes AI module
The frontend app registry SHALL import the AI module for route registration.

#### Scenario: AI routes registered in frontend
- **WHEN** the frontend app loads
- **THEN** `web/src/apps/registry.ts` includes `import './ai/module'` and AI management pages are accessible via routing
