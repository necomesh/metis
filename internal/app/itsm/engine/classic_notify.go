package engine

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"gorm.io/gorm"
)

func (e *ClassicEngine) handleNotify(
	ctx context.Context, tx *gorm.DB,
	def *WorkflowDef, nodeMap map[string]*WFNode, outEdges map[string][]*WFEdge,
	token *executionTokenModel, operatorID uint,
	node *WFNode, data *NodeData, depth int,
) error {
	// Send notification via NotificationSender if configured
	if e.notifier != nil && data.ChannelID != 0 {
		// Resolve recipients
		var recipientIDs []uint
		for _, p := range data.Recipients {
			ids, err := e.resolver.Resolve(tx, token.TicketID, p)
			if err != nil {
				slog.Warn("notify: failed to resolve recipient", "ticketID", token.TicketID, "error", err)
				continue
			}
			recipientIDs = append(recipientIDs, ids...)
		}

		if len(recipientIDs) > 0 {
			// Build notification body with template variable replacement
			subject := data.Label
			body := data.Template
			if body != "" {
				body = e.renderTemplate(tx, token.TicketID, token.ScopeID, body)
			}

			if err := e.notifier.Send(ctx, data.ChannelID, subject, body, recipientIDs); err != nil {
				// Non-blocking: record warning but continue workflow
				slog.Warn("notify: send failed", "ticketID", token.TicketID, "channelID", data.ChannelID, "error", err)
				e.recordTimeline(tx, token.TicketID, nil, operatorID, "warning",
					fmt.Sprintf("通知发送失败: %v", err))
			}
		}
	}

	// Record timeline
	e.recordTimeline(tx, token.TicketID, nil, operatorID, "notification_sent", fmt.Sprintf("通知已发送: %s", data.Label))

	// Continue to next node
	edges := outEdges[node.ID]
	if len(edges) == 0 {
		return fmt.Errorf("notify node %s has no outgoing edge", node.ID)
	}

	targetNode, ok := nodeMap[edges[0].Target]
	if !ok {
		return fmt.Errorf("notify target %q not found", edges[0].Target)
	}

	return e.processNode(ctx, tx, def, nodeMap, outEdges, token, operatorID, targetNode, depth+1)
}

// renderTemplate replaces template variables in notification templates.
// Supports: {{ticket.code}}, {{ticket.status}}, {{activity.name}}, {{var.xxx}}
func (e *ClassicEngine) renderTemplate(tx *gorm.DB, ticketID uint, scopeID, tmpl string) string {
	var ticket ticketModel
	if err := tx.First(&ticket, ticketID).Error; err != nil {
		return tmpl
	}

	result := strings.ReplaceAll(tmpl, "{{ticket.code}}", fmt.Sprintf("TICK-%06d", ticketID))
	result = strings.ReplaceAll(result, "{{ticket.status}}", ticket.Status)

	// Replace process variables: {{var.xxx}}
	var vars []processVariableModel
	tx.Where("ticket_id = ? AND scope_id = ?", ticketID, scopeID).Find(&vars)
	for _, v := range vars {
		result = strings.ReplaceAll(result, "{{var."+v.Key+"}}", v.Value)
	}

	return result
}
