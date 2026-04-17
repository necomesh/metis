# itsm-bdd-infrastructure

## Purpose

为 ITSM 模块建立基于 godog 的 BDD 测试基础设施，包括 suite 入口、features 目录结构、共享 context 和 Makefile 集成。

## Requirements

### Requirement: godog 测试依赖引入
项目 SHALL 在 go.mod 中引入 `github.com/cucumber/godog` 作为测试依赖。

#### Scenario: godog 可在测试代码中导入
- **WHEN** 测试文件 import `github.com/cucumber/godog`
- **THEN** `go test` 编译成功

### Requirement: BDD suite 入口文件
系统 SHALL 提供 `bdd_test.go` 作为 godog 测试 suite 的入口，使用 `godog.TestSuite` 配置 features 路径和 scenario initializer。

#### Scenario: godog suite 可运行
- **WHEN** 执行 `go test ./internal/app/itsm/ -run TestBDD -v`
- **THEN** godog suite 启动，扫描 `features/` 目录
- **AND** 无 feature 文件时不报错（0 scenarios, 0 steps）

### Requirement: features 目录结构
系统 SHALL 在 `internal/app/itsm/features/` 下创建目录结构，包含 `.gitkeep` 和一个示例 `.feature` 文件说明格式约定。

#### Scenario: features 目录存在且包含格式说明
- **WHEN** 查看 `internal/app/itsm/features/` 目录
- **THEN** 目录存在，包含 `example.feature`（注释说明格式约定，标记为 @wip 不执行）

### Requirement: 共享 BDD test context
系统 SHALL 提供 `steps_common_test.go`，定义 `bddContext` 结构体作为所有 step definitions 的共享状态容器。

#### Scenario: bddContext 包含核心字段
- **WHEN** 查看 `bddContext` 结构体
- **THEN** 包含以下字段：db (*gorm.DB)、lastErr (error)
- **AND** 提供 `reset()` 方法在每个 Scenario 前重置状态

### Requirement: BDD 测试可通过 Makefile 运行
系统 SHALL 提供 `make test-bdd` target 运行 BDD 测试。

#### Scenario: make test-bdd 运行 godog suite
- **WHEN** 执行 `make test-bdd`
- **THEN** 运行 `go test ./internal/app/itsm/ -run TestBDD -v`

### Requirement: 删除旧 BDD 占位文件
旧的 `workflow_generate_bdd_test.go` 占位文件 SHALL 被删除，其内容并入新的 `bdd_test.go` 注释中。

#### Scenario: 旧占位文件不存在
- **WHEN** 查看 `internal/app/itsm/` 目录
- **THEN** `workflow_generate_bdd_test.go` 不存在

### Requirement: 确定性覆盖全部决策类型的 activity 创建

SmartEngine.ExecuteConfirmedPlan SHALL 正确创建 7 种决策类型（approve / process / action / notify / form / complete / escalate）的 TicketActivity 记录，并在 timeline 记录 `ai_decision_executed` 事件。

#### Scenario: process 类型决策创建处理活动
- **WHEN** 执行 crafted DecisionPlan（type=process, participant_id 指向有效用户）
- **THEN** 创建 status=pending 的 TicketActivity（activity_type=process）
- **AND** 创建 TicketAssignment 指向该用户
- **AND** ticket.assignee_id 更新为该用户

#### Scenario: action 类型决策创建自动动作活动
- **WHEN** 执行 crafted DecisionPlan（type=action, action_id 指向有效 ServiceAction）
- **THEN** 创建 status=in_progress 的 TicketActivity（activity_type=action）
- **AND** 不创建 TicketAssignment（action 无需参与者）

#### Scenario: notify 类型决策创建通知活动
- **WHEN** 执行 crafted DecisionPlan（type=notify）
- **THEN** 创建 status=in_progress 的 TicketActivity（activity_type=notify）

#### Scenario: form 类型决策创建表单填写活动
- **WHEN** 执行 crafted DecisionPlan（type=form, participant_id 指向有效用户）
- **THEN** 创建 status=pending 的 TicketActivity（activity_type=form）
- **AND** 创建 TicketAssignment 指向该用户

#### Scenario: escalate 类型决策创建升级活动
- **WHEN** 执行 crafted DecisionPlan（type=escalate）
- **THEN** 创建 status=in_progress 的 TicketActivity（activity_type=escalate）

#### Scenario: complete 类型决策直接完结工单
- **WHEN** 执行 crafted DecisionPlan（next_step_type=complete）
- **THEN** 工单 status 变为 completed
- **AND** 创建 activity_type=complete 的已完成活动
- **AND** timeline 包含 workflow_completed 事件

### Requirement: AI 决策失败递增 failure count

当 AI 决策失败时，SmartEngine SHALL 递增 ticket.ai_failure_count 并记录 `ai_decision_failed` timeline 事件。

#### Scenario: 单次决策失败后 failure count 变为 1
- **WHEN** 智能引擎决策失败（LLM 不可达或返回非法输出）
- **THEN** ticket.ai_failure_count 从 0 变为 1
- **AND** timeline 包含 ai_decision_failed 事件

### Requirement: 连续失败触发 AI 熔断

当 ticket.ai_failure_count 达到 MaxAIFailureCount (3) 时，SmartEngine SHALL 拒绝执行新的决策循环，记录 `ai_disabled` timeline 事件，并返回 ErrAIDisabled。

#### Scenario: ai_failure_count 已达 3 时决策循环直接拒绝
- **WHEN** ticket.ai_failure_count = 3 时执行决策循环
- **THEN** 返回 ErrAIDisabled
- **AND** timeline 包含 ai_disabled 事件
- **AND** 工单状态不变（不会变为 failed）

### Requirement: Cancel 取消智能引擎工单

SmartEngine.Cancel SHALL 取消工单所有活跃活动、取消待处理 assignment、将工单状态设为 cancelled，并记录 timeline。

#### Scenario: 取消有活跃审批活动的智能工单
- **WHEN** 工单有一个 status=pending 的审批活动
- **AND** 执行 SmartEngine.Cancel
- **THEN** 该活动 status 变为 cancelled
- **AND** 关联 assignment status 变为 cancelled
- **AND** 工单 status 变为 cancelled
- **AND** timeline 包含取消事件

### Requirement: 低置信度决策被人工拒绝

当管理员拒绝 pending_approval 的决策时，activity 状态 SHALL 变为 rejected，决策不执行。

#### Scenario: 管理员拒绝低置信度决策
- **WHEN** 存在 status=pending_approval 的活动
- **AND** 管理员将其标记为 rejected
- **THEN** 活动 status 变为 rejected
- **AND** 工单状态不变为 completed
- **AND** timeline 包含决策拒绝事件

### Requirement: 兜底用户无效时记录 warning

当 fallback assignee 配置了但该用户不存在或未激活时，tryFallbackAssignment SHALL 记录 `participant_fallback_warning` timeline 事件，不创建 assignment。

#### Scenario: 兜底用户已停用时记录 warning 而非分配
- **WHEN** 引擎配置兜底处理人为一个 is_active=false 的用户
- **AND** 执行无参与者的审批决策
- **THEN** 不创建 TicketAssignment
- **AND** ticket.assignee_id 不变
- **AND** timeline 包含 participant_fallback_warning 事件

### Requirement: 服务台 Agent 跨路由冲突识别

当用户的诉求涉及映射到不同审批路由分支的多个选项时，服务台 Agent SHALL 识别冲突并向用户澄清，而非替用户选择或直接提交。

#### Scenario: Agent 识别跨路由冲突并向用户澄清
- **WHEN** 用户消息中同时包含映射到不同路由分支的多种需求（如 "network_support" 属网络审批路由，"security" 属安全审批路由）
- **THEN** Agent 的工具调用序列中 SHALL 包含 `itsm.service_match` 和 `itsm.service_load`
- **AND** Agent SHALL 满足以下任一路径：
  - 路径 A：不调用 `itsm.draft_prepare`（在 draft 前根据 routing_field_hint 识别冲突）
  - 路径 B：调用了 `itsm.draft_prepare` 但不调用 `itsm.draft_confirm`（收到 resolved_values 后停止推进）
- **AND** Agent 的回复内容 SHALL 包含关于路由冲突或需要选择的澄清表述

### Requirement: 服务台 Agent 同路由多选合并

当用户提到的多个需求全部映射到同一审批路由分支时，服务台 Agent SHALL 合并处理并继续推进流程，不要求用户二选一。

#### Scenario: Agent 合并同路由多选后正常推进
- **WHEN** 用户消息中包含多种需求，但它们全部映射到同一路由分支（如 "network_support" 和 "remote_maintenance" 均属网络审批路由）
- **THEN** Agent 的工具调用序列中 SHALL 包含 `itsm.service_match`、`itsm.service_load` 和 `itsm.draft_prepare`
- **AND** `itsm.draft_prepare` 的 form_data 中路由字段 SHALL 为单个结构化值（非逗号分隔）
- **AND** Agent 的回复内容中 SHALL 不包含"请选择""二选一""冲突"等要求用户做排他选择的表述

### Requirement: 服务台 Agent 必填缺失追问

当用户提供的信息不足以填满服务表单的所有必填字段时，服务台 Agent SHALL 追问缺失字段，而非带着空字段直接提交草稿。

#### Scenario: Agent 追问缺失的必填字段
- **WHEN** 用户消息仅提供了模糊的服务需求（如 "帮我开个VPN"），缺少 vpn_type、access_period 等必填字段
- **THEN** Agent SHALL 满足以下任一路径：
  - 路径 A：不调用 `itsm.draft_prepare`（在 draft 前识别出必填字段缺失）
  - 路径 B：调用了 `itsm.draft_prepare` 但不调用 `itsm.draft_confirm`（收到 missing_required warnings 后停止推进）
- **AND** Agent 的回复内容 SHALL 包含对缺失信息的追问

### Requirement: dialog 测试框架记录 toolResults

`dialogTestState` SHALL 新增 `toolResults []toolResultRecord` 字段，在 `EventTypeToolResult` 事件中记录工具名称、输出内容和是否为错误。用于测试失败时的调试诊断。

#### Scenario: toolResults 在 agent 执行后可用
- **WHEN** 服务台 Agent 处理用户消息，执行过程中产生工具调用和结果
- **THEN** `dialogTestState.toolResults` SHALL 包含每次工具调用的结果记录
- **AND** 每条记录包含 Name (string)、Output (string)、IsError (bool)

### Requirement: 工具调用计数断言 step

系统 SHALL 提供 BDD step `{tool} 被调用至少 {n} 次`，断言指定工具在当前 scenario 的 toolCalls 中出现次数 ≥ n。

#### Scenario: 计数断言通过
- **WHEN** toolCalls 中 "itsm.service_load" 出现 3 次
- **AND** 断言 "service_load 被调用至少 2 次"
- **THEN** 断言 SHALL 通过

#### Scenario: 计数断言失败
- **WHEN** toolCalls 中 "itsm.service_load" 出现 1 次
- **AND** 断言 "service_load 被调用至少 2 次"
- **THEN** 断言 SHALL 失败并报告实际调用次数
