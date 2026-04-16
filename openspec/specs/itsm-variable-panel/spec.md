## MODIFIED Requirements

### Requirement: 变量面板 Scope 分组显示
VariablesPanel SHALL 按 scopeID 分组显示变量。root scope 变量显示在默认组，subprocess scope 变量显示在以 scopeID 命名的折叠组中。

#### Scenario: 只有 root scope 变量
- **WHEN** 工单所有变量 scopeID 都为 "root"
- **THEN** 面板直接显示变量表格，无分组标题

#### Scenario: 包含 subprocess scope 变量
- **WHEN** 工单有 root scope 变量 3 个，subprocess-1 scope 变量 2 个
- **THEN** 面板显示 "root" 组（3 行）和 "subprocess-1" 折叠组（2 行）

### Requirement: 管理员编辑变量
VariablesPanel SHALL 为管理员用户显示编辑按钮，允许就地修改变量值。

#### Scenario: 管理员看到编辑按钮
- **WHEN** 当前用户有管理员权限
- **THEN** 每行变量右侧显示编辑图标按钮

#### Scenario: 普通用户无编辑按钮
- **WHEN** 当前用户无管理员权限
- **THEN** 变量行无编辑按钮，面板为纯只读模式

#### Scenario: 编辑变量流程
- **WHEN** 管理员点击编辑按钮
- **THEN** value 列切换为 Input 输入框，显示保存/取消按钮，保存后调用 PUT API 并刷新列表

#### Scenario: 编辑 JSON 类型变量
- **WHEN** 管理员编辑 valueType=json 的变量
- **THEN** 输入框使用 textarea 且校验 JSON 格式，格式错误时显示红色提示

### Requirement: 变量类型增强渲染
VariablesPanel SHALL 根据 valueType 使用对应的渲染方式。

#### Scenario: JSON 值折叠显示
- **WHEN** 变量 valueType 为 "json"，值为长 JSON 字符串
- **THEN** 默认折叠显示首行摘要，点击展开显示格式化 JSON

#### Scenario: Boolean 值渲染
- **WHEN** 变量 valueType 为 "boolean"
- **THEN** 显示 true/false badge（绿色/灰色）
