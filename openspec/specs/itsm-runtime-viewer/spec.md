## ADDED Requirements

### Requirement: Token 驱动节点状态渲染
Runtime Viewer SHALL 使用 ExecutionToken 状态（而非 Activity 状态）来决定节点的视觉样式。

#### Scenario: 活跃 token 节点显示绿色脉冲
- **WHEN** 节点 N1 有一个 status=active 的 token
- **THEN** N1 显示绿色 ring + pulse 动画

#### Scenario: 已完成 token 节点显示灰色
- **WHEN** 节点 N2 有一个 status=completed 的 token 且无 active token
- **THEN** N2 显示降低透明度 + 灰色样式

#### Scenario: 已取消 token 节点显示删除线
- **WHEN** 节点 N3 有一个 status=cancelled 的 token
- **THEN** N3 显示灰色 + 删除线效果

#### Scenario: 未到达节点低透明度
- **WHEN** 节点 N4 无任何关联 token
- **THEN** N4 显示低透明度（opacity-40）

### Requirement: Token 降级兼容
当 tokens API 返回空数组（旧工单无 token 数据）时，Runtime Viewer SHALL 降级到使用 activities 数组做节点高亮（与现有行为一致）。

#### Scenario: 无 token 时降级到 activity
- **WHEN** `fetchTicketTokens()` 返回空数组
- **THEN** Viewer 使用 activities 的 status 字段做节点高亮（completed=灰、pending/in_progress=蓝、其余=低透明度）

### Requirement: 已完成路径边高亮
Runtime Viewer SHALL 对 source 和 target 都有 completed 或 active token 的边显示绿色动画。

#### Scenario: 完成路径的边显示绿色
- **WHEN** 边 E1 的 source 节点有 completed token，target 节点有 completed 或 active token
- **THEN** E1 显示绿色描边 + animated=true

#### Scenario: 未经过的边显示灰色
- **WHEN** 边 E2 的 source 节点无任何 token
- **THEN** E2 显示灰色描边，无动画

### Requirement: 并行分支多 token 可视化
Runtime Viewer SHALL 支持同时高亮多个活跃节点（多个 active token 在不同节点）。

#### Scenario: 两个并行分支同时活跃
- **WHEN** token T1(active) 在节点 A，token T2(active) 在节点 B
- **THEN** 节点 A 和节点 B 都显示绿色脉冲效果

### Requirement: 节点点击显示活动历史
Runtime Viewer SHALL 在用户点击节点时弹出 Popover，显示该节点关联的所有活动记录。

#### Scenario: 点击有活动记录的节点
- **WHEN** 用户点击节点 N1，该节点有 2 条活动记录
- **THEN** 弹出 Popover 显示 2 条记录，每条含：活动名称、状态 badge、完成时间、outcome badge

#### Scenario: 点击无活动记录的节点
- **WHEN** 用户点击网关节点 G1，该节点无活动记录
- **THEN** Popover 显示"无活动记录"提示

#### Scenario: 关闭 Popover
- **WHEN** 用户点击 Popover 外部区域
- **THEN** Popover 关闭
