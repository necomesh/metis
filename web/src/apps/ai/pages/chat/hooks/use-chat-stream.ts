import { useCallback, useRef, useState } from "react"
import { TOKEN_KEY } from "@/lib/constants"

export interface ChatEvent {
  type: string
  sequence?: number
  turn?: number
  model?: string
  text?: string
  toolCallId?: string
  toolName?: string
  toolArgs?: string
  toolOutput?: string
  durationMs?: number
  steps?: { description: string }[]
  stepIndex?: number
  description?: string
  totalTurns?: number
  inputTokens?: number
  outputTokens?: number
  message?: string
  memoryKey?: string
  memoryContent?: string
}

interface UseChatStreamOptions {
  onEvent?: (event: ChatEvent) => void
  onDone?: (event: ChatEvent) => void
  onError?: (message: string) => void
}

export function useChatStream({ onEvent, onDone, onError }: UseChatStreamOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback((sessionId: number) => {
    const token = localStorage.getItem(TOKEN_KEY)
    const url = `/api/v1/ai/sessions/${sessionId}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`

    const es = new EventSource(url)
    eventSourceRef.current = es
    setIsStreaming(true)

    es.addEventListener("message", (e) => {
      try {
        const event: ChatEvent = JSON.parse(e.data)
        onEvent?.(event)

        if (event.type === "done") {
          onDone?.(event)
          es.close()
          eventSourceRef.current = null
          setIsStreaming(false)
        } else if (event.type === "error") {
          onError?.(event.message ?? "Unknown error")
          es.close()
          eventSourceRef.current = null
          setIsStreaming(false)
        } else if (event.type === "cancelled") {
          es.close()
          eventSourceRef.current = null
          setIsStreaming(false)
        }
      } catch {
        // ignore parse errors
      }
    })

    es.addEventListener("error", () => {
      es.close()
      eventSourceRef.current = null
      setIsStreaming(false)
    })

    return es
  }, [onEvent, onDone, onError])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setIsStreaming(false)
  }, [])

  return { isStreaming, connect, disconnect }
}
