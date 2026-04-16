## MODIFIED Requirements

### Requirement: 工单详情页集成 Runtime Viewer
工单详情页 SHALL 使用增强的 WorkflowViewer（token 驱动）替代现有的 activity-based viewer，并传入 tokens 数据。

#### Scenario: Classic 引擎工单显示 Runtime Viewer
- **WHEN** 打开 classic 引擎工单详情页
- **THEN** 流程图区域使用 token 驱动的节点高亮，支持节点点击查看活动历史

#### Scenario: 旧工单降级渲染
- **WHEN** 打开无 token 数据的旧工单
- **THEN** 流程图区域降级到 activity-based 高亮，功能与改造前一致

### Requirement: 增强的 VariablesPanel 集成
工单详情页 SHALL 使用增强的 VariablesPanel（scope 分组 + 管理员编辑）。

#### Scenario: 管理员查看工单变量
- **WHEN** 管理员打开工单详情页
- **THEN** 变量面板显示 scope 分组 + 编辑按钮
