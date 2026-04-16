## Context

The user management service (`internal/service/user.go`) implements business rules such as password policy enforcement, circular manager chain detection, and self-operation guards. Currently there are no service-layer tests. The ITSM module already established a working test pattern using in-memory SQLite with real repository instances.

## Goals / Non-Goals

**Goals:**
- Add comprehensive service-layer tests for `UserService` following the ITSM test pattern.
- Cover all business rules and edge cases without mocking repositories.
- Keep tests fast and deterministic using shared-cache SQLite.

**Non-Goals:**
- Handler-layer tests (out of scope; focus is service layer).
- Repository-layer unit tests with mocked DB.
- Changing any production behavior.

## Decisions

1. **Use in-memory SQLite with shared cache**
   - Rationale: Fast, isolated per test, and matches the existing ITSM test style (`internal/app/itsm/test_helpers_test.go`).
   - Alternative: Dockerized PostgreSQL. Rejected due to overhead and deviation from existing patterns.

2. **Use real repositories instead of mocks**
   - Rationale: `UserService` logic is tightly coupled to GORM behavior (preloads, associations). Real DB tests catch SQL-level issues that mocks hide.
   - Alternative: Mocked repositories. Rejected because the existing codebase prefers integration-style service tests.

3. **Seed minimal data per test**
   - Rationale: Each test creates its own roles/users/configs to stay independent. A small set of test helpers (`newTestDB`, `newUserServiceForTest`, `seedRole`) reduces boilerplate.

4. **Password policy via real SettingsService**
   - Rationale: The user chose option A. `SettingsService` reads from `SystemConfig`; default values mean most tests need no extra seeding. Only password-policy-specific tests insert config rows.

## Risks / Trade-offs

- [Risk] `AutoMigrate` may drift from production schema over time.
  → Mitigation: Only migrate tables directly used by `UserService` (`User`, `Role`, `SystemConfig`, `RefreshToken`).

- [Risk] Tests rely on `token.HashPassword` and `token.ValidatePassword`, which are real implementations.
  → Mitigation: This is acceptable; password hashing is fast enough for test suites.
