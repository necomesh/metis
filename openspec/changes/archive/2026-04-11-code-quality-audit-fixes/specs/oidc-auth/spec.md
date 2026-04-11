## MODIFIED Requirements

### Requirement: OIDC callback processing
The App SHALL provide `POST /api/v1/auth/sso/callback` accepting `{code, state}` that completes the OIDC flow and performs JIT user provisioning. The callback handler SHALL delegate user provisioning to the kernel `AuthService.ProvisionExternalUser` method instead of implementing provisioning logic directly. The handler SHALL NOT hold references to UserRepo, UserConnectionRepo, or RoleRepo.

#### Scenario: Successful OIDC callback (new user)
- **WHEN** POST /api/v1/auth/sso/callback with valid code/state, no existing local account
- **THEN** SHALL exchange code for tokens, validate ID token via JWKS, extract claims, call `AuthService.ProvisionExternalUser` with provider="oidc_{sourceId}", then call `AuthService.GenerateTokenPair` and return the TokenPair

#### Scenario: Successful OIDC callback (existing user, link strategy)
- **WHEN** OIDC user's email matches existing local user and conflict strategy is "link"
- **THEN** SHALL call `AuthService.ProvisionExternalUser` which links the identity to the existing user, then return a TokenPair

#### Scenario: Email conflict with "fail" strategy
- **WHEN** OIDC user's email matches existing local user and conflict strategy is "fail"
- **THEN** SHALL return 409 "email already registered"

#### Scenario: Returning OIDC user
- **WHEN** OIDC user has previously logged in via this source
- **THEN** SHALL find existing user via `AuthService.ProvisionExternalUser`, update attributes if changed, return TokenPair

#### Scenario: Invalid state token
- **WHEN** POST /api/v1/auth/sso/callback with invalid/expired state
- **THEN** SHALL return 400 "invalid or expired state"

#### Scenario: Identity source not found error handling
- **WHEN** the identity source ID does not exist in the database
- **THEN** the Service layer SHALL translate the database error to a domain sentinel error, and the Handler SHALL use `errors.Is()` to match it (SHALL NOT check `gorm.ErrRecordNotFound` directly)
