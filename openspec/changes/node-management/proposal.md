## Why

Metis 需要一个通用的节点管理系统来注册和管理远端机器。这是**平台级基础设施**，不绑定任何特定 App。Sidecar 是部署在每台节点上的轻量进程管家，负责托管各类进程（Telegraf、OTel Collector、AI Agent 等），实现配置下发、进程生命周期管理和健康探针。

本模块作为独立 App（`internal/app/node/`），仅在 full edition 中编译，不包含在 license 或 lite edition 中。

## What Changes

### Server 端（Node App）

- 新增 `internal/app/node/` 目录，实现独立的 Node App
- 新增 Node 数据模型：节点注册表 + Token 鉴权
- 新增 ProcessDef 数据模型：进程定义（二进制、参数、配置文件模板、探针、重启策略）
- 新增 NodeProcess 数据模型：节点-进程绑定 + 运行状态
- 新增节点管理 API：CRUD + Token 生成 + Sidecar 通信接口（注册、心跳、长轮询指令、配置下载）
- 新增节点安装指引页面：创建节点 → 展示 Token（仅一次）+ 安装命令 + 配置模板
- Token 机制：`mtk_<32位hex>` 格式，Server 存 bcrypt hash + 前缀，Bearer Token 鉴权

### Sidecar 二进制（cmd/sidecar/）

- 新增 `cmd/sidecar/main.go` + `internal/sidecar/` 包
- 启动时通过 Token 向 Server 注册，上报系统信息和已安装工具
- 主循环：心跳上报（每 5s） + 长轮询拉指令（30s 超时）
- 进程管理：start / stop / restart，支持 restart_policy（always / on_failure / never）
- 配置管理：从 Server 下载渲染好的配置文件 → 写入 `generate/<name>/` 目录 → 对比 hash → 有变化则通知进程 reload（非粗暴重启）
- 健康探针：支持 http / tcp / exec 三种探针类型
- Sidecar 自身不依赖任何 internal 包（除 internal/sidecar），保持极轻量

### 通信协议

所有 Sidecar ↔ Server 通信为 HTTP，Node Token 鉴权：

```
POST   /api/v1/nodes/register          首次注册
POST   /api/v1/nodes/heartbeat         心跳 + 进程状态
GET    /api/v1/nodes/commands           长轮询拉指令
POST   /api/v1/nodes/commands/:id/ack  指令回执
GET    /api/v1/nodes/configs/:name      下载进程配置
```

Sidecar 端 API 不需要 URL 里带 node_id，Token 已唯一对应 Node。

### 手动接入流程

1. 管理员在 UI 创建节点 → 获得一次性展示的 Token
2. 在目标机器下载 metis-sidecar 二进制
3. 创建 sidecar.yaml（server + token 两个必填字段）
4. 启动 sidecar → 自动注册 → Server 标记 online

### 数据模型

**Node**: name, token_hash(bcrypt), token_prefix(前 8 位), status(pending | online | offline), labels(JSON), system_info(JSON: os, arch, cpu_cores, memory_total), capabilities(JSON: tools_installed, gpu), last_heartbeat

**ProcessDef**: name, display_name, description, binary, args[], env{}, config_files[{filename, content}], probe_type(none | http | tcp | exec), probe_config(JSON), restart_policy(always | on_failure | never), max_restarts, resource_limits(JSON)

**NodeProcess**: node_id(FK), process_def_id(FK), status(running | stopped | error | pending_config), pid, config_version(hash), last_probe(JSON), override_vars(JSON)

**NodeCommand**: node_id(FK), type(process.start | process.stop | process.restart | config.update), payload(JSON), status(pending | acked | failed), created_at, acked_at

### 项目结构

```
internal/
  app/node/          # Node App（独立于 AI）
    app.go           # 实现 app.App 接口
    model.go         # Node, ProcessDef, NodeProcess, NodeCommand
    repository.go    # GORM 数据访问
    service.go       # 业务逻辑
    handler.go       # HTTP handler + Sidecar 通信接口
    seed.go          # 菜单 + Casbin 策略
  sidecar/           # Sidecar 逻辑（仅 Sidecar 二进制用）
cmd/
  sidecar/           # metis-sidecar 入口
web/
  src/apps/node/     # 节点管理前端
    module.ts        # 路由注册
    pages/           # 节点列表、详情、安装指引
```

### Edition 注册

```go
// cmd/server/edition_full.go
import _ "metis/internal/app/node"
```

## Capabilities

### New Capabilities
- `node-management`: 节点注册表 + Token 鉴权 + 手动接入流程
- `sidecar`: metis-sidecar 二进制（进程管理 + 配置下发 + 健康探针 + HTTP 轮询通信）
- `process-def`: 通用进程定义 + 节点绑定 + 指令队列

## Impact

- **后端**: 新增 `internal/app/node/` ~600 行
- **新二进制**: `cmd/sidecar/` + `internal/sidecar/` ~800 行
- **前端**: 新增 `web/src/apps/node/` 节点管理页面 + 安装指引
- **数据库**: 新增 4 张表（nodes, process_defs, node_processes, node_commands）
- **Makefile**: 新增 sidecar 编译目标
- **Edition**: edition_full.go 新增 `import _ "metis/internal/app/node"`
