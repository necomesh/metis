## 1. Proposal 固化与能力定义

- [ ] 1.1 完成 `proposal.md`，明确统一主题改造目标、设计原则、范围边界、分阶段推进策略、风险与非目标
- [ ] 1.2 确认 capability 列表，新增 `app-visual-theme` 并标注受影响的现有能力

## 2. 规格定义

- [ ] 2.1 为 `app-visual-theme` 创建 spec，定义系统级统一主题的行为要求
- [ ] 2.2 为 `shared-ui-patterns` 创建 delta spec，补充通用页面表面与容器层级规范
- [ ] 2.3 为 `user-auth-frontend` 创建 delta spec，明确登录页作为系统主题源头的同源一致性要求
- [ ] 2.4 为 `install-wizard-ui` 创建 delta spec，明确安装向导继续与系统主题 token 同步

## 3. 设计约束与推进策略

- [ ] 3.1 完成 `design.md`，说明为何采用“抽象认证页语言”而非“复制认证页样式”
- [ ] 3.2 在 `design.md` 中明确主题基础层、布局壳层、共享模式、模块迁移的分阶段推进顺序
- [ ] 3.3 在 `design.md` 中记录风险、取舍、迁移方式与待确认问题

## 4. 进入实现前的准备

- [ ] 4.1 复查 proposal、design、specs 之间的术语与边界是否一致
- [ ] 4.2 确认 change 达到 `/opsx:apply` 所需的 apply-ready 状态
