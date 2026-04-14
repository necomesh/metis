package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

// ToolHandler handles execution of a single tool call.
type ToolHandler func(ctx context.Context, userID uint, args json.RawMessage) (json.RawMessage, error)

// TicketQuerier is the minimal interface needed for tool handlers to query tickets.
type TicketQuerier interface {
	QueryByID(id uint) (json.RawMessage, error)
	QueryByCode(code string) (json.RawMessage, error)
	ListForUser(userID uint, status string, page, pageSize int) (json.RawMessage, error)
	Create(userID uint, title, description string, serviceID, priorityID uint) (json.RawMessage, error)
	Cancel(userID uint, ticketID uint, reason string) error
	AddComment(userID uint, ticketID uint, message string) error
	SearchServices(keyword string, catalogID *uint) (json.RawMessage, error)
}

// Registry maps tool names to handlers.
type Registry struct {
	handlers map[string]ToolHandler
}

// NewRegistry creates a tool handler registry backed by the given querier.
func NewRegistry(q TicketQuerier) *Registry {
	r := &Registry{handlers: make(map[string]ToolHandler)}

	r.handlers["itsm.search_services"] = func(ctx context.Context, userID uint, args json.RawMessage) (json.RawMessage, error) {
		var p struct {
			Keyword   string `json:"keyword"`
			CatalogID *uint  `json:"catalog_id"`
		}
		json.Unmarshal(args, &p)
		return q.SearchServices(p.Keyword, p.CatalogID)
	}

	r.handlers["itsm.create_ticket"] = func(ctx context.Context, userID uint, args json.RawMessage) (json.RawMessage, error) {
		var p struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			ServiceID   uint   `json:"service_id"`
			PriorityID  uint   `json:"priority_id"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return nil, fmt.Errorf("invalid args: %w", err)
		}
		if p.Title == "" || p.ServiceID == 0 || p.PriorityID == 0 {
			return nil, fmt.Errorf("title, service_id, and priority_id are required")
		}
		return q.Create(userID, p.Title, p.Description, p.ServiceID, p.PriorityID)
	}

	r.handlers["itsm.query_ticket"] = func(ctx context.Context, userID uint, args json.RawMessage) (json.RawMessage, error) {
		var p struct {
			TicketID   uint   `json:"ticket_id"`
			TicketCode string `json:"ticket_code"`
		}
		json.Unmarshal(args, &p)
		if p.TicketID > 0 {
			return q.QueryByID(p.TicketID)
		}
		if p.TicketCode != "" {
			return q.QueryByCode(p.TicketCode)
		}
		return nil, fmt.Errorf("ticket_id or ticket_code is required")
	}

	r.handlers["itsm.list_my_tickets"] = func(ctx context.Context, userID uint, args json.RawMessage) (json.RawMessage, error) {
		var p struct {
			Status   string `json:"status"`
			Page     int    `json:"page"`
			PageSize int    `json:"page_size"`
		}
		json.Unmarshal(args, &p)
		if p.Page <= 0 {
			p.Page = 1
		}
		if p.PageSize <= 0 {
			p.PageSize = 20
		}
		return q.ListForUser(userID, p.Status, p.Page, p.PageSize)
	}

	r.handlers["itsm.cancel_ticket"] = func(ctx context.Context, userID uint, args json.RawMessage) (json.RawMessage, error) {
		var p struct {
			TicketID uint   `json:"ticket_id"`
			Reason   string `json:"reason"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return nil, fmt.Errorf("invalid args: %w", err)
		}
		if p.TicketID == 0 || p.Reason == "" {
			return nil, fmt.Errorf("ticket_id and reason are required")
		}
		if err := q.Cancel(userID, p.TicketID, p.Reason); err != nil {
			return nil, err
		}
		return json.Marshal(map[string]string{"status": "cancelled"})
	}

	r.handlers["itsm.add_comment"] = func(ctx context.Context, userID uint, args json.RawMessage) (json.RawMessage, error) {
		var p struct {
			TicketID uint   `json:"ticket_id"`
			Message  string `json:"message"`
		}
		if err := json.Unmarshal(args, &p); err != nil {
			return nil, fmt.Errorf("invalid args: %w", err)
		}
		if p.TicketID == 0 || p.Message == "" {
			return nil, fmt.Errorf("ticket_id and message are required")
		}
		if err := q.AddComment(userID, p.TicketID, p.Message); err != nil {
			return nil, err
		}
		return json.Marshal(map[string]string{"status": "commented"})
	}

	return r
}

// Execute runs a tool by name.
func (r *Registry) Execute(ctx context.Context, toolName string, userID uint, args json.RawMessage) (json.RawMessage, error) {
	h, ok := r.handlers[toolName]
	if !ok {
		return nil, fmt.Errorf("unknown ITSM tool: %s", toolName)
	}
	return h(ctx, userID, args)
}

// HasTool checks if a tool is registered.
func (r *Registry) HasTool(name string) bool {
	_, ok := r.handlers[name]
	return ok
}
