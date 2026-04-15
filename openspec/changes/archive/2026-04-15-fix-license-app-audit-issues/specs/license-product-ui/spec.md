## MODIFIED Requirements

### Requirement: ConstraintSchema 可视化编辑器
系统 SHALL 提供可视化编辑器，用于编辑商品的 ConstraintSchema。编辑器支持：添加/删除模块（Module）、编辑模块 key 和 label、添加/删除特性（Feature）、配置特性类型和属性。模块和特性的 key 生成 SHALL 保证唯一性，避免组件重新挂载后产生重复 key。编辑器中的所有用户可见文本（按钮、提示、占位符、标签）SHALL 使用 `license:constraints` 翻译键进行国际化渲染，支持 zh-CN 和 en。

#### Scenario: 添加模块
- **WHEN** 用户点击「添加模块」
- **THEN** 在列表末尾新增模块项，自动生成基于时间戳和随机数的唯一 key，label 为空输入框

#### Scenario: 添加特性
- **WHEN** 用户在某模块下点击「添加特性」
- **THEN** 新增特性行，自动生成唯一 key，并使用当前语言的翻译文本渲染类型标签和提示

#### Scenario: 配置 number 类型特性
- **WHEN** 用户选择特性类型为 number
- **THEN** 展示 min、max、default 数字输入框，输入框标签使用翻译键渲染

#### Scenario: 配置 enum 类型特性
- **WHEN** 用户选择特性类型为 enum
- **THEN** 展示 options 列表编辑器和 default 下拉选择，所有提示文本使用翻译键渲染

#### Scenario: 保存约束定义
- **WHEN** 用户点击「保存」
- **THEN** 将编辑器状态序列化为 JSON 并调用 PUT /schema API，成功后刷新数据，提示信息使用翻译键

#### Scenario: 切换语言
- **WHEN** 用户切换界面语言为 English
- **THEN** 约束编辑器中的所有按钮、标签、提示文本 SHALL 显示为英文，不保留任何硬编码中文
