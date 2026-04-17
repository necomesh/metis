package identity

import (
	"testing"
	"time"
)

func TestSSOStateManager_Generate(t *testing.T) {
	sm := NewSSOStateManager()
	state, err := sm.Generate(1, "verifier")
	if err != nil {
		t.Fatalf("generate failed: %v", err)
	}
	if state == "" {
		t.Fatal("expected non-empty state")
	}
}

func TestSSOStateManager_Validate(t *testing.T) {
	sm := NewSSOStateManager()
	state, err := sm.Generate(42, "pkce-verifier")
	if err != nil {
		t.Fatalf("generate failed: %v", err)
	}

	meta, err := sm.Validate(state)
	if err != nil {
		t.Fatalf("validate failed: %v", err)
	}
	if meta.SourceID != 42 {
		t.Fatalf("expected sourceID 42, got %d", meta.SourceID)
	}
	if meta.CodeVerifier != "pkce-verifier" {
		t.Fatalf("expected code verifier, got %s", meta.CodeVerifier)
	}
}

func TestSSOStateManager_Validate_DoubleUse(t *testing.T) {
	sm := NewSSOStateManager()
	state, _ := sm.Generate(1, "")

	_, err := sm.Validate(state)
	if err != nil {
		t.Fatalf("first validate should succeed: %v", err)
	}

	_, err = sm.Validate(state)
	if err == nil {
		t.Fatal("expected error on second validate")
	}
}

func TestSSOStateManager_Validate_Expired(t *testing.T) {
	now := time.Now()
	sm := &SSOStateManager{
		done:  make(chan struct{}),
		nowFn: func() time.Time { return now },
	}
	state, _ := sm.Generate(1, "")

	// Advance time past TTL
	sm.nowFn = func() time.Time { return now.Add(ssoStateTTL + time.Second) }

	_, err := sm.Validate(state)
	if err == nil {
		t.Fatal("expected error for expired state")
	}
}
