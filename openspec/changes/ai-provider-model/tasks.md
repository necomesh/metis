## 1. 共享加密包

- [ ] 1.1 创建 `internal/pkg/crypto/` 包，实现 `Encrypt(plaintext, key)` / `Decrypt(ciphertext, key)` (AES-256-GCM)
- [ ] 1.2 在 IOC 中注册加密 key（`sha256(config.SecretKey)` → `[]byte`），命名为 `crypto.EncryptionKey`

## 2. 统一 LLM 客户端

- [ ] 2.1 添加 `sashabaranov/go-openai` 和 `anthropics/anthropic-sdk-go` 依赖
- [ ] 2.2 创建 `internal/llm/` 包，定义 `Client` 接口（Chat / ChatStream / Embedding）及请求/响应类型
- [ ] 2.3 实现 OpenAI 协议适配器（`openai_client.go`），封装 go-openai 库
- [ ] 2.4 实现 Anthropic 协议适配器（`anthropic_client.go`），封装 anthropic-sdk-go
- [ ] 2.5 实现 `NewClient(protocol, baseURL, apiKey)` 工厂函数

## 3. 数据模型

- [ ] 3.1 创建 `internal/app/ai/model.go` — Provider、Model、AILog 结构体 + ToResponse 方法 + 表名定义
- [ ] 3.2 定义 Anthropic 预置模型列表常量

## 4. AI App 骨架

- [ ] 4.1 创建 `internal/app/ai/app.go` — 实现 `app.App` 接口，`init()` 注册，Models / Providers / Seed / Routes / Tasks
- [ ] 4.2 在 `cmd/server/edition_full.go` 添加 `import _ "metis/internal/app/ai"`

## 5. Provider 后端

- [ ] 5.1 创建 `internal/app/ai/provider_repository.go` — CRUD + 按 ID 查询（含解密 api_key 选项）
- [ ] 5.2 创建 `internal/app/ai/provider_service.go` — 创建/更新时加密 api_key、protocol 自动推导、删除前检查关联模型
- [ ] 5.3 创建 `internal/app/ai/provider_handler.go` — REST API（POST/GET/PUT/DELETE /ai/providers + POST /ai/providers/:id/test）
- [ ] 5.4 实现连通性测试逻辑 — OpenAI 协议调 list models，Anthropic 发 min completion

## 6. Model 后端

- [ ] 6.1 创建 `internal/app/ai/model_repository.go` — CRUD + 按 type 筛选 + 按 provider 筛选
- [ ] 6.2 创建 `internal/app/ai/model_service.go` — 默认模型管理（per type 唯一）、capabilities 校验（仅 LLM 类型）
- [ ] 6.3 创建 `internal/app/ai/model_handler.go` — REST API（POST/GET/PUT/DELETE /ai/models + POST /ai/providers/:id/sync-models）
- [ ] 6.4 实现模型同步逻辑 — OpenAI/Ollama 调 API 拉取，Anthropic 用预置列表，增量新增不删除

## 7. Seed 与权限

- [ ] 7.1 创建 `internal/app/ai/seed.go` — AI 管理目录菜单 + 供应商管理 / 模型管理子菜单 + 按钮权限
- [ ] 7.2 Seed Casbin 策略 — admin 角色对 /api/v1/ai/* 的完整访问权限

## 8. 前端

- [ ] 8.1 创建 `web/src/apps/ai/module.ts` — registerApp 注册路由（供应商管理、模型管理）
- [ ] 8.2 在 `web/src/apps/registry.ts` 添加 `import './ai/module'`
- [ ] 8.3 创建供应商管理页面 — 列表（DataTable）+ 新建/编辑 Sheet + 连通测试按钮 + 同步模型按钮
- [ ] 8.4 创建模型管理页面 — 列表（按类型分组 Tab）+ 新建/编辑 Sheet + 设为默认 + capabilities 多选

## 9. 验证

- [ ] 9.1 `go build -tags dev ./cmd/server/` 编译通过
- [ ] 9.2 `cd web && bun run lint` 无错误
- [ ] 9.3 端到端验证：创建 Provider → 连通测试 → 同步模型 → 设置默认模型
