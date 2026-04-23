package scheduler

import (
	"errors"
	"testing"
)

func TestSQLiteBusyRetryRetriesTransientLockErrors(t *testing.T) {
	attempts := 0
	err := withSQLiteBusyRetry(func() error {
		attempts++
		if attempts < 3 {
			return errors.New("database is locked (5) (SQLITE_BUSY)")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("expected retry to succeed, got %v", err)
	}
	if attempts != 3 {
		t.Fatalf("expected 3 attempts, got %d", attempts)
	}
}

func TestSQLiteBusyRetryDoesNotRetryPermanentErrors(t *testing.T) {
	attempts := 0
	want := errors.New("validation failed")
	err := withSQLiteBusyRetry(func() error {
		attempts++
		return want
	})
	if !errors.Is(err, want) {
		t.Fatalf("expected original error, got %v", err)
	}
	if attempts != 1 {
		t.Fatalf("expected 1 attempt, got %d", attempts)
	}
}
