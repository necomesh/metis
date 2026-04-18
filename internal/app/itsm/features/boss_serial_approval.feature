Feature: 高风险变更协同申请（Boss）— 两级串签审批

  智能引擎编排"首级指定用户审批→二级部门岗位审批→完成"流程，验证混合参与者类型、复杂表单保留、审批隔离和并行工单隔离。

  Background:
    Given 已完成系统初始化
    And 已准备好以下参与人、岗位与职责
      | 身份                 | 用户名              | 部门 | 岗位       |
      | 申请人甲             | boss-requester-1    | -    | -          |
      | 申请人乙             | boss-requester-2    | -    | -          |
      | 首级审批人           | serial-reviewer     | -    | -          |
      | 二级审批人           | ops-approver        | it   | ops_admin  |
    And 已定义高风险变更协同申请协作规范
    And 已基于协作规范发布高风险变更协同申请服务（智能引擎）

  Scenario: 完整串签——首级指定用户审批→二级部门岗位审批→完成
    Given "boss-requester-1" 已创建高风险变更工单，场景为 "requester-1"
    When 智能引擎执行决策循环
    Then 工单状态为 "in_progress"
    And 当前审批仅对 "serial-reviewer" 可见
    When 当前活动的被分配人认领并审批通过
    And 智能引擎再次执行决策循环
    Then 当前审批分配到岗位 "ops_admin"
    When 当前活动的被分配人认领并审批通过
    And 智能引擎执行决策循环直到工单完成
    Then 工单状态为 "completed"

  Scenario: 审批隔离——二级审批人无法操作首级审批，首级审批人无法认领二级审批
    Given "boss-requester-1" 已创建高风险变更工单，场景为 "requester-1"
    When 智能引擎执行决策循环
    Then 工单状态为 "in_progress"
    And 当前审批仅对 "serial-reviewer" 可见
    And "ops-approver" 认领当前工单应失败
    When 当前活动的被分配人认领并审批通过
    And 智能引擎再次执行决策循环
    Then 当前审批分配到岗位 "ops_admin"
    And "serial-reviewer" 认领当前工单应失败
    When 当前活动的被分配人认领并审批通过
    And 智能引擎执行决策循环直到工单完成
    Then 工单状态为 "completed"

  Scenario: 复杂表单——resource_items 明细表格跨工单完整保留
    Given "boss-requester-1" 已创建高风险变更工单，场景为 "requester-1"
    Then 工单的表单数据中包含完整的 resource_items 明细表格
    When 智能引擎执行决策循环
    Then 工单状态为 "in_progress"
    And 工单的表单数据中包含完整的 resource_items 明细表格
    When 当前活动的被分配人认领并审批通过
    And 智能引擎再次执行决策循环
    When 当前活动的被分配人认领并审批通过
    And 智能引擎执行决策循环直到工单完成
    Then 工单状态为 "completed"
    And 工单的表单数据中包含完整的 resource_items 明细表格

  Scenario: 并行工单——两张串签工单的审批指派完全隔离
    Given "boss-requester-1" 已创建高风险变更工单 "A"，场景为 "requester-1"
    When 智能引擎执行决策循环
    Then 工单状态为 "in_progress"
    When 当前活动的被分配人认领并审批通过
    And 智能引擎再次执行决策循环
    When 当前活动的被分配人认领并审批通过
    And 智能引擎执行决策循环直到工单完成
    Then 工单状态为 "completed"
    Given "boss-requester-2" 已创建高风险变更工单 "B"，场景为 "requester-2"
    When 智能引擎执行决策循环
    Then 工单状态为 "in_progress"
    When 当前活动的被分配人认领并审批通过
    And 智能引擎再次执行决策循环
    When 当前活动的被分配人认领并审批通过
    And 智能引擎执行决策循环直到工单完成
    Then 工单状态为 "completed"
    And 工单 "A" 的审批记录与工单 "B" 完全隔离
