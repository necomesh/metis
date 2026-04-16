## Why

The user management service (`internal/service/user.go`) currently has zero test coverage despite containing critical business rules: password policy enforcement, self-operation guards, circular manager chain detection, and token revocation on deactivation/deletion. Adding comprehensive service-layer tests will prevent regressions and make future refactoring safer.

## What Changes

- Add `internal/service/user_test.go` with TDD-style tests for all `UserService` methods.
- Use in-memory SQLite (shared cache) following the existing ITSM test pattern.
- Test real dependencies (`UserRepo`, `RefreshTokenRepo`, `SettingsService`) without mocking.
- Cover business rules: uniqueness, password policy, circular manager chains, self-guards, and token revocation.

## Capabilities

### New Capabilities
- `user-management-service-test`: Comprehensive Go service-layer tests for user management.

### Modified Capabilities
- None (this change adds tests only; no functional requirements are altered).

## Impact

- `internal/service/user_test.go` (new)
- `internal/service/*` (minor test helper additions if needed)
- No API or behavior changes; purely additive test coverage.
