import { useCallback, useMemo, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Send, Square, Trash2, Brain } from "lucide-react"
import { sessionApi, type SessionMessage as SessionMsg } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useChatStream, type ChatEvent } from "./hooks/use-chat-stream"
import { MessageBubble } from "./components/message-bubble"
import { SessionSidebar } from "./components/session-sidebar"
import { MemoryPanel } from "./components/memory-panel"

export function Component() {
  const { sid } = useParams<{ sid: string }>()
  const sessionId = Number(sid)
  const { t } = useTranslation(["ai", "common"])
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [input, setInput] = useState("")
  const [pendingMessages, setPendingMessages] = useState<SessionMsg[]>([])
  const [streamingText, setStreamingText] = useState("")
  const [memoryOpen, setMemoryOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ["ai-session", sessionId],
    queryFn: () => sessionApi.get(sessionId),
    enabled: !!sessionId,
  })

  const messages = useMemo(() => {
    const base = sessionData?.messages ?? []
    return [...base, ...pendingMessages]
  }, [sessionData, pendingMessages])

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    })
  }, [])

  const handleEvent = useCallback((event: ChatEvent) => {
    if (event.type === "content_delta" && event.text) {
      setStreamingText((prev) => prev + event.text)
    }
  }, [])

  const handleDone = useCallback(() => {
    setStreamingText("")
    setPendingMessages([])
    queryClient.invalidateQueries({ queryKey: ["ai-session", sessionId] })
  }, [queryClient, sessionId])

  const handleStreamError = useCallback((msg: string) => {
    setStreamingText("")
    setPendingMessages([])
    toast.error(msg)
    queryClient.invalidateQueries({ queryKey: ["ai-session", sessionId] })
  }, [queryClient, sessionId])

  const { isStreaming, connect, disconnect } = useChatStream({
    onEvent: handleEvent,
    onDone: handleDone,
    onError: handleStreamError,
  })

  const sendMutation = useMutation({
    mutationFn: (content: string) => sessionApi.sendMessage(sessionId, content),
    onSuccess: (msg) => {
      setPendingMessages((prev) => [...prev, msg])
      setInput("")
      setStreamingText("")
      connect(sessionId)
      scrollToBottom()
    },
    onError: (err) => toast.error(err.message),
  })

  const cancelMutation = useMutation({
    mutationFn: () => sessionApi.cancel(sessionId),
    onSuccess: () => {
      disconnect()
      queryClient.invalidateQueries({ queryKey: ["ai-session", sessionId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => sessionApi.delete(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] })
      toast.success(t("ai:chat.sessionDeleted"))
      navigate("/ai/chat")
    },
    onError: (err) => toast.error(err.message),
  })

  function handleSend() {
    const content = input.trim()
    if (!content || isStreaming || sendMutation.isPending) return
    sendMutation.mutate(content)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">{t("common:loading")}</div>
  }

  const session = sessionData?.session
  const agentId = session?.agentId

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <SessionSidebar agentId={agentId} currentSessionId={sessionId} />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{session?.title || t("ai:chat.newChat")}</h3>
            {session?.status && (
              <Badge variant="outline" className="text-xs">
                {t(`ai:chat.sessionStatus.${session.status}`)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {agentId && (
              <Button variant="ghost" size="sm" onClick={() => setMemoryOpen(!memoryOpen)}>
                <Brain className="h-4 w-4" />
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("ai:chat.deleteSession")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("ai:chat.deleteSessionDesc")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                    {t("common:delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {streamingText && (
              <MessageBubble
                message={{
                  id: -1,
                  sessionId,
                  role: "assistant",
                  content: streamingText,
                  tokenCount: 0,
                  sequence: -1,
                  createdAt: new Date().toISOString(),
                }}
                isStreaming
              />
            )}
          </div>
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("ai:chat.inputPlaceholder")}
              rows={1}
              className="min-h-[40px] max-h-[160px] resize-none"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => cancelMutation.mutate()}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" className="shrink-0" onClick={handleSend} disabled={!input.trim() || sendMutation.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Memory panel */}
      {memoryOpen && agentId && (
        <MemoryPanel agentId={agentId} onClose={() => setMemoryOpen(false)} />
      )}
    </div>
  )
}
