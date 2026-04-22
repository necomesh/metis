import { type TicketItem } from "../api"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

export const TICKET_STATUS_OPTIONS: Record<string, { variant: BadgeVariant; key: string }> = {
  pending: { variant: "secondary", key: "statusPending" },
  in_progress: { variant: "default", key: "statusInProgress" },
  waiting_approval: { variant: "outline", key: "statusWaitingApproval" },
  waiting_action: { variant: "outline", key: "statusWaitingAction" },
  completed: { variant: "default", key: "statusCompleted" },
  failed: { variant: "destructive", key: "statusFailed" },
  cancelled: { variant: "secondary", key: "statusCancelled" },
}

export function getTicketStatusView(ticket: TicketItem) {
  if (ticket.engineType === "smart" && ticket.smartState === "ai_reasoning") {
    return { variant: "outline" as const, key: "statusDecisioning" }
  }
  return TICKET_STATUS_OPTIONS[ticket.status] ?? { variant: "secondary" as const, key: "statusPending" }
}
