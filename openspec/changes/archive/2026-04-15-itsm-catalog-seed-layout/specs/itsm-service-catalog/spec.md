## ADDED Requirements

### Requirement: 内置服务目录种子数据

系统 SHALL 在首次安装或 Sync 启动时，通过 `seedCatalogs()` 函数内置 18 条标准服务目录分类（6 个一级域 × 3 个子分类）。Seed 使用 `code` 字段做幂等检查，已存在的记录不覆盖。

一级域及其子分类：

| 一级域 | code | 子分类 |
|--------|------|--------|
| 账号与权限 | `account-access` | 账号开通 (`account-access:provisioning`)、权限申请 (`account-access:authorization`)、密码与MFA (`account-access:credential`) |
| 终端与办公支持 | `workplace-support` | 电脑与外设 (`workplace-support:endpoint`)、办公软件支持 (`workplace-support:office-software`)、打印与会议室设备 (`workplace-support:meeting-room`) |
| 基础设施与网络 | `infra-network` | 网络与VPN (`infra-network:network`)、服务器与主机 (`infra-network:compute`)、存储与备份 (`infra-network:storage`) |
| 应用与平台支持 | `application-platform` | 企业应用支持 (`application-platform:business-app`)、发布与变更协助 (`application-platform:release`)、数据库支持 (`application-platform:database`) |
| 安全与合规 | `security-compliance` | 安全事件协助 (`security-compliance:incident`)、漏洞与基线 (`security-compliance:vulnerability`)、审计与合规支持 (`security-compliance:audit`) |
| 监控与告警 | `monitoring-alerting` | 监控接入 (`monitoring-alerting:onboarding`)、告警治理 (`monitoring-alerting:governance`)、值班与通知策略 (`monitoring-alerting:oncall`) |

每条记录 SHALL 包含 name、code、description、icon（Lucide 图标名）、sort_order、is_active=true。子分类通过先查询父分类 ID 建立关联。

#### Scenario: 首次安装种子数据
- **WHEN** 系统首次安装，数据库无服务目录数据
- **THEN** 系统 SHALL 创建全部 18 条分类记录，6 个一级 + 12 个子分类

#### Scenario: 幂等重复执行
- **WHEN** 系统重启执行 Sync，数据库已有 seed 创建的分类
- **THEN** 系统 SHALL 跳过已存在的记录（按 code 匹配），不覆盖用户修改

#### Scenario: 部分删除后重新种子
- **WHEN** 用户删除了某个 seed 创建的分类后系统重启
- **THEN** 系统 SHALL 重新创建被删除的分类（软删除记录不会被 `First` 查到）

### Requirement: 服务目录管理页面左右分栏布局

服务目录管理页面（`/itsm/catalogs`）SHALL 采用左右分栏布局：左侧固定宽度面板展示一级分类导航列表，右侧展示选中分类的子分类表格。严格两层结构。

#### Scenario: 默认展示
- **WHEN** 用户进入服务目录管理页面
- **THEN** 系统 SHALL 展示左右分栏布局，左侧列出所有一级分类（含图标、名称、子分类数量），默认选中第一个分类，右侧展示其子分类列表

#### Scenario: 切换一级分类
- **WHEN** 用户点击左侧某个一级分类
- **THEN** 右侧 SHALL 切换为该分类的子分类列表，显示子分类的名称、编码、描述、状态和操作按钮

#### Scenario: 新增子分类
- **WHEN** 用户在右侧点击"新增子分类"按钮
- **THEN** 系统 SHALL 打开 Sheet 表单，parentId 自动设为当前选中的一级分类

#### Scenario: 新增一级分类
- **WHEN** 用户点击页面顶部"新增分类"按钮
- **THEN** 系统 SHALL 打开 Sheet 表单，parentId 为空，创建成功后左侧导航列表刷新

#### Scenario: 编辑一级分类
- **WHEN** 用户在左侧分类项上点击编辑按钮
- **THEN** 系统 SHALL 打开 Sheet 表单，允许修改名称、编码、图标、描述、排序

#### Scenario: 空状态
- **WHEN** 当前选中分类无子分类
- **THEN** 右侧 SHALL 展示空状态提示，引导用户创建子分类

#### Scenario: 左侧图标展示
- **WHEN** 一级分类设置了 icon 字段
- **THEN** 左侧导航 SHALL 根据 icon 名称渲染对应的 Lucide 图标

## MODIFIED Requirements

### Requirement: 服务目录树形分类管理

系统 SHALL 提供服务目录（ServiceCatalog）实体，支持树形分类结构。字段包括：name（名称）、code（唯一编码）、description（描述）、parent_id（父分类 ID，自关联，顶层为 null）、sort_order（排序）、icon（图标）、is_active（是否启用）。内嵌 BaseModel 提供 ID + 时间戳 + 软删除。

创建和编辑分类时，表单 SHALL 包含 code 字段供用户输入。

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
