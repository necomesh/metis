package itsm

// vpn_support_test.go — VPN workflow LLM generation and service publish helpers for BDD tests.
//
// Uses the LLM (gated by LLM_TEST_* env vars) to generate the VPN workflow
// from the collaboration spec, matching the bklite-cloud approach.

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"metis/internal/app/itsm/engine"
	"metis/internal/llm"
)

// vpnCollaborationSpec is the collaboration spec for the VPN activation service.
// Mirrors the seed data in seed.go.
const vpnCollaborationSpec = `用户通过 IT 服务台提交 VPN 开通申请。服务台需要收集 VPN 账号、设备与用途说明、访问原因。如果访问原因属于线上支持、故障排查、生产应急或网络接入问题，则交给信息部的网络管理员岗位审批，审批参与者类型必须使用 position_department，部门编码使用 it，岗位编码使用 network_admin。如果访问原因属于外部协作、长期远程办公、跨境访问或安全合规事项，则交给信息部的信息安全管理员岗位审批，审批参与者类型必须使用 position_department，部门编码使用 it，岗位编码使用 security_admin。审批通过后直接结束流程，不要生成驳回分支。`

// vpnSampleFormData provides typical VPN request form values for BDD tests.
// The "request_kind" field drives the exclusive gateway routing.
var vpnSampleFormData = map[string]any{
	"request_kind": "network_support",
	"vpn_type":     "l2tp",
	"reason":       "需要远程访问内网开发环境",
}

// llmConfig holds LLM configuration loaded from environment variables.
type llmConfig struct {
	baseURL string
	apiKey  string
	model   string
}

// requireLLMConfig loads LLM config from env or skips the test.
func requireLLMConfig(t *testing.T) llmConfig {
	t.Helper()
	baseURL := os.Getenv("LLM_TEST_BASE_URL")
	apiKey := os.Getenv("LLM_TEST_API_KEY")
	model := os.Getenv("LLM_TEST_MODEL")
	if baseURL == "" || apiKey == "" || model == "" {
		t.Skip("LLM integration test skipped: set LLM_TEST_BASE_URL, LLM_TEST_API_KEY, LLM_TEST_MODEL")
	}
	return llmConfig{baseURL: baseURL, apiKey: apiKey, model: model}
}

// hasLLMConfig checks whether LLM env vars are set (non-skip version for TestBDD).
func hasLLMConfig() bool {
	return os.Getenv("LLM_TEST_BASE_URL") != "" &&
		os.Getenv("LLM_TEST_API_KEY") != "" &&
		os.Getenv("LLM_TEST_MODEL") != ""
}

// generateVPNWorkflow calls the LLM to generate a VPN workflow JSON from the collaboration spec.
// It retries up to maxRetries times, feeding validation errors back to the LLM.
func generateVPNWorkflow(cfg llmConfig) (json.RawMessage, error) {
	client, err := llm.NewClient(llm.ProtocolOpenAI, cfg.baseURL, cfg.apiKey)
	if err != nil {
		return nil, fmt.Errorf("create LLM client: %w", err)
	}

	svc := &WorkflowGenerateService{}
	maxRetries := 3
	temp := float32(0.3)

	var lastErrors []engine.ValidationError

	for attempt := 0; attempt <= maxRetries; attempt++ {
		userMsg := svc.buildUserMessage(vpnCollaborationSpec, "", lastErrors)

		ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
		resp, err := client.Chat(ctx, llm.ChatRequest{
			Model: cfg.model,
			Messages: []llm.Message{
				{Role: llm.RoleSystem, Content: itsmGeneratorSystemPrompt},
				{Role: llm.RoleUser, Content: userMsg},
			},
			Temperature: &temp,
			MaxTokens:   4096,
		})
		cancel()

		if err != nil {
			if attempt < maxRetries {
				continue
			}
			return nil, fmt.Errorf("LLM call failed after %d attempts: %w", attempt+1, err)
		}

		workflowJSON, extractErr := extractJSON(resp.Content)
		if extractErr != nil {
			lastErrors = []engine.ValidationError{
				{Message: fmt.Sprintf("输出不是有效 JSON: %v", extractErr)},
			}
			if attempt < maxRetries {
				continue
			}
			return nil, fmt.Errorf("JSON extraction failed after %d attempts: %w", attempt+1, extractErr)
		}

		validationErrors := engine.ValidateWorkflow(workflowJSON)
		// Filter to only blocking errors (not warnings)
		var blockingErrors []engine.ValidationError
		for _, e := range validationErrors {
			if !e.IsWarning() {
				blockingErrors = append(blockingErrors, e)
			}
		}

		if len(blockingErrors) == 0 {
			return workflowJSON, nil
		}

		lastErrors = blockingErrors
		if attempt < maxRetries {
			continue
		}

		// Return last attempt with errors
		return nil, fmt.Errorf("workflow validation failed after %d attempts: %v", attempt+1, blockingErrors)
	}

	return nil, fmt.Errorf("workflow generation failed")
}

// publishVPNService creates the full service configuration for VPN BDD tests:
// ServiceCatalog + Priority + ServiceDefinition with LLM-generated workflow JSON.
func publishVPNService(bc *bddContext, cfg llmConfig) error {
	// 1. Generate workflow via LLM
	workflowJSON, err := generateVPNWorkflow(cfg)
	if err != nil {
		return fmt.Errorf("generate VPN workflow: %w", err)
	}

	// 2. ServiceCatalog
	catalog := &ServiceCatalog{
		Name:     "VPN服务",
		Code:     "vpn",
		IsActive: true,
	}
	if err := bc.db.Create(catalog).Error; err != nil {
		return fmt.Errorf("create service catalog: %w", err)
	}

	// 3. Priority
	priority := &Priority{
		Name:     "普通",
		Code:     "normal",
		Value:    3,
		Color:    "#52c41a",
		IsActive: true,
	}
	if err := bc.db.Create(priority).Error; err != nil {
		return fmt.Errorf("create priority: %w", err)
	}
	bc.priority = priority

	// 4. ServiceDefinition
	svc := &ServiceDefinition{
		Name:              "VPN开通申请",
		Code:              "vpn-activation",
		CatalogID:         catalog.ID,
		EngineType:        "classic",
		WorkflowJSON:      JSONField(workflowJSON),
		CollaborationSpec: vpnCollaborationSpec,
		IsActive:          true,
	}
	if err := bc.db.Create(svc).Error; err != nil {
		return fmt.Errorf("create service definition: %w", err)
	}
	bc.service = svc

	return nil
}
