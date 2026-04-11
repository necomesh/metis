# Capability: shared-ui-patterns

## Purpose
Shared frontend UI patterns, reusable hooks, and cross-cutting UI conventions used across multiple pages.

## Requirements

### Requirement: useListPage hook
The system SHALL provide a `useListPage<T>` hook in `hooks/use-list-page.ts` that encapsulates keyword search state, pagination state, and TanStack Query data fetching for paginated list pages.

The hook SHALL accept `queryKey` (string), `endpoint` (string), and optional `pageSize` (number, default 20).

The hook SHALL return: `keyword`, `setKeyword`, `searchKeyword`, `page`, `setPage`, `pageSize`, `totalPages`, `total`, `items` (T[]), `isLoading`, and `handleSearch` (form event handler).

#### Scenario: Users page uses useListPage
- **WHEN** the users page is rendered
- **THEN** it SHALL use `useListPage<User>` instead of inline state + query logic

#### Scenario: Roles page uses useListPage
- **WHEN** the roles page is rendered
- **THEN** it SHALL use `useListPage<Role>` instead of inline state + query logic

### Requirement: Shared SiteInfo type
The system SHALL define the `SiteInfo` interface (`{ appName: string; hasLogo: boolean }`) in `lib/api.ts` and all consumers (`top-nav.tsx`, `settings/index.tsx`) SHALL import from that single location.

#### Scenario: No duplicate SiteInfo definitions
- **WHEN** searching the codebase for `interface SiteInfo`
- **THEN** only one definition SHALL exist in `lib/api.ts`

### Requirement: Improved empty states
Table empty states SHALL display an icon and descriptive text instead of plain text only. The empty state SHALL include a contextual message guiding the user. Empty table state messages (icon + title + description) SHALL use translation keys instead of hardcoded Chinese. Each list page's empty state uses its own namespace (e.g., `t('users.empty.title')`, `t('users.empty.description')`).

#### Scenario: Users table empty state
- **WHEN** the users query returns zero results
- **THEN** the table SHALL show an icon and "暂无用户" message with muted styling

#### Scenario: Config table empty state
- **WHEN** the config query returns zero results
- **THEN** the table SHALL show an icon and "暂无配置项" message with muted styling

#### Scenario: Users empty state in English
- **WHEN** the users page has no data and locale is `en`
- **THEN** the empty state shows "No Users" and "Click 'New User' to add the first user"

#### Scenario: Users empty state in Chinese
- **WHEN** the users page has no data and locale is `zh-CN`
- **THEN** the empty state shows "暂无用户" and "点击「新建用户」添加第一个用户"

### Requirement: Common UI vocabulary namespace
The `common` translation namespace SHALL contain shared UI vocabulary used across multiple pages: button labels (save, cancel, delete, edit, create, search, confirm, close, enable, disable), status words (active, inactive, loading), confirmation dialog text (delete confirmation template), pagination labels, and form validation messages.

#### Scenario: Save button uses common namespace
- **WHEN** any page renders a save button
- **THEN** it uses `t('common:save')` which resolves to "保存" (zh-CN) or "Save" (en)

#### Scenario: Delete confirmation uses common namespace with interpolation
- **WHEN** a delete confirmation dialog shows for user "admin"
- **THEN** it uses `t('common:deleteConfirm', { name: 'admin' })` which resolves to "确定要删除 \"admin\" 吗？此操作不可撤销。" or "Are you sure you want to delete \"admin\"? This action cannot be undone."

### Requirement: Loading and saving state labels are translatable
All loading indicators (e.g., "保存中...", "加载中...", "删除中...", "登录中...") SHALL use translation keys from the `common` namespace.

#### Scenario: Saving state in English
- **WHEN** a form is submitting and locale is `en`
- **THEN** the button shows "Saving..." instead of "保存中..."

### Requirement: DataTable pagination visual style
The DataTablePagination component SHALL use clean styling without dashed borders.

#### Scenario: Pagination without dashed border
- **WHEN** a paginated table has more than one page
- **THEN** the pagination area SHALL render with `pt-4` top padding and no border
- **AND** background SHALL be transparent (no `bg-muted/10`)
