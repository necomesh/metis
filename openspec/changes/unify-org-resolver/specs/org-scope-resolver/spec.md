## MODIFIED Requirements

### Requirement: OrgScopeResolver interface in kernel
The system SHALL define a unified `OrgResolver` interface in the kernel App layer (`internal/app/app.go`) that combines the capabilities of the former `OrgScopeResolver`, `OrgUserResolver`, and `ai.OrgResolver` interfaces. The interface SHALL provide:

- `GetUserDeptScope(userID uint, includeSubDepts bool) ([]uint, error)` — for DataScopeMiddleware
- `GetUserPositionIDs(userID uint) ([]uint, error)` — for ITSM participant matching
- `GetUserDepartmentIDs(userID uint) ([]uint, error)` — for ITSM participant matching
- `GetUserPositions(userID uint) ([]OrgPosition, error)` — for AI current_user_profile tool
- `GetUserDepartment(userID uint) (*OrgDepartment, error)` — for AI current_user_profile tool
- `QueryContext(username, deptCode, positionCode string, includeInactive bool) (*OrgContextResult, error)` — for org_context tool

DTO types (`OrgDepartment`, `OrgPosition`, `OrgContextResult`, `OrgContextUser`, `OrgContextDepartment`, `OrgContextPosition`) SHALL be defined in the `app` package.

The `OrgScopeResolver` and `OrgUserResolver` interfaces SHALL be removed. All consumers SHALL reference `app.OrgResolver`.

This interface SHALL be registered in the IOC container by the Org App when installed. When the Org App is not installed, the interface SHALL not be registered and consumers SHALL handle the nil case gracefully.

#### Scenario: OrgResolver registered by Org App
- **WHEN** the system starts with the Org App installed (edition_full)
- **THEN** the IOC container SHALL have a single `OrgResolver` implementation registered that satisfies all 6 methods

#### Scenario: OrgResolver absent without Org App
- **WHEN** the system starts without the Org App (edition_lite or edition_license)
- **THEN** the IOC container SHALL have no `OrgResolver` registered, and DataScopeMiddleware SHALL treat all users as having `ALL` scope

#### Scenario: Org App provides single implementation
- **WHEN** the Org App registers its providers
- **THEN** it SHALL register a single `OrgResolverImpl` as `app.OrgResolver` (replacing the former separate `OrgScopeResolverImpl` and `OrgUserResolverImpl`)

## REMOVED Requirements

### Requirement: Former OrgScopeResolver and OrgUserResolver interfaces
**Reason**: Merged into unified `app.OrgResolver` interface
**Migration**: All consumers change from `app.OrgScopeResolver` or `app.OrgUserResolver` to `app.OrgResolver`. Method signatures are preserved in the unified interface.
