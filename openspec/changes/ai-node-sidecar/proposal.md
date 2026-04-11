## Why

AI Agent 需要在物理节点上运行（尤其是 Coding Agent 需要访问代码文件系统）。需要一个节点管理系统来注册和管理远端机器，以及一个轻量级的 Sidecar 二进制来托管节点上的进程（metis-ai-agent、telegraf 等），实现配置下发、进程生命周期管理和健康探针。

## What Changes

### Server 端（AI Infra App 内）

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
- 配置管理：从 Server 下载渲染好的配置文件 → 写入 `generate/<name>/` 目录 → 对比 hash → 有变化则重启进程
- 健康探针：支持 http / tcp / exec 三种探针类型
- Sidecar 自身不依赖任何 internal 包（除 internal/sidecar），保持极轻量

### 通信协议

所有 Sidecar ↔ Server 通信为 HTTP，Node Token 鉴权：

```
POST   /api/v1/ai/nodes/register          首次注册
POST   /api/v1/ai/nodes/heartbeat         心跳 + 进程状态
GET    /api/v1/ai/nodes/commands           长轮询拉指令
POST   /api/v1/ai/nodes/commands/:id/ack  指令回执
GET    /api/v1/ai/nodes/configs/:name      下载进程配置
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

## Capabilities

### New Capabilities
- `ai-node`: 节点注册表 + Token 鉴权 + 手动接入流程
- `ai-sidecar`: metis-sidecar 二进制（进程管理 + 配置下发 + 健康探针 + HTTP 轮询通信）
- `ai-process-def`: 通用进程定义 + 节点绑定 + 指令队列

## Impact

- **后端**: `internal/app/ai/` 新增 node 相关 model/repo/service/handler ~600 行
- **新二进制**: `cmd/sidecar/` + `internal/sidecar/` ~800 行
- **前端**: 新增 `web/src/apps/ai/pages/nodes/` 节点管理页面 + 安装指引
- **数据库**: 新增 4 张表（ai_nodes, ai_process_defs, ai_node_processes, ai_node_commands）
- **Makefile**: 新增 sidecar 编译目标
