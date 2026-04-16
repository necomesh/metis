## Why

ITSM 服务目录后端已经具备基础的分类树、服务定义和种子数据实现，但当前实现与既有 `itsm-service-catalog` 规格之间仍存在若干行为缺口，尤其集中在更新校验、唯一性冲突返回码和服务定义过滤/引擎约束上。需要先把这些后端契约补齐，并用可回归的测试覆盖锁住行为，避免后续 ITSM 功能继续建立在不稳定的基础上。

## What Changes

- 补齐服务目录分类在更新路径上的后端业务校验，包括父分类存在性、两层树限制和非法父子关系保护。
- 统一服务目录分类与服务定义的唯一编码冲突行为，确保创建/更新重复 `code` 时返回 `409 Conflict`。
- 补齐服务定义列表过滤与引擎配置约束，使其与现有规格中的 `catalog_id`、`engine_type`、经典/智能字段限制保持一致。
- 为服务目录分类、服务定义与相关 seed 逻辑新增后端测试，优先覆盖业务规则、HTTP 契约与幂等行为。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `itsm-service-catalog`: 明确并落实服务目录分类更新约束、编码冲突返回码、服务定义过滤条件、引擎字段校验以及后端测试覆盖要求。

## Impact

- Affected code:
  - `internal/app/itsm/catalog_handler.go`
  - `internal/app/itsm/catalog_service.go`
  - `internal/app/itsm/catalog_repository.go`
  - `internal/app/itsm/service_def_handler.go`
  - `internal/app/itsm/service_def_service.go`
  - `internal/app/itsm/service_def_repository.go`
  - `internal/app/itsm/seed.go`
- Affected behavior:
  - `POST/PUT /api/v1/itsm/catalogs`
  - `POST/PUT/GET /api/v1/itsm/services`
  - ITSM catalog/service seed execution behavior
- Testing impact:
  - Add backend unit/integration-style tests for service, handler and seed paths under `internal/app/itsm/`
