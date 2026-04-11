## Context

AI Tool Registry 是 AI Infra 模块的第三层（Layer 3），位于 Provider/Model 和 Knowledge 之上，Agent Soul 之下。现有 `internal/app/ai/` 已实现 Provider、Model、Knowledge 三组完整的 model/repo/service/handler。本次新增 Tool、MCP、Skill 三组，遵循相同的分层模式。

根据探索阶段的讨论，原方案的单表 `builtin | custom | mcp` 模型已被三分类三表模型取代：
- Tools（内建，seed 注册，只能 enable/disable）
- MCP（在线连接，SSE + STDIO 双传输）
- Skills（离线包，GitHub 导入 / tar.gz 上传）

原 `custom`（webhook）类型被 Skills 完全覆盖，不再保留。

## Goals / Non-Goals

**Goals:**
- 三类工具独立管理，各有专属数据模型和 CRUD API
- MCP 支持 SSE 和 STDIO 两种传输方式，认证可选
- Skills 支持 GitHub URL 导入和 tar.gz 上传两种安装方式
- Skills 支持 prompt-only（纯指令）和 endpoint（指令+工具）两种形态
- Agent Soul 通过三张关联表分别绑定三类工具，MCP 按 Server 整体绑定
- 前端三 Tab 卡片模式管理页面
- Server 下发 soul_config 时统一组装三类工具配置

**Non-Goals:**
- Skill marketplace / 社区浏览（未来考虑，当前只做 GitHub URL + 上传）
- Skill 版本管理（reload 时重新下载即为更新）
- MCP Server 连接状态监控 / 自动重连（属于 Agent Runtime 阶段）
- Skill 工具的沙箱执行（Skill 工具本质是 HTTP endpoint 调用，不运行代码）
- Agent 端实际装配和执行逻辑（属于 ai-agent-runtime，本 change 只管 Server 端注册与管理）

## Decisions

### 决策 1: 三分类三表而非单表多 type

**选择**: 独立的 ai_tools / ai_mcp_servers / ai_skills 三张表

**替代方案**: 单表 ai_tools + type 字段区分

**理由**: 三类工具的字段差异太大——Tool 只有 name + parameters_schema，MCP 有 transport/url/command/args/env，Skill 有 source_type/source_url/manifest/instructions/tools_schema。单表会导致大量 nullable 字段，查询和校验都不清晰。分表更符合各自的领域模型。

### 决策 2: MCP 按 Server 整体绑定

**选择**: Agent 绑定 MCP Server（ai_agent_mcp_servers），不选单个工具

**替代方案**: Agent 选择 MCP Server 内的单个工具

**理由**: MCP 协议中一个 Server 暴露的工具集是一个整体。按 Server 绑定更符合 MCP 的设计理念，也简化了管理。Agent 运行时通过 `tools/list` 发现所有工具并全部注册。

### 决策 3: Skill 认证信息存 DB，Server 下发时注入

**选择**: ai_skills 表存 auth_type + auth_config（加密），Server 组装 soul_config 时将认证信息注入 Skill 下载配置

**替代方案 A**: 认证信息写在 manifest 里（不安全）

**替代方案 B**: 全局密钥库，Skill 引用 credential ID（更灵活但过度设计）

**理由**: Skill 级认证最直接——管理员导入 Skill 后在编辑界面填认证信息，Agent 下载时一并获取。与 MCP Server 的 auth_config 模式一致，代码可复用。

### 决策 4: Skill 下载 URL 由 Server 提供内部接口

**选择**: Server 提供 `GET /api/v1/ai/internal/skills/:id/package` 接口，Agent 从 Server 下载

**替代方案**: Agent 直接从 GitHub 下载

**理由**: 统一走 Server 避免 Agent 需要 GitHub 凭证，也支持 tar.gz 上传的 Skill（这些只存在于 Server 端）。Server 缓存 Skill 包内容，Agent 请求时直接返回。

### 决策 5: Skill 存储为 JSON 字段而非文件系统

**选择**: manifest/instructions/tools_schema 作为 JSON/TEXT 字段存 DB

**替代方案**: 在 Server 文件系统上存储解包后的 Skill 目录

**理由**: DB 存储更简单，免去文件系统管理，也方便多实例 Server 部署。Skill 包体积小（主要是 JSON + Markdown），不需要文件系统。

### 决策 6: GitHub 导入实现为异步任务

**选择**: 用户提交 GitHub URL 后，创建异步任务扫描 repo，完成后返回发现的 Skill 列表

**替代方案**: 同步扫描

**理由**: GitHub API 调用有网络延迟，repo 可能包含多个 Skill，同步会阻塞 UI。异步任务 + 前端轮询/SSE 通知更好。但考虑到首版简单起见，可以先做同步（单个 URL 指向具体 Skill 目录），后续再扩展批量扫描。

### 决策 7: 敏感字段加密存储

**选择**: MCP 的 auth_config 和 Skill 的 auth_config 中的密钥字段使用与 Provider.APIKeyEncrypted 相同的加密方式（AES-GCM，密钥来自 metis.yaml 的 secret_key）

**理由**: 与现有 Provider API Key 加密保持一致，复用 `internal/pkg/crypto` 工具。

## Risks / Trade-offs

**[STDIO MCP 依赖节点环境]** → Agent 管理员需确保节点上安装了 STDIO MCP Server 所需的 runtime（Node.js、Python 等）。文档说明即可，不做自动检测。

**[Skill 包无签名验证]** → 首版不做 Skill 包的完整性签名验证（只做 checksum）。从 GitHub 导入的默认可信，tar.gz 上传由管理员负责。未来可增加签名机制。

**[MCP SSE 测试连接需 Server 出口网络]** → "测试连接"功能需要 Server 能访问外部 MCP Server。STDIO 类型无法从 Server 端测试，只做配置格式校验。

**[GitHub 导入依赖 GitHub API]** → 如果部署在内网环境无法访问 GitHub，则只能用 tar.gz 上传方式。可以在首版之后扩展支持自定义 Git 仓库地址。
