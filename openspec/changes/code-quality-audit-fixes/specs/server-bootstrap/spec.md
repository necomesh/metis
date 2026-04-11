## MODIFIED Requirements

### Requirement: samber/do IOC container
The system SHALL use samber/do v2 as the dependency injection container for managing service lifecycle. Kernel provider registration (repositories, services, handlers, scheduler) SHALL be defined in a single shared function `registerKernelProviders()` in `cmd/server/providers.go`. Both normal-mode startup (`main.go`) and install hot-switch (`install.go:hotSwitch`) SHALL call this shared function, eliminating duplication. The function SHALL accept a registration function parameter (`func(do.Injector, ...)`) to support both `do.Provide` (normal mode) and `do.Override` (hot-switch mode).

#### Scenario: Service registration in normal mode
- **WHEN** the application starts and the system is installed
- **THEN** `main.go` SHALL call `registerKernelProviders()` with `do.Provide` semantics, registering all kernel services followed by each registered App's providers, all resolved lazily on first use

#### Scenario: Service registration in install mode
- **WHEN** the application starts and the system is not installed
- **THEN** only database.DB, SysConfigRepo, SysConfigService, and InstallHandler SHALL be registered. No auth, casbin, scheduler, or business handlers SHALL be registered.

#### Scenario: Hot switch after installation
- **WHEN** the install handler completes installation successfully
- **THEN** it SHALL call `registerKernelProviders()` with `do.Override` semantics, then run app seeds, register all routes, and start the scheduler engine

#### Scenario: App provider registration
- **WHEN** optional Apps are registered in the global registry
- **THEN** main.go SHALL call `a.Providers(injector)` for each App, allowing App services to reference kernel services via `do.MustInvoke`

### Requirement: Gin engine with standard middleware
The system SHALL initialize a Gin engine with slog-based request logging and panic recovery middleware. In **install mode**, only install-related routes and SPA static assets SHALL be registered. In **normal mode**, the full route tree (public + authenticated groups) SHALL be registered as before.

#### Scenario: Request logging
- **WHEN** any HTTP request is processed
- **THEN** the middleware SHALL log method, path, status code, and latency using slog

#### Scenario: Panic recovery
- **WHEN** a handler panics during request processing
- **THEN** the middleware SHALL recover, log the error, and return a 500 response using the unified response format `{"code":-1,"message":"internal server error"}` (the `handler.R` struct)

#### Scenario: Install mode routes
- **WHEN** the system is in install mode
- **THEN** the Gin engine SHALL only register `/api/v1/install/*` routes and SPA static asset serving. No JWT, Casbin, or business routes SHALL be registered.

#### Scenario: Normal mode routes
- **WHEN** the system is in normal mode
- **THEN** the system SHALL organize routes into public and authenticated groups with JWTAuth + CasbinAuth middleware, and call `a.Routes(apiGroup)` for each App
