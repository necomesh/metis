## 1. Catalog backend rules

- [x] 1.1 Add catalog service validation for update-time parent changes, including missing parent, two-level limit, self-parent, and descendant-cycle rejection.
- [x] 1.2 Normalize duplicate catalog `code` conflicts into a stable domain error and return `409 Conflict` from catalog create/update handlers.
- [x] 1.3 Keep catalog delete and tree behavior aligned with the existing spec while preserving current sort-order semantics.

## 2. Service definition backend rules

- [x] 2.1 Add service definition validation for referenced `catalog_id` existence during create/update.
- [x] 2.2 Extend service definition list filtering to support `engineType` alongside existing catalog, keyword, and active-state filters.
- [x] 2.3 Enforce classic-vs-smart field constraints in service definition create/update flows and map duplicate `code` conflicts to `409 Conflict` consistently.

## 3. Backend test coverage

- [x] 3.1 Add catalog service tests covering create, update parent validation, delete protection, and tree ordering.
- [x] 3.2 Add catalog and service definition handler tests covering key HTTP contracts, especially `400`, `404`, and `409` responses.
- [x] 3.3 Add seed tests covering initial catalog creation, idempotent re-run behavior, and recreation after soft delete.

## 4. Verification

- [x] 4.1 Run focused Go tests for `internal/app/itsm` and fix any failures.
- [x] 4.2 Run a broader regression command for affected backend packages and confirm the final output is clean.
