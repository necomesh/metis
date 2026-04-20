package engine

import (
	"encoding/json"
	"fmt"

	"gorm.io/gorm"
)

// cancelBoundaryTokens cancels all suspended boundary tokens for a host token.
func cancelBoundaryTokens(tx *gorm.DB, hostToken *executionTokenModel) {
	tx.Model(&executionTokenModel{}).
		Where("parent_token_id = ? AND token_type = ? AND status = ?",
			hostToken.ID, TokenBoundary, TokenSuspended).
		Update("status", TokenCancelled)
}

// resolveWorkflowContext returns the correct WorkflowDef and maps for a token.
// For subprocess tokens, it navigates to the parent subprocess node and parses
// the embedded SubProcessDef. For main/parallel tokens, it uses the ticket's workflow JSON directly.
func resolveWorkflowContext(tx *gorm.DB, token *executionTokenModel, ticketWorkflowJSON string) (*WorkflowDef, map[string]*WFNode, map[string][]*WFEdge, error) {
	def, err := ParseWorkflowDef(json.RawMessage(ticketWorkflowJSON))
	if err != nil {
		return nil, nil, nil, fmt.Errorf("workflow parse error: %w", err)
	}
	nodeMap, outEdges := def.BuildMaps()

	if token.TokenType != TokenSubprocess || token.ParentTokenID == nil {
		return def, nodeMap, outEdges, nil
	}

	// Subprocess token — find parent token's node (the subprocess node) and parse its SubProcessDef
	var parentToken executionTokenModel
	if err := tx.First(&parentToken, *token.ParentTokenID).Error; err != nil {
		return nil, nil, nil, fmt.Errorf("parent token %d not found: %w", *token.ParentTokenID, err)
	}

	subNode, ok := nodeMap[parentToken.NodeID]
	if !ok {
		return nil, nil, nil, fmt.Errorf("subprocess node %s not found in workflow", parentToken.NodeID)
	}

	subData, err := ParseNodeData(subNode.Data)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("subprocess node %s data parse error: %w", subNode.ID, err)
	}

	if len(subData.SubProcessDef) == 0 {
		return nil, nil, nil, fmt.Errorf("subprocess node %s has no subprocess_def", subNode.ID)
	}

	subDef, err := ParseWorkflowDef(subData.SubProcessDef)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("subprocess_def parse error for node %s: %w", subNode.ID, err)
	}

	subNodeMap, subOutEdges := subDef.BuildMaps()
	return subDef, subNodeMap, subOutEdges, nil
}
