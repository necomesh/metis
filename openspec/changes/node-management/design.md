## Context

Metis 需要管理分布式节点上的进程（Telegraf、OTel Collector、AI Agent 等）。当前没有任何节点管理能力。本模块作为独立的平台级 App（`internal/app/node/`），遵循现有 App 架构（实现 `app.App` 接口，`init()` 自注册），仅在 full edition 编译。

现有基础设施约束：
- 数据库：SQLite / PostgreSQL 双引擎，纯 Go（CGO_ENABLED=0）
- 认证：JWT（用户侧）但 Sidecar 需要独立的 Token 鉴权机制
- 配置：基础设施配置在 `metis.yaml`，应用配置在 DB `SystemConfig` 表
- 中间件链：JWT → PasswordExpiry → Casbin → Audit → Handler

## Goals / Non-Goals

**Goals:**
- 节点注册表：CRUD + 状态追踪（pending/online/offline）
- Token 鉴权机制：Sidecar 使用独立的 Node Token（非 JWT）访问专用 API
- 通用进程定义（ProcessDef）：描述任意可托管进程的二进制、参数、配置模板、探针、重启策略
- 节点-进程绑定（NodeProcess）：记录每个节点上运行的进程实例及其状态
- 指令队列（NodeCommand）：Server 下发 start/stop/restart/config.update 指令，Sidecar 轮询执行
- Sidecar 二进制（`cmd/sidecar/`）：轻量常驻进程，HTTP 轮询通信，进程管理，配置下发，健康探针
- 前端节点管理页面：节点列表 + 创建（展示一次性 Token）+ 进程状态 + 安装指引

**Non-Goals:**
- 自动发现节点（仅手动注册）
- Agent 调度和路由（属于 ai-agent-runtime）
- Sidecar 自动升级
- 节点监控指标采集（未来可扩展）
- 多租户节点隔离

## Decisions

### 1. Sidecar 通信使用 HTTP 轮询而非 WebSocket/gRPC

**选择**: HTTP 短轮询（心跳 5s）+ 长轮询拉指令（30s 超时）

**替代方案**:
- WebSocket：双向实时，但增加连接管理复杂度，防火墙/代理兼容性差
- gRPC：高性能但引入 protobuf 依赖，违背零外部依赖原则

**理由**: 控制面通信对实时性要求不高（秒级延迟可接受），HTTP 轮询零依赖、穿透性强、实现简单。心跳 5s 间隔足够探测节点存活，长轮询 30s 超时保证指令下发延迟 < 30s。

### 2. Node Token 独立于 JWT 体系

**选择**: `mtk_<32字节hex>` 格式，Server 存 bcrypt hash + 前 8 位前缀

**替代方案**:
- 复用 JWT：可用但语义不匹配（JWT 是用户会话，Token 是机器身份）
- mTLS：安全性最高，但证书管理复杂度远超当前需求

**理由**: Sidecar 是长期运行的机器身份，不需要过期刷新机制。Token 仅在创建节点时展示一次，丢失则重新生成。bcrypt hash 存储保证数据库泄露时 Token 安全。前缀用于日志追踪和快速索引。

### 3. Sidecar API 挂在独立的路由组，跳过 JWT+Casbin 中间件

**选择**: Sidecar 通信端点 `/api/v1/nodes/sidecar/*` 使用自定义的 Node Token 中间件，不走标准的 JWT → Casbin 链

**理由**: Sidecar 不是用户，没有 JWT token 也没有 Casbin role。需要一个独立的认证路径：
- 管理端点（`/api/v1/nodes/*`，非 sidecar 子路径）：走标准 JWT+Casbin 链，管理员操作
- Sidecar 端点（`/api/v1/nodes/sidecar/*`）：Node Token 中间件认证，从 Token 解析出 node_id

实现方式：在 `NodeApp.Routes()` 中，管理端点挂在传入的 `api` group（已有 JWT+Casbin），Sidecar 端点需要通过 Gin engine 直接注册到 `/api/v1/nodes/sidecar/` 并挂载 NodeToken 中间件。为此 App 接口可能需要扩展，或在 `Routes()` 中通过 IOC 获取 Gin engine。

### 4. 配置下发使用模板渲染 + hash 对比

**选择**: ProcessDef 的 `config_files` 存储 Go template 模板，Server 渲染后 Sidecar 下载。Sidecar 本地存 hash，仅 hash 变化时触发进程 reload。

**替代方案**:
- Sidecar 端渲染：需要 Sidecar 持有变量上下文，增加复杂度
- 全量推送：每次心跳推送全部配置，浪费带宽

**理由**: Server 掌握所有变量（Node labels、SystemConfig 等），渲染在 Server 端最自然。hash 对比避免不必要的进程重启。

### 5. 进程 Reload 而非重启

**选择**: 配置变更时 Sidecar 优先发送 SIGHUP（或进程自定义 reload 命令），而非 kill + restart

**理由**: AI Agent 等进程可能持有活跃会话，粗暴重启会丢失用户正在进行的工作。ProcessDef 中增加 `reload_signal` 字段（默认 SIGHUP），不支持 reload 的进程才 fallback 到 restart。

### 6. 前端放在 `web/src/apps/node/`，遵循现有 App 模块模式

**选择**: 独立前端模块，通过 `registerApp()` 注册路由，和 license App 模式一致

**理由**: 保持架构一致性，支持 edition 裁剪时前端同步裁剪。

## Risks / Trade-offs

**[Sidecar 端点认证旁路]** → Sidecar API 不走标准 Casbin 链，需要确保 NodeToken 中间件的安全性等同于 JWT 链。Token 必须 bcrypt 存储，所有 Sidecar 端点必须校验 Token 有效且节点状态为 online。

**[长轮询连接数]** → 每个 Sidecar 维持一个长轮询连接（30s 超时后重连），100 个节点 = 100 个并发连接。当前规模可接受，千级节点时需要考虑 Server 端连接池。→ 暂不处理，通过 Gin 默认并发能力承载。

**[Token 泄露风险]** → Node Token 是长期有效的机器凭证，泄露后可冒充节点。→ 提供 Token 轮换 API（revoke 旧 Token + 生成新 Token），管理员可在 UI 操作。

**[Sidecar 与 Server 版本不匹配]** → Sidecar 二进制可能落后于 Server 版本。→ Sidecar 注册时上报自身版本，Server 在 heartbeat 响应中提示是否需要更新（不强制）。

**[进程 Reload 不被支持]** → 部分进程不支持 SIGHUP reload。→ ProcessDef 增加 `reload_command` 字段，为空时 fallback 到 stop + start。
