package itsm

import (
	"log/slog"

	"github.com/casbin/casbin/v2"
	"gorm.io/gorm"

	"metis/internal/app/itsm/tools"
	"metis/internal/model"
)

func seedITSM(db *gorm.DB, enforcer *casbin.Enforcer) error {
	if err := seedMenus(db); err != nil {
		return err
	}
	if err := seedCatalogs(db); err != nil {
		return err
	}
	if err := seedPolicies(enforcer); err != nil {
		return err
	}
	if err := seedPriorities(db); err != nil {
		return err
	}
	if err := seedSLATemplates(db); err != nil {
		return err
	}
	if err := tools.SeedTools(db); err != nil {
		return err
	}
	return tools.SeedAgents(db)
}

func seedCatalogs(db *gorm.DB) error {
	type catalogSeed struct {
		Name        string
		Code        string
		Description string
		Icon        string
		SortOrder   int
		ParentCode  string // empty for root
	}

	seeds := []catalogSeed{
		// ── 一级域 ──────────────────────────────────────────
		{Name: "账号与权限", Code: "account-access", Description: "围绕身份、账户与访问控制的目录分类。", Icon: "ShieldCheck", SortOrder: 10},
		{Name: "终端与办公支持", Code: "workplace-support", Description: "围绕终端设备、办公环境与桌面支持的目录分类。", Icon: "Monitor", SortOrder: 20},
		{Name: "基础设施与网络", Code: "infra-network", Description: "围绕网络、主机、存储和基础运行环境的目录分类。", Icon: "Globe", SortOrder: 30},
		{Name: "应用与平台支持", Code: "application-platform", Description: "围绕企业应用、发布平台和数据库服务的目录分类。", Icon: "Container", SortOrder: 40},
		{Name: "安全与合规", Code: "security-compliance", Description: "围绕安全事件、漏洞治理与审计合规的目录分类。", Icon: "ShieldAlert", SortOrder: 50},
		{Name: "监控与告警", Code: "monitoring-alerting", Description: "围绕监控平台、告警治理和值班机制的目录分类。", Icon: "Bell", SortOrder: 60},

		// ── 账号与权限 子分类 ─────────────────────────────────
		{Name: "账号开通", Code: "account-access:provisioning", ParentCode: "account-access", Description: "员工账号开通、账号重建与账号合并。", Icon: "User", SortOrder: 1},
		{Name: "权限申请", Code: "account-access:authorization", ParentCode: "account-access", Description: "系统角色、数据权限与临时授权相关分类。", Icon: "Lock", SortOrder: 2},
		{Name: "密码与 MFA", Code: "account-access:credential", ParentCode: "account-access", Description: "密码重置、MFA 绑定与身份验证协助。", Icon: "KeyRound", SortOrder: 3},

		// ── 终端与办公支持 子分类 ─────────────────────────────
		{Name: "电脑与外设", Code: "workplace-support:endpoint", ParentCode: "workplace-support", Description: "笔记本、显示器、外设与桌面环境支持。", Icon: "Monitor", SortOrder: 1},
		{Name: "办公软件支持", Code: "workplace-support:office-software", ParentCode: "workplace-support", Description: "办公套件、协作工具与客户端故障处理。", Icon: "LayoutGrid", SortOrder: 2},
		{Name: "打印与会议室设备", Code: "workplace-support:meeting-room", ParentCode: "workplace-support", Description: "打印、投屏、音视频设备与会议室终端支持。", Icon: "Video", SortOrder: 3},

		// ── 基础设施与网络 子分类 ─────────────────────────────
		{Name: "网络与 VPN", Code: "infra-network:network", ParentCode: "infra-network", Description: "办公网络、专线、VPN 与连通性支持。", Icon: "Globe", SortOrder: 1},
		{Name: "服务器与主机", Code: "infra-network:compute", ParentCode: "infra-network", Description: "物理机、云主机与运行环境相关分类。", Icon: "Server", SortOrder: 2},
		{Name: "存储与备份", Code: "infra-network:storage", ParentCode: "infra-network", Description: "共享存储、对象存储与备份恢复支持。", Icon: "Database", SortOrder: 3},

		// ── 应用与平台支持 子分类 ─────────────────────────────
		{Name: "企业应用支持", Code: "application-platform:business-app", ParentCode: "application-platform", Description: "内部业务系统和通用平台的日常支持。", Icon: "LayoutGrid", SortOrder: 1},
		{Name: "发布与变更协助", Code: "application-platform:release", ParentCode: "application-platform", Description: "发布窗口、变更执行与回滚协助。", Icon: "Container", SortOrder: 2},
		{Name: "数据库支持", Code: "application-platform:database", ParentCode: "application-platform", Description: "数据库开通、巡检与性能支持。", Icon: "Database", SortOrder: 3},

		// ── 安全与合规 子分类 ─────────────────────────────────
		{Name: "安全事件协助", Code: "security-compliance:incident", ParentCode: "security-compliance", Description: "安全事件上报、分析与应急支持。", Icon: "Bell", SortOrder: 1},
		{Name: "漏洞与基线", Code: "security-compliance:vulnerability", ParentCode: "security-compliance", Description: "漏洞修复、基线加固与巡检协助。", Icon: "Bug", SortOrder: 2},
		{Name: "审计与合规支持", Code: "security-compliance:audit", ParentCode: "security-compliance", Description: "审计材料准备、合规检查与追踪协助。", Icon: "FileSearch", SortOrder: 3},

		// ── 监控与告警 子分类 ─────────────────────────────────
		{Name: "监控接入", Code: "monitoring-alerting:onboarding", ParentCode: "monitoring-alerting", Description: "新增监控项、采集接入和指标配置。", Icon: "LineChart", SortOrder: 1},
		{Name: "告警治理", Code: "monitoring-alerting:governance", ParentCode: "monitoring-alerting", Description: "告警收敛、规则优化与噪音治理。", Icon: "BellRing", SortOrder: 2},
		{Name: "值班与通知策略", Code: "monitoring-alerting:oncall", ParentCode: "monitoring-alerting", Description: "值班排班、升级策略和通知链路维护。", Icon: "Clock", SortOrder: 3},
	}

	// First pass: create root catalogs (no parent)
	for _, s := range seeds {
		if s.ParentCode != "" {
			continue
		}
		var existing ServiceCatalog
		if err := db.Where("code = ?", s.Code).First(&existing).Error; err == nil {
			continue
		}
		cat := ServiceCatalog{
			Name: s.Name, Code: s.Code, Description: s.Description,
			Icon: s.Icon, SortOrder: s.SortOrder, IsActive: true,
		}
		if err := db.Create(&cat).Error; err != nil {
			slog.Error("seed: failed to create catalog", "code", s.Code, "error", err)
			continue
		}
		slog.Info("seed: created catalog", "code", s.Code, "name", s.Name)
	}

	// Second pass: create child catalogs
	for _, s := range seeds {
		if s.ParentCode == "" {
			continue
		}
		var existing ServiceCatalog
		if err := db.Where("code = ?", s.Code).First(&existing).Error; err == nil {
			continue
		}
		var parent ServiceCatalog
		if err := db.Where("code = ?", s.ParentCode).First(&parent).Error; err != nil {
			slog.Error("seed: parent catalog not found", "code", s.Code, "parentCode", s.ParentCode, "error", err)
			continue
		}
		cat := ServiceCatalog{
			Name: s.Name, Code: s.Code, Description: s.Description,
			Icon: s.Icon, ParentID: &parent.ID, SortOrder: s.SortOrder, IsActive: true,
		}
		if err := db.Create(&cat).Error; err != nil {
			slog.Error("seed: failed to create catalog", "code", s.Code, "error", err)
			continue
		}
		slog.Info("seed: created catalog", "code", s.Code, "name", s.Name)
	}

	return nil
}

func seedMenus(db *gorm.DB) error {
	// ITSM 顶级目录
	var itsmDir model.Menu
	if err := db.Where("permission = ?", "itsm").First(&itsmDir).Error; err != nil {
		itsmDir = model.Menu{
			Name:       "ITSM",
			Type:       model.MenuTypeDirectory,
			Icon:       "Headset",
			Permission: "itsm",
			Sort:       400,
		}
		if err := db.Create(&itsmDir).Error; err != nil {
			return err
		}
		slog.Info("seed: created menu", "name", itsmDir.Name, "permission", itsmDir.Permission)
	}

	// 服务目录
	catalogMenu := seedMenu(db, &itsmDir.ID, "服务目录", model.MenuTypeMenu, "/itsm/catalogs", "FolderTree", "itsm:catalog:list", 0)
	seedButtons(db, catalogMenu, []model.Menu{
		{Name: "新增分类", Type: model.MenuTypeButton, Permission: "itsm:catalog:create", Sort: 0},
		{Name: "编辑分类", Type: model.MenuTypeButton, Permission: "itsm:catalog:update", Sort: 1},
		{Name: "删除分类", Type: model.MenuTypeButton, Permission: "itsm:catalog:delete", Sort: 2},
	})

	// 服务定义
	serviceMenu := seedMenu(db, &itsmDir.ID, "服务定义", model.MenuTypeMenu, "/itsm/services", "Cog", "itsm:service:list", 1)
	seedButtons(db, serviceMenu, []model.Menu{
		{Name: "新增服务", Type: model.MenuTypeButton, Permission: "itsm:service:create", Sort: 0},
		{Name: "编辑服务", Type: model.MenuTypeButton, Permission: "itsm:service:update", Sort: 1},
		{Name: "删除服务", Type: model.MenuTypeButton, Permission: "itsm:service:delete", Sort: 2},
	})

	// 工单管理 子目录
	var ticketDir model.Menu
	if err := db.Where("permission = ?", "itsm:ticket").First(&ticketDir).Error; err != nil {
		ticketDir = model.Menu{
			ParentID:   &itsmDir.ID,
			Name:       "工单管理",
			Type:       model.MenuTypeDirectory,
			Icon:       "ClipboardList",
			Permission: "itsm:ticket",
			Sort:       2,
		}
		if err := db.Create(&ticketDir).Error; err != nil {
			return err
		}
		slog.Info("seed: created menu", "name", ticketDir.Name, "permission", ticketDir.Permission)
	}

	// 全部工单
	allTicketMenu := seedMenu(db, &ticketDir.ID, "全部工单", model.MenuTypeMenu, "/itsm/tickets", "List", "itsm:ticket:list", 0)
	seedButtons(db, allTicketMenu, []model.Menu{
		{Name: "创建工单", Type: model.MenuTypeButton, Permission: "itsm:ticket:create", Sort: 0},
		{Name: "指派工单", Type: model.MenuTypeButton, Permission: "itsm:ticket:assign", Sort: 1},
		{Name: "完结工单", Type: model.MenuTypeButton, Permission: "itsm:ticket:complete", Sort: 2},
		{Name: "取消工单", Type: model.MenuTypeButton, Permission: "itsm:ticket:cancel", Sort: 3},
	})

	// 我的工单
	seedMenu(db, &ticketDir.ID, "我的工单", model.MenuTypeMenu, "/itsm/tickets/mine", "User", "itsm:ticket:mine", 1)
	// 我的待办
	seedMenu(db, &ticketDir.ID, "我的待办", model.MenuTypeMenu, "/itsm/tickets/todo", "Clock", "itsm:ticket:todo", 2)
	// 历史工单
	seedMenu(db, &ticketDir.ID, "历史工单", model.MenuTypeMenu, "/itsm/tickets/history", "Archive", "itsm:ticket:history", 3)

	// 我的审批
	seedMenu(db, &ticketDir.ID, "我的审批", model.MenuTypeMenu, "/itsm/tickets/approvals", "CheckCircle", "itsm:ticket:approvals", 4)

	// 优先级管理
	priorityMenu := seedMenu(db, &itsmDir.ID, "优先级管理", model.MenuTypeMenu, "/itsm/priorities", "Flag", "itsm:priority:list", 3)
	seedButtons(db, priorityMenu, []model.Menu{
		{Name: "新增优先级", Type: model.MenuTypeButton, Permission: "itsm:priority:create", Sort: 0},
		{Name: "编辑优先级", Type: model.MenuTypeButton, Permission: "itsm:priority:update", Sort: 1},
		{Name: "删除优先级", Type: model.MenuTypeButton, Permission: "itsm:priority:delete", Sort: 2},
	})

	// SLA 管理
	slaMenu := seedMenu(db, &itsmDir.ID, "SLA 管理", model.MenuTypeMenu, "/itsm/sla", "Timer", "itsm:sla:list", 4)
	seedButtons(db, slaMenu, []model.Menu{
		{Name: "新增SLA", Type: model.MenuTypeButton, Permission: "itsm:sla:create", Sort: 0},
		{Name: "编辑SLA", Type: model.MenuTypeButton, Permission: "itsm:sla:update", Sort: 1},
		{Name: "删除SLA", Type: model.MenuTypeButton, Permission: "itsm:sla:delete", Sort: 2},
	})

	return nil
}

func seedMenu(db *gorm.DB, parentID *uint, name string, menuType model.MenuType, path, icon, permission string, sort int) *model.Menu {
	var menu model.Menu
	if err := db.Where("permission = ?", permission).First(&menu).Error; err != nil {
		menu = model.Menu{
			ParentID:   parentID,
			Name:       name,
			Type:       menuType,
			Path:       path,
			Icon:       icon,
			Permission: permission,
			Sort:       sort,
		}
		if err := db.Create(&menu).Error; err != nil {
			slog.Error("seed: failed to create menu", "permission", permission, "error", err)
			return nil
		}
		slog.Info("seed: created menu", "name", menu.Name, "permission", menu.Permission)
	}
	return &menu
}

func seedButtons(db *gorm.DB, parent *model.Menu, buttons []model.Menu) {
	if parent == nil {
		return
	}
	for _, btn := range buttons {
		var existing model.Menu
		if err := db.Where("permission = ?", btn.Permission).First(&existing).Error; err != nil {
			btn.ParentID = &parent.ID
			if err := db.Create(&btn).Error; err != nil {
				slog.Error("seed: failed to create button", "permission", btn.Permission, "error", err)
				continue
			}
			slog.Info("seed: created menu", "name", btn.Name, "permission", btn.Permission)
		}
	}
}

func seedPolicies(enforcer *casbin.Enforcer) error {
	policies := [][]string{
		// Catalogs
		{"admin", "/api/v1/itsm/catalogs", "POST"},
		{"admin", "/api/v1/itsm/catalogs/tree", "GET"},
		{"admin", "/api/v1/itsm/catalogs/:id", "PUT"},
		{"admin", "/api/v1/itsm/catalogs/:id", "DELETE"},
		// Services
		{"admin", "/api/v1/itsm/services", "POST"},
		{"admin", "/api/v1/itsm/services", "GET"},
		{"admin", "/api/v1/itsm/services/:id", "GET"},
		{"admin", "/api/v1/itsm/services/:id", "PUT"},
		{"admin", "/api/v1/itsm/services/:id", "DELETE"},
		// Service Actions
		{"admin", "/api/v1/itsm/services/:id/actions", "POST"},
		{"admin", "/api/v1/itsm/services/:id/actions", "GET"},
		{"admin", "/api/v1/itsm/services/:id/actions/:actionId", "PUT"},
		{"admin", "/api/v1/itsm/services/:id/actions/:actionId", "DELETE"},
		// Priorities
		{"admin", "/api/v1/itsm/priorities", "POST"},
		{"admin", "/api/v1/itsm/priorities", "GET"},
		{"admin", "/api/v1/itsm/priorities/:id", "PUT"},
		{"admin", "/api/v1/itsm/priorities/:id", "DELETE"},
		// SLA
		{"admin", "/api/v1/itsm/sla", "POST"},
		{"admin", "/api/v1/itsm/sla", "GET"},
		{"admin", "/api/v1/itsm/sla/:id", "PUT"},
		{"admin", "/api/v1/itsm/sla/:id", "DELETE"},
		// Escalation Rules
		{"admin", "/api/v1/itsm/sla/:id/escalations", "POST"},
		{"admin", "/api/v1/itsm/sla/:id/escalations", "GET"},
		{"admin", "/api/v1/itsm/sla/:id/escalations/:escalationId", "PUT"},
		{"admin", "/api/v1/itsm/sla/:id/escalations/:escalationId", "DELETE"},
		// Tickets
		{"admin", "/api/v1/itsm/tickets", "POST"},
		{"admin", "/api/v1/itsm/tickets", "GET"},
		{"admin", "/api/v1/itsm/tickets/mine", "GET"},
		{"admin", "/api/v1/itsm/tickets/todo", "GET"},
		{"admin", "/api/v1/itsm/tickets/history", "GET"},
		{"admin", "/api/v1/itsm/tickets/:id", "GET"},
		{"admin", "/api/v1/itsm/tickets/:id/assign", "PUT"},
		{"admin", "/api/v1/itsm/tickets/:id/complete", "PUT"},
		{"admin", "/api/v1/itsm/tickets/:id/cancel", "PUT"},
		{"admin", "/api/v1/itsm/tickets/:id/timeline", "GET"},
		// Classic engine routes
		{"admin", "/api/v1/itsm/tickets/:id/progress", "POST"},
		{"admin", "/api/v1/itsm/tickets/:id/signal", "POST"},
		{"admin", "/api/v1/itsm/tickets/:id/activities", "GET"},
		// Smart engine override routes
		{"admin", "/api/v1/itsm/tickets/:id/activities/:aid/confirm", "POST"},
		{"admin", "/api/v1/itsm/tickets/:id/activities/:aid/reject", "POST"},
		{"admin", "/api/v1/itsm/tickets/:id/override/jump", "POST"},
		{"admin", "/api/v1/itsm/tickets/:id/override/reassign", "POST"},
		{"admin", "/api/v1/itsm/tickets/:id/override/retry-ai", "POST"},
		// Approval routes
		{"admin", "/api/v1/itsm/tickets/approvals", "GET"},
		{"admin", "/api/v1/itsm/tickets/approvals/count", "GET"},
		{"admin", "/api/v1/itsm/tickets/:id/activities/:aid/approve", "POST"},
		{"admin", "/api/v1/itsm/tickets/:id/activities/:aid/deny", "POST"},
	}

	menuPerms := [][]string{
		{"admin", "itsm", "read"},
		{"admin", "itsm:catalog:list", "read"},
		{"admin", "itsm:catalog:create", "read"},
		{"admin", "itsm:catalog:update", "read"},
		{"admin", "itsm:catalog:delete", "read"},
		{"admin", "itsm:service:list", "read"},
		{"admin", "itsm:service:create", "read"},
		{"admin", "itsm:service:update", "read"},
		{"admin", "itsm:service:delete", "read"},
		{"admin", "itsm:ticket", "read"},
		{"admin", "itsm:ticket:list", "read"},
		{"admin", "itsm:ticket:create", "read"},
		{"admin", "itsm:ticket:assign", "read"},
		{"admin", "itsm:ticket:complete", "read"},
		{"admin", "itsm:ticket:cancel", "read"},
		{"admin", "itsm:ticket:mine", "read"},
		{"admin", "itsm:ticket:todo", "read"},
		{"admin", "itsm:ticket:history", "read"},
		{"admin", "itsm:ticket:approvals", "read"},
		{"admin", "itsm:priority:list", "read"},
		{"admin", "itsm:priority:create", "read"},
		{"admin", "itsm:priority:update", "read"},
		{"admin", "itsm:priority:delete", "read"},
		{"admin", "itsm:sla:list", "read"},
		{"admin", "itsm:sla:create", "read"},
		{"admin", "itsm:sla:update", "read"},
		{"admin", "itsm:sla:delete", "read"},
	}

	allPolicies := append(policies, menuPerms...)
	for _, p := range allPolicies {
		if has, _ := enforcer.HasPolicy(p); !has {
			if _, err := enforcer.AddPolicy(p); err != nil {
				slog.Error("seed: failed to add policy", "policy", p, "error", err)
			}
		}
	}

	return nil
}

func seedPriorities(db *gorm.DB) error {
	priorities := []Priority{
		{Name: "紧急", Code: "P0", Value: 1, Color: "#FF0000", Description: "紧急问题，需要立即处理", DefaultResponseMinutes: 15, DefaultResolutionMinutes: 120, IsActive: true},
		{Name: "高", Code: "P1", Value: 2, Color: "#FF6600", Description: "高优先级，需要尽快处理", DefaultResponseMinutes: 60, DefaultResolutionMinutes: 480, IsActive: true},
		{Name: "中", Code: "P2", Value: 3, Color: "#FFAA00", Description: "中等优先级", DefaultResponseMinutes: 240, DefaultResolutionMinutes: 1440, IsActive: true},
		{Name: "低", Code: "P3", Value: 4, Color: "#00AA00", Description: "低优先级", DefaultResponseMinutes: 480, DefaultResolutionMinutes: 4320, IsActive: true},
		{Name: "最低", Code: "P4", Value: 5, Color: "#888888", Description: "最低优先级", DefaultResponseMinutes: 1440, DefaultResolutionMinutes: 10080, IsActive: true},
	}

	for _, p := range priorities {
		var existing Priority
		if err := db.Where("code = ?", p.Code).First(&existing).Error; err != nil {
			if err := db.Create(&p).Error; err != nil {
				slog.Error("seed: failed to create priority", "code", p.Code, "error", err)
				continue
			}
			slog.Info("seed: created priority", "code", p.Code, "name", p.Name)
		}
	}

	return nil
}

func seedSLATemplates(db *gorm.DB) error {
	templates := []SLATemplate{
		{Name: "标准", Code: "standard", Description: "标准 SLA，响应 4 小时，解决 24 小时", ResponseMinutes: 240, ResolutionMinutes: 1440, IsActive: true},
		{Name: "紧急", Code: "urgent", Description: "紧急 SLA，响应 30 分钟，解决 4 小时", ResponseMinutes: 30, ResolutionMinutes: 240, IsActive: true},
	}

	for _, t := range templates {
		var existing SLATemplate
		if err := db.Where("code = ?", t.Code).First(&existing).Error; err != nil {
			if err := db.Create(&t).Error; err != nil {
				slog.Error("seed: failed to create SLA template", "code", t.Code, "error", err)
				continue
			}
			slog.Info("seed: created SLA template", "code", t.Code, "name", t.Name)
		}
	}

	return nil
}
