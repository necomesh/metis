import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { X, Plus, Trash2, Brain } from "lucide-react"
import { memoryApi, type AgentMemory } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface MemoryPanelProps {
  agentId: number
  onClose: () => void
}

export function MemoryPanel({ agentId, onClose }: MemoryPanelProps) {
  const { t } = useTranslation(["ai", "common"])
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newKey, setNewKey] = useState("")
  const [newContent, setNewContent] = useState("")

  const { data: memories = [] } = useQuery({
    queryKey: ["ai-memories", agentId],
    queryFn: () => memoryApi.list(agentId),
  })

  const createMutation = useMutation({
    mutationFn: () => memoryApi.create(agentId, { key: newKey, content: newContent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-memories", agentId] })
      toast.success(t("ai:chat.memoryAdded"))
      setAdding(false)
      setNewKey("")
      setNewContent("")
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (memoryId: number) => memoryApi.delete(agentId, memoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-memories", agentId] })
      toast.success(t("ai:chat.memoryDeleted"))
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="w-72 border-l flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-1.5">
          <Brain className="h-4 w-4" />
          <span className="font-medium text-sm">{t("ai:chat.memories")}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setAdding(!adding)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {adding && (
        <div className="p-3 border-b space-y-2">
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder={t("ai:chat.memoryKeyPlaceholder")}
            className="text-sm"
          />
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={t("ai:chat.memoryContentPlaceholder")}
            rows={2}
            className="text-sm"
          />
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              {t("common:cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!newKey.trim() || !newContent.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {t("common:save")}
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {memories.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">{t("ai:chat.noMemories")}</p>
          ) : (
            memories.map((m: AgentMemory) => (
              <div key={m.id} className="group rounded-md border p-2.5 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-medium">{m.key}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{m.source}</Badge>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 p-0.5"
                      onClick={() => deleteMutation.mutate(m.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{m.content}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
