## Purpose

Define the service-layer test coverage requirements for user management in Metis.

## Requirements

### Requirement: Test user creation
The user service test suite SHALL verify that user creation succeeds with valid input and rejects duplicates or weak passwords.

#### Scenario: Create user successfully
- **WHEN** `Create` is called with a unique username, valid password, email, phone, and role ID
- **THEN** it returns a user with `IsActive=true`, a hashed password, and `PasswordChangedAt` set

#### Scenario: Reject duplicate username
- **WHEN** `Create` is called with a username that already exists
- **THEN** it returns `ErrUsernameExists`

#### Scenario: Enforce password policy
- **WHEN** `Create` is called with a password shorter than the configured minimum length
- **THEN** it returns `ErrPasswordViolation`

### Requirement: Test user retrieval
The test suite SHALL verify that users can be retrieved by ID, with or without manager preload, and that missing users return `ErrUserNotFound`.

#### Scenario: Get user by ID successfully
- **WHEN** `GetByID` is called with an existing user ID
- **THEN** it returns the user with the `Role` preloaded

#### Scenario: Get user by ID returns not found
- **WHEN** `GetByID` is called with a non-existent user ID
- **THEN** it returns `ErrUserNotFound`

#### Scenario: Get user with manager
- **WHEN** `GetByIDWithManager` is called for a user who has a manager
- **THEN** it returns the user with `Manager` preloaded

### Requirement: Test user update
The test suite SHALL verify that updates apply allowed fields and guard against self-role changes and circular manager chains.

#### Scenario: Update user successfully
- **WHEN** `Update` is called with new email, phone, and manager ID for another user
- **THEN** it returns the updated user with the new values persisted

#### Scenario: Prevent self role change
- **WHEN** `Update` is called by a user on their own record with a new `RoleID`
- **THEN** it returns `ErrCannotSelf`

#### Scenario: Detect direct circular manager
- **WHEN** `Update` sets a user's `ManagerID` to their own ID
- **THEN** it returns `ErrCircularManagerChain`

#### Scenario: Detect indirect circular manager
- **WHEN** `Update` creates a manager chain loop (A manages B, B manages C, C attempts to manage A)
- **THEN** it returns `ErrCircularManagerChain`

### Requirement: Test user deletion
The test suite SHALL verify that deletion removes the user and revokes refresh tokens, while preventing self-deletion.

#### Scenario: Delete user successfully
- **WHEN** `Delete` is called for an existing user who is not the current user
- **THEN** the user is removed and all refresh tokens for that user are revoked

#### Scenario: Prevent self deletion
- **WHEN** `Delete` is called with the current user's own ID
- **THEN** it returns `ErrCannotSelf`

#### Scenario: Delete returns not found
- **WHEN** `Delete` is called for a non-existent user
- **THEN** it returns `ErrUserNotFound`

### Requirement: Test password reset
The test suite SHALL verify that password reset updates the password, clears `ForcePasswordReset`, revokes tokens, and enforces policy.

#### Scenario: Reset password successfully
- **WHEN** `ResetPassword` is called with a valid new password for an existing user
- **THEN** the password is hashed, `ForcePasswordReset` becomes false, and refresh tokens are revoked

#### Scenario: Reset password enforces policy
- **WHEN** `ResetPassword` is called with a password that violates the configured policy
- **THEN** it returns `ErrPasswordViolation`

#### Scenario: Reset password returns not found
- **WHEN** `ResetPassword` is called for a non-existent user
- **THEN** it returns `ErrUserNotFound`

### Requirement: Test activation and deactivation
The test suite SHALL verify that activation and deactivation work correctly and guard against self-deactivation.

#### Scenario: Activate user
- **WHEN** `Activate` is called for an inactive existing user
- **THEN** it returns the user with `IsActive=true`

#### Scenario: Deactivate user
- **WHEN** `Deactivate` is called for an active existing user who is not the current user
- **THEN** it returns the user with `IsActive=false` and refresh tokens are revoked

#### Scenario: Prevent self deactivation
- **WHEN** `Deactivate` is called with the current user's own ID
- **THEN** it returns `ErrCannotSelf`

### Requirement: Test user unlock
The test suite SHALL verify that unlocking resets failed login attempts and lock status.

#### Scenario: Unlock user
- **WHEN** `UnlockUser` is called for a locked existing user
- **THEN** `FailedLoginAttempts` becomes 0 and `LockedUntil` becomes nil

#### Scenario: Unlock returns not found
- **WHEN** `UnlockUser` is called for a non-existent user
- **THEN** it returns `ErrUserNotFound`

### Requirement: Test manager chain queries
The test suite SHALL verify that manager chains are returned in order and safely handle cycles or excessive depth.

#### Scenario: Get manager chain
- **WHEN** `GetManagerChain` is called for a user with a manager hierarchy 3 levels deep
- **THEN** it returns the ordered list of managers from direct manager up to root

#### Scenario: Manager chain breaks on cycle
- **WHEN** `GetManagerChain` is called for a user whose manager chain contains a cycle
- **THEN** it returns the chain accumulated before the cycle without panicking

#### Scenario: Manager chain respects max depth
- **WHEN** `GetManagerChain` is called for a user whose manager chain exceeds 10 levels
- **THEN** it returns at most 10 managers

### Requirement: Test clearing manager
The test suite SHALL verify that clearing a manager sets `ManagerID` to nil.

#### Scenario: Clear manager successfully
- **WHEN** `ClearManager` is called for a user who has a manager
- **THEN** it returns the user with `ManagerID` set to nil

#### Scenario: Clear manager returns not found
- **WHEN** `ClearManager` is called for a non-existent user
- **THEN** it returns `ErrUserNotFound`
