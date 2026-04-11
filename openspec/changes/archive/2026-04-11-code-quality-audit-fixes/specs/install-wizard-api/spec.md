## MODIFIED Requirements

### Requirement: Execute installation endpoint
The system SHALL provide `POST /api/v1/install/execute` that performs the full installation. This endpoint SHALL only be available when the system is not installed. Admin user creation SHALL use the kernel `UserService.Create` method (after kernel providers are registered via hot-switch) to ensure consistent password hashing, `PasswordChangedAt` initialization, and password policy validation.

#### Scenario: SQLite installation
- **WHEN** `POST /api/v1/install/execute` is called with `{"db_driver":"sqlite","site_name":"My Metis","admin_username":"admin","admin_password":"Pass1234","admin_email":"admin@example.com"}`
- **THEN** the system SHALL:
  1. Generate `jwt_secret` and `license_key_secret` (64-char hex each)
  2. Write `metis.yaml` with SQLite defaults and generated secrets
  3. Run AutoMigrate for all kernel + app models
  4. Run `seed.Install()` (roles, menus, policies, default configs)
  5. Register kernel providers via `registerKernelProviders()` (hot-switch)
  6. Create the admin user via `UserService.Create` with the provided credentials
  7. Set `app.installed=true` in SystemConfig
  8. Initialize remaining business services and routes
  9. Return `{"code":0,"message":"ok"}`

#### Scenario: PostgreSQL installation
- **WHEN** `POST /api/v1/install/execute` is called with PostgreSQL connection parameters
- **THEN** the system SHALL compose the PostgreSQL DSN, then follow the same steps as SQLite installation

#### Scenario: Installation with password validation
- **WHEN** `POST /api/v1/install/execute` is called with admin_password shorter than 8 characters
- **THEN** the system SHALL return HTTP 400 with a validation error message

#### Scenario: Endpoint blocked after installation
- **WHEN** `POST /api/v1/install/execute` is called after the system is installed
- **THEN** the system SHALL return HTTP 403

#### Scenario: Installation failure rollback
- **WHEN** installation fails at any step (DB migration, seed, admin creation)
- **THEN** the system SHALL return an error response with details and NOT set `app.installed=true`
