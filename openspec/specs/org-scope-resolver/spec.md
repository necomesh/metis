# Capability: org-scope-resolver

## Purpose
TBD

## Requirements

### Requirement: OrgScopeResolver interface in kernel
The system SHALL define a unified `OrgResolver` interface in the kernel App layer (`internal/app/`) that covers all organisation-related queries: DataScope filtering, participant ID matching, rich context queries, **and participant resolution by organisational criteria**. This interface SHALL be registered in the IOC container by the Org App when installed. When the Org App is not installed, the interface SHALL not be registered and all consumers SHALL handle the nil case gracefully.

The interface SHALL include the following methods:

**DataScope (existing):**
- `GetUserDeptScope(userID uint, includeSubDepts bool) ([]uint, error)`

**ID mapping (existing):**
- `GetUserPositionIDs(userID uint) ([]uint, error)`
- `GetUserDepartmentIDs(userID uint) ([]uint, error)`

**Rich context (existing):**
- `GetUserPositions(userID uint) ([]OrgPosition, error)`
- `GetUserDepartment(userID uint) (*OrgDepartment, error)`
- `QueryContext(username, deptCode, positionCode string, includeInactive bool) (*OrgContextResult, error)`

**Participant resolution (new):**
- `FindUsersByPositionCode(posCode string) ([]uint, error)`
- `FindUsersByDepartmentCode(deptCode string) ([]uint, error)`
- `FindUsersByPositionAndDepartment(posCode, deptCode string) ([]uint, error)`
- `FindUsersByPositionID(positionID uint) ([]uint, error)`
- `FindUsersByDepartmentID(departmentID uint) ([]uint, error)`
- `FindManagerByUserID(userID uint) (uint, error)`

#### Scenario: OrgResolver registered by Org App
- **WHEN** the system starts with the Org App installed (edition_full)
- **THEN** the IOC container SHALL have an `OrgResolver` implementation registered, and all methods SHALL be functional

#### Scenario: OrgResolver absent without Org App
- **WHEN** the system starts without the Org App (edition_lite or edition_license)
- **THEN** the IOC container SHALL have no `OrgResolver` registered, and all consumers (DataScopeMiddleware, ParticipantResolver, AI tools, ITSM Operator) SHALL handle the nil case gracefully

### Requirement: DataScopeMiddleware
The system SHALL provide a `DataScopeMiddleware` in `internal/middleware/` that resolves the current user's department scope and injects it into the Gin request context as `deptScope` (type `[]uint` or nil).

The middleware SHALL operate as follows:
- If `OrgScopeResolver` is nil → set `deptScope = nil` (no filtering)
- If `role.dataScope == "all"` → set `deptScope = nil`
- If `role.dataScope == "self"` → set `deptScope = []uint{}` (empty, only own records)
- If `role.dataScope == "dept"` → call `OrgScopeResolver.GetUserDeptScope` with depth=1 only
- If `role.dataScope == "dept_and_sub"` → call `OrgScopeResolver.GetUserDeptScope` (full BFS)
- If `role.dataScope == "custom"` → query `role_dept_scopes` for configured department IDs

The middleware SHALL be placed after `CasbinAuth` in the middleware chain.

#### Scenario: ALL scope injects nil
- **WHEN** a user with a role of dataScope `all` makes any API request
- **THEN** the Gin context SHALL have `deptScope = nil`, and repository queries SHALL NOT add any department filter

#### Scenario: DEPT_AND_SUB scope resolves departments
- **WHEN** a user assigned to department ID 5 (which has sub-departments 8, 9) with dataScope `dept_and_sub` makes an API request
- **THEN** the Gin context SHALL have `deptScope = [5, 8, 9]`

#### Scenario: SELF scope injects empty slice
- **WHEN** a user with dataScope `self` makes an API request
- **THEN** the Gin context SHALL have `deptScope = []uint{}` (empty slice, distinct from nil)

#### Scenario: Middleware is nil-safe without Org App
- **WHEN** the Org App is not installed and a user makes any API request
- **THEN** the middleware SHALL set `deptScope = nil` and proceed without error

### Requirement: ListParams DeptScope field
The system SHALL add a `DeptScope *[]uint` field to the shared `ListParams` struct in the repository layer. When `DeptScope` is non-nil, repository List methods SHALL add `WHERE department_id IN (?)` filter. When `DeptScope` is nil, no filter SHALL be applied.

#### Scenario: Nil DeptScope returns all records
- **WHEN** a List query is executed with `DeptScope = nil`
- **THEN** the query SHALL return all records regardless of department

#### Scenario: Non-nil DeptScope filters by department
- **WHEN** a List query is executed with `DeptScope = &[]uint{3, 7}`
- **THEN** the query SHALL only return records where `department_id IN (3, 7)`

#### Scenario: Empty DeptScope returns only own records
- **WHEN** a List query is executed with `DeptScope = &[]uint{}` and `userID` provided
- **THEN** the query SHALL only return records where `created_by = userID` or `owner_id = userID`

### Requirement: FindUsersByPositionCode returns active users at a position
The system SHALL return IDs of all active users assigned to a position identified by its code. Only users with `is_active=true` SHALL be included.

#### Scenario: Active users found at position
- **WHEN** `FindUsersByPositionCode("network_admin")` is called and 2 active users hold that position
- **THEN** the method SHALL return `[]uint{userId1, userId2}`

#### Scenario: No active users at position
- **WHEN** `FindUsersByPositionCode("deprecated_role")` is called and no active users hold it
- **THEN** the method SHALL return an empty slice `[]uint{}`

#### Scenario: Position code does not exist
- **WHEN** `FindUsersByPositionCode("nonexistent")` is called
- **THEN** the method SHALL return an empty slice (not an error)

### Requirement: FindUsersByDepartmentCode returns active users in a department
The system SHALL return IDs of all active users assigned to a department identified by its code.

#### Scenario: Active users found in department
- **WHEN** `FindUsersByDepartmentCode("IT")` is called and 5 active users belong to that department
- **THEN** the method SHALL return their user IDs

#### Scenario: No active users in department
- **WHEN** `FindUsersByDepartmentCode("empty_dept")` is called
- **THEN** the method SHALL return an empty slice

### Requirement: FindUsersByPositionAndDepartment returns intersection
The system SHALL return IDs of active users who hold a specific position within a specific department. This is the intersection: users who have a `user_positions` record matching both the position code AND department code.

#### Scenario: Users at position in department
- **WHEN** `FindUsersByPositionAndDepartment("network_admin", "IT")` is called
- **THEN** the method SHALL return only users who hold position "network_admin" in department "IT"

#### Scenario: No users at intersection
- **WHEN** `FindUsersByPositionAndDepartment("ceo", "IT")` is called and no one holds CEO in IT department
- **THEN** the method SHALL return an empty slice

### Requirement: FindUsersByPositionID and FindUsersByDepartmentID
The system SHALL provide ID-based lookups equivalent to the code-based methods, for use by `ParticipantResolver` which receives numeric IDs from workflow configurations.

#### Scenario: Find users by position ID
- **WHEN** `FindUsersByPositionID(42)` is called
- **THEN** the method SHALL return active user IDs where `user_positions.position_id = 42`

#### Scenario: Find users by department ID
- **WHEN** `FindUsersByDepartmentID(7)` is called
- **THEN** the method SHALL return active user IDs where `user_positions.department_id = 7`

### Requirement: FindManagerByUserID
The system SHALL return the manager's user ID for a given user. The manager relationship is stored in `users.manager_id`.

#### Scenario: User has a manager
- **WHEN** `FindManagerByUserID(10)` is called and user 10 has `manager_id=3`
- **THEN** the method SHALL return `3, nil`

#### Scenario: User has no manager
- **WHEN** `FindManagerByUserID(10)` is called and user 10 has `manager_id=nil`
- **THEN** the method SHALL return `0, nil`

#### Scenario: User does not exist
- **WHEN** `FindManagerByUserID(9999)` is called and no such user exists
- **THEN** the method SHALL return an error
