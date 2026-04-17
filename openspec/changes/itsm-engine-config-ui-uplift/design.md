## Context

The ITSM engine config page (`/itsm/engine-config`) is a vertical stack of four equal-weight Card components. The Servicedesk and Decision agent cards each contain only a dropdown selector — no context about the selected agent. No status indicators exist to show whether the configuration is healthy.

The `itsm-engine-agent-selector` change already moved from raw Provider/Model/Temp selectors to Agent dropdowns. This change improves the visual presentation of those selections.

**Current data available without backend changes:**
- `fetchAgents()` returns `strategy`, `temperature`, `maxTurns`, `modelId` per agent (the TS interface just doesn't capture them yet)
- `fetchEngineConfig()` returns `agentId` + `agentName` for servicedesk/decision
- Generator section already fetches providers + models

## Goals / Non-Goals

**Goals:**
- Two-column layout for Servicedesk and Decision agent cards — reduce vertical space, create visual pairing
- Agent preview panel showing key details (strategy, temperature, maxTurns) from the already-fetched agent list
- Configuration status indicator (green/gray/red dot) on each card header based on config health

**Non-Goals:**
- Backend API changes — all data comes from existing endpoints
- Model name display in agent preview (would require additional API calls or backend enrichment — defer)
- Fallback assignee user picker (separate change)
- Sidebar nav / tabbed layout for ITSM settings

## Decisions

### 1. Agent preview data source: reuse `fetchAgents` query

**Decision**: Extend `AgentItem` interface to capture `strategy`, `temperature`, `maxTurns`, `modelId` from the existing list API response. Find the selected agent by ID in the cached list to populate the preview.

**Alternative considered**: Fetch agent detail endpoint per-card on selection. Rejected — adds N+1 requests and the list already returns what we need.

### 2. Status indicator logic

Three states per card, computed from config + agent list data:

| State | Condition | Visual |
|-------|-----------|--------|
| Configured | agentId > 0 AND agent exists in list AND agent.isActive | `bg-green-500` dot |
| Unconfigured | agentId === 0 | `bg-gray-400` dot |
| Error | agentId > 0 BUT agent not found in list OR !isActive | `bg-red-500` dot |

Generator card: configured if `modelId > 0`, unconfigured if 0, error if model not in provider's model list.
General settings card: always configured (has defaults from seed).

### 3. Two-column layout scope

Only the two agent cards become a `grid grid-cols-2` row. Generator stays full-width above (it has more fields). General settings stays full-width below. This gives:

```
┌─────────────────────────────────────────────────┐
│  Generator (full width)                         │
├────────────────────────┬────────────────────────┤
│  Servicedesk Agent     │  Decision Agent        │
├────────────────────────┴────────────────────────┤
│  General Settings (full width)                  │
└─────────────────────────────────────────────────┘
```

On mobile (`< md`), falls back to single column via `grid-cols-1 md:grid-cols-2`.

### 4. Agent preview component

A small read-only summary below the agent dropdown, rendered only when an agent is selected. Uses `text-muted-foreground` and compact layout:

```
┌─────────────────────────────────────────┐
│  策略: ReAct  ·  温度: 0.3  ·  上限: 20轮 │
└─────────────────────────────────────────┘
```

Single line of `text-xs` metadata, separated by `·`. Appears/disappears based on selection. No separate card or border — just inline text below the Select.

## Risks / Trade-offs

- **[Agent list stale]** → Agent preview shows data from the cached `fetchAgents` query. If an agent is modified elsewhere, preview is stale until page refresh. Acceptable — same staleness as the dropdown itself. `staleTime` is 30s per project convention.
- **[No model name in preview]** → Users see strategy/temperature/maxTurns but not which LLM model. This is the most useful context we're missing. Mitigation: can be added later by enriching the backend response or adding a model lookup.
- **[Red status without action]** → Showing a red dot for deleted/inactive agents is informative but doesn't offer a fix path. The dropdown already handles this — if agent is gone, selection is empty.
