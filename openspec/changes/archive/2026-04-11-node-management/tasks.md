## 1. App 骨架 + 数据模型

- [x] 1.1 创建 `internal/app/node/app.go`：实现 App 接口（Name/Models/Seed/Providers/Routes/Tasks），`init()` 自注册
- [x] 1.2 创建 `internal/app/node/model.go`：Node、ProcessDef、NodeProcess、NodeCommand 四个模型，嵌入 BaseModel，定义状态常量
- [x] 1.3 在 `cmd/server/edition_full.go` 添加 `import _ "metis/internal/app/node"`
- [x] 1.4 验证 `go build -tags dev ./cmd/server/` 编译通过，AutoMigrate 建表成功

## 2. Node Token 认证

- [x] 2.1 创建 `internal/app/node/token.go`：Token 生成（`mtk_<32字节hex>`）、bcrypt hash、前缀提取、验证函数
- [x] 2.2 创建 `internal/app/node/middleware.go`：NodeToken 认证中间件，从 Authorization header 提取 Token，验证后将 node_id 注入 context

## 3. Repository 层

- [x] 3.1 创建 `internal/app/node/node_repository.go`：Node CRUD + 按 token_prefix 查询 + 更新 heartbeat 时间戳 + 批量更新 offline 状态
- [x] 3.2 创建 `internal/app/node/process_def_repository.go`：ProcessDef CRUD + 分页列表
- [x] 3.3 创建 `internal/app/node/node_process_repository.go`：NodeProcess CRUD + 按 node_id 查询 + 按 process_def_id 查询 + 状态更新
- [x] 3.4 创建 `internal/app/node/node_command_repository.go`：NodeCommand 创建 + 按 node_id 查询 pending 列表 + 确认/失败更新 + 超时清理

## 4. Service 层

- [x] 4.1 创建 `internal/app/node/node_service.go`：节点 CRUD + Token 生成与轮换 + 离线检测逻辑
- [x] 4.2 创建 `internal/app/node/process_def_service.go`：ProcessDef CRUD + 更新时对关联节点下发 config.update 指令
- [x] 4.3 创建 `internal/app/node/node_process_service.go`：绑定/解绑进程 + 下发 start/stop 指令 + 状态同步
- [x] 4.4 创建 `internal/app/node/sidecar_service.go`：Sidecar 注册 + 心跳处理 + 长轮询指令分发 + 指令确认 + 配置模板渲染

## 5. Handler 层（管理端 API）

- [x] 5.1 创建 `internal/app/node/node_handler.go`：Node CRUD 端点（POST/GET/PUT/DELETE /api/v1/nodes），包含 Token 生成和一次性展示
- [x] 5.2 创建 `internal/app/node/process_def_handler.go`：ProcessDef CRUD 端点（/api/v1/process-defs）
- [x] 5.3 创建 `internal/app/node/node_process_handler.go`：节点-进程绑定端点（POST/DELETE /api/v1/nodes/:id/processes）
- [x] 5.4 在 `app.go` 的 `Routes()` 中注册管理端 API（挂在 JWT+Casbin group 下）

## 6. Handler 层（Sidecar 通信 API）

- [x] 6.1 创建 `internal/app/node/sidecar_handler.go`：Sidecar 端点（register/heartbeat/commands/commands/:id/ack/configs/:name），使用 NodeToken 中间件
- [x] 6.2 在 `app.go` 中注册 Sidecar 端点到独立路由组（跳过 JWT+Casbin，使用 NodeToken 中间件）
- [x] 6.3 实现长轮询指令分发：30s 超时，有 pending command 时立即返回
- [x] 6.4 实现配置模板渲染下载：Go template 渲染 + content hash header

## 7. Seed + 定时任务

- [x] 7.1 创建 `internal/app/node/seed.go`：节点管理菜单（目录 + 子菜单：节点列表、进程定义）+ Casbin 策略
- [x] 7.2 在 `Tasks()` 中注册定时任务：节点离线检测（每 30s 检查 heartbeat 超时的节点标记 offline）+ 过期指令清理（每 5min 清理超时 pending 指令）

## 8. Sidecar 二进制

- [x] 8.1 创建 `internal/sidecar/config.go`：sidecar.yaml 配置结构（server_url + token）
- [x] 8.2 创建 `internal/sidecar/client.go`：HTTP 客户端封装（注册、心跳、长轮询、指令确认、配置下载），统一 Bearer Token header
- [x] 8.3 创建 `internal/sidecar/process_manager.go`：进程生命周期管理（start/stop/restart）、restart_policy 自动重启、PID 追踪
- [x] 8.4 创建 `internal/sidecar/config_manager.go`：配置文件下载 + hash 对比 + 写入 generate/ 目录 + 触发 reload（SIGHUP / reload_command / stop+start）
- [x] 8.5 创建 `internal/sidecar/probe.go`：健康探针执行（http/tcp/exec 三种类型）
- [x] 8.6 创建 `internal/sidecar/agent.go`：Sidecar 主循环（注册 → 心跳循环 + 长轮询循环 + 探针循环，并发运行）
- [x] 8.7 创建 `cmd/sidecar/main.go`：入口，加载 sidecar.yaml，启动 Agent 主循环，优雅关闭
- [x] 8.8 Makefile 新增 `build-sidecar` 和 `release-sidecar` 目标

## 9. 前端

- [x] 9.1 创建 `web/src/apps/node/module.ts`：registerApp 注册路由（节点列表、节点详情、进程定义列表）
- [x] 9.2 在 `App.tsx` 添加 `import '@/apps/node/module'`
- [x] 9.3 创建节点列表页：表格展示节点 name/status/labels/last_heartbeat/进程数，支持搜索和分页
- [x] 9.4 创建节点创建 Sheet：输入 name + labels，提交后展示一次性 Token + 安装指引
- [x] 9.5 创建节点详情页：节点信息 + 已绑定进程列表（status/PID/uptime/probe）+ 指令历史 + 绑定/解绑进程操作
- [x] 9.6 创建进程定义列表页 + 创建/编辑 Sheet：ProcessDef CRUD，配置模板用 Textarea 组件
- [x] 9.7 创建 `web/src/apps/node/locales/`：中英文 i18n JSON
