package tools

import (
	"encoding/json"
	"log/slog"

	"gorm.io/gorm"
)

// ITSMTool defines a tool that ITSM registers into the ai_tools table.
type ITSMTool struct {
	Name             string
	DisplayName      string
	Description      string
	ParametersSchema json.RawMessage
}

// AllTools returns the ITSM tool definitions.
func AllTools() []ITSMTool {
	return []ITSMTool{
		{
			Name:        "itsm.search_services",
			DisplayName: "搜索 ITSM 服务",
			Description: "搜索已启用的 ITSM 服务定义，支持按关键词和分类筛选",
			ParametersSchema: json.RawMessage(`{
				"type": "object",
				"properties": {
					"keyword": {"type": "string", "description": "搜索关键词（名称或描述）"},
					"catalog_id": {"type": "integer", "description": "服务目录分类 ID（可选）"}
				}
			}`),
		},
		{
			Name:        "itsm.create_ticket",
			DisplayName: "创建 ITSM 工单",
			Description: "创建一个新的 ITSM 工单，需要指定服务、标题、描述和优先级",
			ParametersSchema: json.RawMessage(`{
				"type": "object",
				"properties": {
					"title": {"type": "string", "description": "工单标题"},
					"description": {"type": "string", "description": "工单描述"},
					"service_id": {"type": "integer", "description": "服务定义 ID"},
					"priority_id": {"type": "integer", "description": "优先级 ID"}
				},
				"required": ["title", "service_id", "priority_id"]
			}`),
		},
		{
			Name:        "itsm.query_ticket",
			DisplayName: "查询 ITSM 工单",
			Description: "按工单 ID 或工单编号查询工单详情",
			ParametersSchema: json.RawMessage(`{
				"type": "object",
				"properties": {
					"ticket_id": {"type": "integer", "description": "工单 ID"},
					"ticket_code": {"type": "string", "description": "工单编号（如 T-000001）"}
				}
			}`),
		},
		{
			Name:        "itsm.list_my_tickets",
			DisplayName: "查看我的工单",
			Description: "查询当前用户提交的工单列表，支持按状态筛选",
			ParametersSchema: json.RawMessage(`{
				"type": "object",
				"properties": {
					"status": {"type": "string", "description": "状态筛选：pending/in_progress/completed/cancelled（可选）"},
					"page": {"type": "integer", "description": "页码，默认 1"},
					"page_size": {"type": "integer", "description": "每页数量，默认 20"}
				}
			}`),
		},
		{
			Name:        "itsm.cancel_ticket",
			DisplayName: "取消 ITSM 工单",
			Description: "取消指定工单，需要提供取消原因",
			ParametersSchema: json.RawMessage(`{
				"type": "object",
				"properties": {
					"ticket_id": {"type": "integer", "description": "工单 ID"},
					"reason": {"type": "string", "description": "取消原因"}
				},
				"required": ["ticket_id", "reason"]
			}`),
		},
		{
			Name:        "itsm.add_comment",
			DisplayName: "添加工单评论",
			Description: "在工单时间线中添加一条评论",
			ParametersSchema: json.RawMessage(`{
				"type": "object",
				"properties": {
					"ticket_id": {"type": "integer", "description": "工单 ID"},
					"message": {"type": "string", "description": "评论内容"}
				},
				"required": ["ticket_id", "message"]
			}`),
		},
	}
}

// SeedTools registers ITSM tool definitions into the ai_tools table.
// This is idempotent — existing tools are skipped by name.
func SeedTools(db *gorm.DB) error {
	for _, tool := range AllTools() {
		var count int64
		if err := db.Table("ai_tools").Where("name = ?", tool.Name).Count(&count).Error; err != nil {
			// ai_tools table may not exist if AI App is not installed
			slog.Info("ITSM tools seed: ai_tools table not available, skipping", "error", err)
			return nil
		}
		if count > 0 {
			continue
		}
		if err := db.Table("ai_tools").Create(map[string]any{
			"toolkit":           "itsm",
			"name":              tool.Name,
			"display_name":      tool.DisplayName,
			"description":       tool.Description,
			"parameters_schema": string(tool.ParametersSchema),
			"is_active":         true,
		}).Error; err != nil {
			slog.Error("ITSM tools seed: failed to create tool", "name", tool.Name, "error", err)
			continue
		}
		slog.Info("ITSM tools seed: created tool", "name", tool.Name)
	}
	return nil
}

// presetAgent defines a preset agent to seed.
type presetAgent struct {
	Name         string
	Description  string
	Type         string
	Visibility   string
	Strategy     string
	SystemPrompt string
	Temperature  float64
	MaxTokens    int
	MaxTurns     int
	ToolNames    []string // ITSM tools to bind
}

// SeedAgents creates preset ITSM agents in the ai_agents table.
// Skips entirely if ai_agents table doesn't exist (AI App not installed).
func SeedAgents(db *gorm.DB) error {
	// Check if ai_agents table exists
	var count int64
	if err := db.Table("ai_agents").Count(&count).Error; err != nil {
		slog.Info("ITSM agent seed: ai_agents table not available, skipping")
		return nil
	}

	agents := []presetAgent{
		{
			Name:        "IT 服务台",
			Description: "IT 服务台助手，引导用户提交工单、查询工单状态、搜索服务目录",
			Type:        "assistant",
			Visibility:  "public",
			Strategy:    "react",
			Temperature: 0.7,
			MaxTokens:   4096,
			MaxTurns:    10,
			SystemPrompt: `你是 IT 服务台助手。你的职责是：
1. 帮助用户搜索和了解可用的 IT 服务
2. 引导用户创建工单（确认服务类型、优先级、描述信息）
3. 查询工单状态和进度
4. 回答用户关于 IT 服务流程的一般性问题

沟通风格：友好、专业、高效。使用中文回复。`,
			ToolNames: []string{"itsm.search_services", "itsm.create_ticket", "itsm.query_ticket", "itsm.list_my_tickets", "itsm.add_comment"},
		},
		{
			Name:        "ITSM 流程决策",
			Description: "ITSM 智能流程决策引擎，根据工单上下文和策略约束自动决策下一步操作",
			Type:        "assistant",
			Visibility:  "private",
			Strategy:    "react",
			Temperature: 0.2,
			MaxTokens:   2048,
			MaxTurns:    1,
			SystemPrompt: `你是 ITSM 智能流程决策引擎。你的任务是：
根据工单的完整上下文（标题、描述、优先级、SLA 状态、历史活动）和策略约束（允许的步骤类型、候选处理人、可用动作），
输出一个结构化的 JSON 决策计划。

决策原则：
- 优先根据服务处理规范（Collaboration Spec）中定义的流程来决策
- 考虑 SLA 剩余时间，紧急工单优先分配
- 选择最合适的处理人（基于技能匹配和当前负载）
- 当信息不足时降低 confidence，让人工审核`,
			ToolNames: nil, // Decision agent doesn't use tools directly
		},
		{
			Name:        "ITSM 处理协助",
			Description: "协助工单处理人分析问题、搜索知识库、提供诊断建议",
			Type:        "assistant",
			Visibility:  "team",
			Strategy:    "react",
			Temperature: 0.5,
			MaxTokens:   4096,
			MaxTurns:    10,
			SystemPrompt: `你是 ITSM 处理协助助手。你的职责是：
1. 帮助工单处理人分析工单中描述的问题
2. 搜索相关知识库获取解决方案
3. 提供诊断步骤和建议
4. 协助撰写工单处理记录和评论

你会收到工单的完整上下文。基于这些信息，提供专业、准确的技术支持。`,
			ToolNames: []string{"itsm.query_ticket", "itsm.add_comment"},
		},
	}

	for _, agent := range agents {
		var existing int64
		if err := db.Table("ai_agents").Where("name = ?", agent.Name).Count(&existing).Error; err != nil {
			continue
		}
		if existing > 0 {
			continue
		}

		// Create agent
		record := map[string]any{
			"name":          agent.Name,
			"description":   agent.Description,
			"type":          agent.Type,
			"visibility":    agent.Visibility,
			"strategy":      agent.Strategy,
			"system_prompt": agent.SystemPrompt,
			"temperature":   agent.Temperature,
			"max_tokens":    agent.MaxTokens,
			"max_turns":     agent.MaxTurns,
			"is_active":     true,
			"created_by":    1, // admin user
		}
		result := db.Table("ai_agents").Create(record)
		if result.Error != nil {
			slog.Error("ITSM agent seed: failed to create agent", "name", agent.Name, "error", result.Error)
			continue
		}

		slog.Info("ITSM agent seed: created agent", "name", agent.Name)

		// Bind tools
		if len(agent.ToolNames) > 0 {
			// Get the created agent ID
			var agentRow struct{ ID uint }
			if err := db.Table("ai_agents").Where("name = ?", agent.Name).Select("id").First(&agentRow).Error; err != nil {
				continue
			}

			for _, toolName := range agent.ToolNames {
				var toolRow struct{ ID uint }
				if err := db.Table("ai_tools").Where("name = ?", toolName).Select("id").First(&toolRow).Error; err != nil {
					continue
				}
				db.Table("ai_agent_tools").Create(map[string]any{
					"agent_id": agentRow.ID,
					"tool_id":  toolRow.ID,
				})
			}
			slog.Info("ITSM agent seed: bound tools", "agent", agent.Name, "tools", agent.ToolNames)
		}
	}

	return nil
}
