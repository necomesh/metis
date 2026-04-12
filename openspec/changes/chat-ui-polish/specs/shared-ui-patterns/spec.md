## ADDED Requirements

### Requirement: Floating input card pattern
The system SHALL provide a floating input card pattern for full-page input areas. The card SHALL use `shadow-lg rounded-2xl bg-background/95 backdrop-blur` styling with a two-zone layout: content area (textarea/input) on top and a toolbar row on bottom separated by a subtle border.

#### Scenario: Floating input card visual
- **WHEN** the floating input card is rendered
- **THEN** it SHALL have rounded corners (2xl), elevated shadow (lg), and semi-transparent background with backdrop blur

#### Scenario: Toolbar row layout
- **WHEN** the floating input card includes toolbar actions
- **THEN** the toolbar SHALL be separated from the content area by a `border-t border-border/50` line, with left-aligned secondary actions and right-aligned primary actions

### Requirement: Collapsible detail block pattern
The system SHALL provide a collapsible detail block component for progressive disclosure of secondary content (e.g., thinking process, plan steps, tool details). The component SHALL support expanded and collapsed states with smooth height animation, a summary line in collapsed state, and full content in expanded state.

#### Scenario: Collapsed state display
- **WHEN** a collapsible detail block is in collapsed state
- **THEN** it SHALL display a single clickable summary line with a chevron indicator (▸) and optional metadata (e.g., duration)

#### Scenario: Expand on click
- **WHEN** user clicks the collapsed summary line
- **THEN** the block SHALL smoothly expand to reveal full content with the chevron rotating to (▾)

### Requirement: Inline status card pattern
The system SHALL provide an inline status card for displaying contextual messages within content flows (errors, warnings, completion states). The card SHALL support variants: `error` (destructive border + icon), `warning` (amber border + icon), `info` (blue border + icon), and `success` (green border + icon). Each variant MAY include action buttons.

#### Scenario: Error status card with retry
- **WHEN** an inline error status card is rendered with a retry action
- **THEN** it SHALL display a warning icon, error message text, and a "Retry" button within a card with destructive/red left border accent
