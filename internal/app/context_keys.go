package app

// contextKey is an unexported type used for context keys to prevent collisions
// with keys defined in other packages.
type contextKey string

// SessionIDKey is the typed context key for passing ai_session_id between packages.
// Used by AI App's CompositeToolExecutor (injection) and ITSM tool handlers (reading).
const SessionIDKey = contextKey("ai_session_id")
