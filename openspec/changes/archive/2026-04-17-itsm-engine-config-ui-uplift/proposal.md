## Why

The ITSM engine config page is a flat stack of equal-weight cards with no visual hierarchy. Agent cards (Servicedesk, Decision) show only a dropdown — the user has zero context about what agent they selected (model, tools, strategy). There's no indication of whether the configuration is healthy or broken.

## What Changes

- **Two-column layout** for Servicedesk and Decision agent cards, reducing vertical space and creating visual pairing
- **Agent preview panel** below each agent dropdown showing key details (model, provider, strategy, tool count, temperature, max turns) from the already-fetched agent list
- **Configuration status indicator** on each card header: green dot (configured & healthy), gray dot (unconfigured), red dot (agent missing/inactive)

## Capabilities

### New Capabilities

_None — this is a UI-only enhancement within the existing engine-config page._

### Modified Capabilities

- `itsm-engine-config`: Adding agent preview display, two-column agent layout, and status indicators to the engine configuration UI

## Impact

- **Frontend only**: `web/src/apps/itsm/pages/engine-config/index.tsx` — layout and component changes
- **No backend changes**: Agent detail data is reused from the existing `fetchAgents` query (already called for the dropdown)
- **No API changes**: GET/PUT `/api/v1/itsm/engine/config` unchanged
- **Locales**: New i18n keys for status labels and agent preview fields
