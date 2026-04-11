# Capability: install-wizard-ui

## Purpose
Provides the browser-based install wizard frontend. Guides users through database selection, site configuration, and admin account creation on first run. Uses the same visual language as the login page (AuthShell layout).

## Requirements

### Requirement: Install wizard page route
The frontend SHALL provide an `/install` route that displays the installation wizard. This route SHALL be accessible without authentication.

#### Scenario: Navigate to install page
- **WHEN** a user opens the application and the system is not installed
- **THEN** the browser SHALL display the installation wizard at `/install`

#### Scenario: Redirect to install when not installed
- **WHEN** a user navigates to any route (e.g., `/login`, `/users`) and the system is not installed
- **THEN** the frontend SHALL redirect to `/install`

#### Scenario: Redirect to login when already installed
- **WHEN** a user navigates to `/install` and the system is already installed
- **THEN** the frontend SHALL redirect to `/login`

### Requirement: Database selection step
The install wizard SHALL display a database selection step, allowing the user to choose between SQLite (default) and PostgreSQL.

#### Scenario: SQLite selected (default)
- **WHEN** the user selects SQLite (pre-selected by default)
- **THEN** the wizard SHALL proceed to the site information step, skipping database configuration details

#### Scenario: PostgreSQL selected
- **WHEN** the user selects PostgreSQL
- **THEN** the wizard SHALL display input fields for: host (default "localhost"), port (default 5432), username, password, database name

#### Scenario: Test PostgreSQL connection
- **WHEN** the user fills in PostgreSQL connection details and clicks "测试连接"
- **THEN** the frontend SHALL call `POST /api/v1/install/check-db` and display success or error feedback

#### Scenario: PostgreSQL connection test required
- **WHEN** the user selects PostgreSQL and clicks "下一步" without a successful connection test
- **THEN** the wizard SHALL block progression and prompt the user to test the connection first

### Requirement: Site information step
The install wizard SHALL display a site information step with a site name field.

#### Scenario: Enter site name
- **WHEN** the site information step is displayed
- **THEN** the user SHALL see an input field for site name with a default value of "Metis"

### Requirement: Admin account step
The install wizard SHALL display an admin account creation step with username, password, and email fields.

#### Scenario: Fill admin credentials
- **WHEN** the admin account step is displayed
- **THEN** the user SHALL see fields for: username (required), password (required, min 8 chars), confirm password (required), email (required, valid email format)

#### Scenario: Password mismatch validation
- **WHEN** the user enters mismatched passwords
- **THEN** the wizard SHALL display an inline validation error

#### Scenario: Weak password validation
- **WHEN** the user enters a password shorter than 8 characters
- **THEN** the wizard SHALL display an inline validation error

### Requirement: Execute installation
The install wizard SHALL submit all collected data to execute the installation.

#### Scenario: Successful installation
- **WHEN** the user clicks "开始安装" on the final step
- **THEN** the frontend SHALL call `POST /api/v1/install/execute` with all form data, display a loading state, and on success show a completion page with a "进入系统" button that navigates to `/login`

#### Scenario: Installation failure
- **WHEN** the installation API returns an error
- **THEN** the wizard SHALL display the error message and allow the user to go back and fix the issue

### Requirement: Visual design consistency
The install wizard SHALL use the same visual language as the login page -- AuthShell layout with gradient background, glass-morphism card, and the application's OKLCH color system.

#### Scenario: Wizard appearance
- **WHEN** the install wizard is displayed
- **THEN** it SHALL use the AuthShell gradient background with a centered glass-morphism card containing a step indicator and form content

#### Scenario: Step indicator shows 5 steps
- **WHEN** the install wizard loads
- **THEN** the step indicator shows 5 steps: Language, Database, Site Info, Admin, Complete

#### Scenario: Language step is first and active on initial load
- **WHEN** the user opens `/install` for the first time
- **THEN** the first step "Language & Timezone" is active

#### Scenario: Step indicator
- **WHEN** the wizard is on any step
- **THEN** a horizontal step indicator SHALL show all steps with the current step highlighted using the primary color, completed steps with a checkmark, and future steps in muted color. Step labels MUST be translated using the active locale.

### Requirement: Language and timezone selection step
The install wizard SHALL have a first step for selecting the system language and timezone. This step is purely frontend -- it does not require database connectivity. The language selector MUST list all supported locales with their native names (e.g., "简体中文", "English"). The timezone selector MUST default to the browser's detected timezone and allow selection from a list of IANA timezones grouped by region.

#### Scenario: Language selection changes wizard language
- **WHEN** the user selects "English" in the language step
- **THEN** all subsequent wizard steps display in English immediately

#### Scenario: Timezone defaults to browser timezone
- **WHEN** the language step loads and the browser reports `Asia/Shanghai`
- **THEN** the timezone selector defaults to `Asia/Shanghai`

#### Scenario: Proceed to database step
- **WHEN** the user clicks "Next" on the language step
- **THEN** the wizard advances to the database selection step with the chosen language active

### Requirement: All install wizard text is translatable
All user-facing text in the install wizard (labels, placeholders, helper text, error messages, button text) SHALL use i18n translation keys from the `install` namespace. No hardcoded Chinese or English text in the install wizard components.

#### Scenario: Database step displays in selected language
- **WHEN** the user selected "English" in step 1 and is on the database step
- **THEN** "SQLite" description shows "Zero-config, suitable for small deployments" instead of "零配置，适合小型部署"
