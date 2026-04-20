## MODIFIED Requirements

### Requirement: ITSM 引擎配置前端页面

系统 SHALL 在 ITSM 模块侧边栏提供「引擎配置」菜单项（路由 `/itsm/engine-config`），页面展示四个配置区块：解析引擎、服务台智能体、决策智能体、通用设置。

#### Scenario: 页面加载
- **WHEN** 管理员进入 `/itsm/engine-config` 页面
- **THEN** 系统 SHALL 调用 `GET /api/v1/itsm/engine/config` 加载配置，调用 `GET /api/v1/ai/providers` 加载 Provider 列表（用于 generator），调用 `GET /api/v1/ai/agents` 加载 Agent 列表（用于 servicedesk/decision 的下拉选择及预览信息）

#### Scenario: 两列布局 — 智能体卡片
- **WHEN** 页面加载完成且视口宽度 >= md 断点
- **THEN** 系统 SHALL 将服务台智能体和决策智能体两个配置卡片在同一行以 `grid grid-cols-1 md:grid-cols-2` 两列布局展示，解析引擎和通用设置保持全宽单列

#### Scenario: 服务台智能体配置卡片
- **WHEN** 页面加载完成
- **THEN** 系统 SHALL 展示"服务台智能体"配置卡片，包含 Agent 下拉选择器（列表来自 AI 智能体，筛选 type=assistant 且 is_active=true），描述为"IT 服务台接单引导流程所使用的智能体"

#### Scenario: 决策智能体配置卡片
- **WHEN** 页面加载完成
- **THEN** 系统 SHALL 展示"决策智能体"配置卡片，包含 Agent 下拉选择器（同上筛选条件）、决策模式选择，描述为"工单运行时流程决策所使用的智能体"

#### Scenario: 智能体预览信息
- **WHEN** 服务台或决策卡片中已选择一个智能体
- **THEN** 系统 SHALL 在下拉选择器下方展示该智能体的摘要信息，包含策略（strategy）、温度（temperature）、最大轮次（maxTurns），以 `text-xs text-muted-foreground` 样式单行展示，字段间以 `·` 分隔

#### Scenario: 智能体预览 — 未选择时
- **WHEN** 服务台或决策卡片中未选择智能体（agentId 为 0）
- **THEN** 系统 SHALL 不展示预览信息

#### Scenario: 配置状态指示器 — 已配置
- **WHEN** 卡片对应的配置已正确设置（智能体 agentId > 0 且该智能体存在于 agent 列表且 isActive=true；生成引擎 modelId > 0）
- **THEN** 系统 SHALL 在卡片标题右侧展示 `bg-green-500` 圆点（h-2 w-2 rounded-full）及"已配置"文字标签

#### Scenario: 配置状态指示器 — 未配置
- **WHEN** 卡片对应的配置未设置（agentId 或 modelId 为 0）
- **THEN** 系统 SHALL 在卡片标题右侧展示 `bg-gray-400` 圆点及"未配置"文字标签

#### Scenario: 配置状态指示器 — 异常
- **WHEN** 卡片已配置的智能体在 agent 列表中不存在或 isActive=false
- **THEN** 系统 SHALL 在卡片标题右侧展示 `bg-red-500` 圆点及"异常"文字标签

#### Scenario: Provider-Model 联动（仅 Generator）
- **WHEN** 管理员在解析引擎区块选择 AI 服务商（Provider）
- **THEN** 系统 SHALL 调用 `GET /api/v1/ai/providers/:id/models` 加载该 Provider 下的模型列表，填充模型下拉框。若之前已选的模型属于新 Provider 则保留，否则清空模型选择

#### Scenario: 保存配置
- **WHEN** 管理员修改配置并点击「保存」
- **THEN** 系统 SHALL 调用 `PUT /api/v1/itsm/engine/config` 提交全部配置，成功后显示成功提示

#### Scenario: 未配置 Agent 引导
- **WHEN** 页面加载时 Agent 列表为空（系统未添加任何智能体）
- **THEN** 系统 SHALL 在 servicedesk/decision 卡片展示引导提示："请先在 AI 模块添加智能体"，并提供跳转链接

#### Scenario: 决策模式选择
- **WHEN** 管理员在决策智能体区块选择决策模式
- **THEN** 系统 SHALL 提供两个选项：「优先确定路径，回退 AI」（direct_first）和「始终使用 AI 决策」（ai_only），使用 Select 组件

#### Scenario: 推理日志级别选择
- **WHEN** 管理员在通用设置区块选择推理日志级别
- **THEN** 系统 SHALL 提供三个选项：「完整推理记录」（full）、「仅摘要」（summary）、「关闭」（off），使用 Select 组件
