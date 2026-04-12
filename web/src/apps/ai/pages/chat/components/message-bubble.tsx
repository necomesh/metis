import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Bot, User, ChevronDown, ChevronRight, Wrench } from "lucide-react"
import { type SessionMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

interface MessageBubbleProps {
  message: SessionMessage
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const { t } = useTranslation(["ai"])
  const [expanded, setExpanded] = useState(false)

  if (message.role === "user") {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4" />
        </div>
      </div>
    )
  }

  if (message.role === "assistant") {
    return (
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className={cn("max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5", isStreaming && "animate-pulse")}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          {isStreaming && <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5" />}
        </div>
      </div>
    )
  }

  if (message.role === "tool_call") {
    const meta = message.metadata as { tool_name?: string; tool_args?: string } | undefined
    return (
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="max-w-[80%]">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {t("ai:chat.toolCall", { name: meta?.tool_name ?? "unknown" })}
          </button>
          {expanded && meta?.tool_args && (
            <pre className="mt-1 text-xs bg-muted rounded-md p-2 overflow-auto max-h-40">{meta.tool_args}</pre>
          )}
        </div>
      </div>
    )
  }

  if (message.role === "tool_result") {
    return (
      <div className="flex gap-3 ml-11">
        <div className="max-w-[80%]">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {t("ai:chat.toolResult")}
          </button>
          {expanded && (
            <pre className="mt-1 text-xs bg-muted rounded-md p-2 overflow-auto max-h-40">{message.content}</pre>
          )}
        </div>
      </div>
    )
  }

  return null
}
