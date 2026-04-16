## MODIFIED Requirements

### Requirement: 服务目录树形分类管理

系统 SHALL 提供服务目录（ServiceCatalog）实体，支持树形分类结构。字段包括：name（名称）、code（唯一编码）、description（描述）、parent_id（父分类 ID，自关联，顶层为 null）、sort_order（排序）、icon（图标）、is_active（是否启用）。内嵌 BaseModel 提供 ID + 时间戳 + 软删除。

创建和编辑分类时，表单 SHALL 包含 code 字段供用户输入。

后端 SHALL 在创建和更新分类时同时执行树形结构校验，拒绝不存在的父分类、超过两层的层级关系以及会导致自引用或祖先/后代环的父子关系变更。创建或更新时若 `code` 与现有分类重复，系统 SHALL 返回 `409 Conflict`。

#### Scenario: 创建顶层分类
- **WHEN** 管理员请求 `POST /api/v1/itsm/catalogs` 并传入 name、code，parent_id 为空
- **THEN** 系统 SHALL 创建一个顶层服务分类并返回完整记录（含 code 字段）

#### Scenario: 创建子分类
- **WHEN** 管理员请求 `POST /api/v1/itsm/catalogs` 并传入有效的 parent_id 和 code
- **THEN** 系统 SHALL 创建子分类，parent_id 指向已有的父分类

#### Scenario: 编码唯一性校验
- **WHEN** 管理员创建或更新分类时使用已存在的 code
- **THEN** 系统 SHALL 返回 409 冲突错误

#### Scenario: 查询分类树
- **WHEN** 用户请求 `GET /api/v1/itsm/catalogs/tree`
- **THEN** 系统 SHALL 返回完整的树形分类结构，每个节点包含 children 数组，Response 包含 code 字段

#### Scenario: 删除含子分类的目录
- **WHEN** 管理员删除一个含有子分类的目录
- **THEN** 系统 SHALL 返回 400 错误，提示需先删除或移动子分类

#### Scenario: 删除含服务定义的目录
- **WHEN** 管理员删除一个已绑定服务定义的目录
- **THEN** 系统 SHALL 返回 400 错误，提示需先解除服务绑定

#### Scenario: 分类排序
- **WHEN** 管理员修改分类的 sort_order
- **THEN** 同层级分类按 sort_order 升序排列

#### Scenario: 创建分类限制两层
- **WHEN** 管理员请求创建分类时传入的 parent_id 指向一个已有 parent 的分类（即尝试创建第三层）
- **THEN** 系统 SHALL 返回 400 错误，提示服务目录最多支持两层

#### Scenario: 更新分类时父分类不存在
- **WHEN** 管理员请求 `PUT /api/v1/itsm/catalogs/:id` 且传入不存在的 parent_id
- **THEN** 系统 SHALL 返回 400 错误，并拒绝保存该更新

#### Scenario: 更新分类时禁止自引用
- **WHEN** 管理员请求 `PUT /api/v1/itsm/catalogs/:id` 并将 parent_id 设置为当前分类自身 ID
- **THEN** 系统 SHALL 返回 400 错误，并拒绝保存该更新

#### Scenario: 更新分类时禁止形成循环层级
- **WHEN** 管理员请求 `PUT /api/v1/itsm/catalogs/:id` 并将 parent_id 设置为该分类后代节点的 ID
- **THEN** 系统 SHALL 返回 400 错误，并拒绝保存该更新

### Requirement: 服务定义管理

系统 SHALL 提供服务定义（ServiceDefinition）实体，代表一个可请求的 IT 服务。字段包括：name（名称）、code（唯一编码）、description（描述）、catalog_id（所属分类 FK）、engine_type（引擎类型："classic" | "smart"）、sla_id（FK→SLATemplate，可选）、form_schema（JSON，提单表单定义）、workflow_json（JSON，经典模式工作流定义）、collaboration_spec（文本，智能模式协作规范）、agent_id（uint，智能模式关联的 Agent ID）、knowledge_base_ids（JSON 数组，智能模式关联的知识库）、agent_config（JSON，智能模式配置如信心阈值）、is_active（是否启用）、sort_order，嵌入 BaseModel。

后端 SHALL 在创建和更新服务定义时校验 `catalog_id` 引用的服务目录分类存在。创建或更新时若 `code` 与现有服务定义重复，系统 SHALL 返回 `409 Conflict`。`GET /api/v1/itsm/services` SHALL 支持 `catalog_id`、`engine_type`、`is_active`、`keyword` 过滤参数的组合查询。

#### Scenario: 创建经典服务定义
- **WHEN** 管理员请求 `POST /api/v1/itsm/services` 并传入 engine_type 为 "classic"
- **THEN** 系统 SHALL 创建服务定义，并要求后续配置 workflow_json 和 form_schema

#### Scenario: 创建智能服务定义
- **WHEN** 管理员请求 `POST /api/v1/itsm/services` 并传入 engine_type 为 "smart"
- **THEN** 系统 SHALL 创建服务定义，并要求后续配置 collaboration_spec 和 agent_id

#### Scenario: 服务编码唯一性
- **WHEN** 管理员创建服务定义时使用已存在的 code
- **THEN** 系统 SHALL 返回 409 冲突错误

#### Scenario: 服务列表查询
- **WHEN** 用户请求 `GET /api/v1/itsm/services` 并可选传入 catalog_id、engine_type、is_active、keyword 过滤参数
- **THEN** 系统 SHALL 返回分页的服务定义列表

#### Scenario: 服务详情查询
- **WHEN** 用户请求 `GET /api/v1/itsm/services/:id`
- **THEN** 系统 SHALL 返回服务定义完整信息，包括分类信息和引擎配置

#### Scenario: 启用/禁用服务
- **WHEN** 管理员修改服务的 is_active 状态
- **THEN** 禁用的服务不出现在用户提单的服务目录中

#### Scenario: 创建服务时分类不存在
- **WHEN** 管理员请求 `POST /api/v1/itsm/services` 且 `catalog_id` 引用不存在的分类
- **THEN** 系统 SHALL 返回 400 错误，并拒绝创建服务定义

#### Scenario: 列表按引擎类型过滤
- **WHEN** 用户请求 `GET /api/v1/itsm/services?engineType=smart`
- **THEN** 系统 SHALL 仅返回 `engine_type` 为 `smart` 的服务定义

### Requirement: 经典服务引擎配置

engine_type 为 "classic" 的服务定义 SHALL 额外持有以下配置字段：workflow_json（ReactFlow 格式的工作流 JSON）、form_schema（JSON Schema 格式的表单定义）。这些字段存储在 ServiceDefinition 表中（JSON 列）。

后端 SHALL 在创建和更新经典服务时校验 `workflow_json` 的基本结构，并在服务定义为 `smart` 时拒绝写入经典引擎专属字段。

#### Scenario: 保存工作流 JSON
- **WHEN** 管理员请求 `PUT /api/v1/itsm/services/:id` 更新 workflow_json
- **THEN** 系统 SHALL 校验 workflow_json 的基本结构（必须含 nodes 和 edges 数组）后保存

#### Scenario: 保存表单 Schema
- **WHEN** 管理员请求 `PUT /api/v1/itsm/services/:id` 更新 form_schema
- **THEN** 系统 SHALL 校验 form_schema 为合法 JSON 后保存

#### Scenario: 非经典服务设置经典字段
- **WHEN** 管理员尝试对 engine_type 为 "smart" 的服务设置 workflow_json 或 form_schema
- **THEN** 系统 SHALL 返回 400 错误，提示引擎类型不匹配

### Requirement: 智能服务引擎配置

engine_type 为 "smart" 的服务定义 SHALL 额外持有以下配置字段：collaboration_spec（Markdown 格式的协作规范）、agent_id（FK 引用 AI App 的 Agent）、knowledge_base_ids（JSON 数组，引用知识库 ID 列表）、agent_config（JSON，含 confidence_threshold 信心阈值、decision_timeout_seconds 决策超时秒数、fallback_strategy 兜底策略）。

后端 SHALL 在创建和更新智能服务时拒绝写入经典引擎专属字段；当 `agent_id` 被设置时，系统 SHALL 校验该引用有效后再保存。

#### Scenario: 配置智能服务的 Agent
- **WHEN** 管理员请求 `PUT /api/v1/itsm/services/:id` 设置 agent_id
- **THEN** 系统 SHALL 校验 agent_id 引用的 Agent 存在且处于激活状态后保存

#### Scenario: 配置信心阈值
- **WHEN** 管理员设置 agent_config.confidence_threshold 为 0.8
- **THEN** 系统 SHALL 保存该值，后续智能引擎在 AI 信心 >= 0.8 时自动执行决策

#### Scenario: 无效的 Agent 引用
- **WHEN** 管理员设置 agent_id 为不存在或已禁用的 Agent
- **THEN** 系统 SHALL 返回 400 错误

#### Scenario: 非智能服务设置智能字段
- **WHEN** 管理员尝试对 engine_type 为 "classic" 的服务设置 collaboration_spec 或 agent_id
- **THEN** 系统 SHALL 返回 400 错误，提示引擎类型不匹配

## ADDED Requirements

### Requirement: 服务目录后端回归测试覆盖

系统 SHALL 为服务目录分类、服务定义和相关种子数据提供自动化后端测试覆盖，以验证业务规则、HTTP 错误契约和 seed 幂等行为在后续变更中保持稳定。

#### Scenario: 分类服务业务规则回归
- **WHEN** 后端测试执行服务目录分类 service 层用例
- **THEN** 系统 SHALL 覆盖创建子分类、更新父分类、删除带引用分类和树形排序等关键业务规则

#### Scenario: 服务定义 HTTP 契约回归
- **WHEN** 后端测试执行服务定义 handler 层用例
- **THEN** 系统 SHALL 覆盖重复 code 返回 409、无效分类返回 400、无效工作流返回 400 和查询过滤行为

#### Scenario: 服务目录种子幂等回归
- **WHEN** 后端测试重复执行 catalog seed 逻辑并模拟软删除后重建
- **THEN** 系统 SHALL 验证 seed 首次创建、幂等跳过和缺失记录补建行为
