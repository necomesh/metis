import { useState } from "react"
import { useParams, Link } from "react-router"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Bot, BrainCircuit, Code2, Pencil, Trash2 } from "lucide-react"
import { agentApi, sessionApi, type AgentWithBindings, type AgentSession } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { formatDateTime } from "@/lib/utils"
import { AgentSheet } from "./components/agent-sheet"

const TYPE_ICON: Record<string, typeof Bot> = {
  assistant: BrainCircuit,
  coding: Code2,
}

const SESSION_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  running: "default",
  completed: "secondary",
  cancelled: "outline",
  error: "destructive",
}

function AgentOverview({ agent }: { agent: AgentWithBindings }) {
  const { t } = useTranslation(["ai"])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-sm text-muted-foreground">{t("ai:agents.type")}</span>
          <p className="font-medium">{t(`ai:agents.agentTypes.${agent.type}`)}</p>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">{t("ai:agents.visibility")}</span>
          <p className="font-medium">{t(`ai:agents.visibilityOptions.${agent.visibility}`)}</p>
        </div>
        {agent.type === "assistant" && (
          <>
            <div>
              <span className="text-sm text-muted-foreground">{t("ai:agents.strategy")}</span>
              <p className="font-medium">{agent.strategy ? t(`ai:agents.strategies.${agent.strategy}`) : "-"}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">{t("ai:agents.temperature")}</span>
              <p className="font-medium">{agent.temperature}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">{t("ai:agents.maxTokens")}</span>
              <p className="font-medium">{agent.maxTokens}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">{t("ai:agents.maxTurns")}</span>
              <p className="font-medium">{agent.maxTurns}</p>
            </div>
          </>
        )}
        {agent.type === "coding" && (
          <>
            <div>
              <span className="text-sm text-muted-foreground">{t("ai:agents.runtime")}</span>
              <p className="font-medium">{agent.runtime ? t(`ai:agents.runtimes.${agent.runtime}`) : "-"}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">{t("ai:agents.execMode")}</span>
              <p className="font-medium">{agent.execMode ? t(`ai:agents.execModes.${agent.execMode}`) : "-"}</p>
            </div>
            {agent.workspace && (
              <div className="col-span-2">
                <span className="text-sm text-muted-foreground">{t("ai:agents.workspace")}</span>
                <p className="font-mono text-sm">{agent.workspace}</p>
              </div>
            )}
          </>
        )}
      </div>
      {agent.description && (
        <div>
          <span className="text-sm text-muted-foreground">{t("ai:agents.description")}</span>
          <p className="text-sm mt-1">{agent.description}</p>
        </div>
      )}
      {agent.type === "assistant" && agent.systemPrompt && (
        <div>
          <span className="text-sm text-muted-foreground">{t("ai:agents.systemPrompt")}</span>
          <pre className="mt-1 text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3 max-h-64 overflow-auto">{agent.systemPrompt}</pre>
        </div>
      )}
      {agent.instructions && (
        <div>
          <span className="text-sm text-muted-foreground">{t("ai:agents.instructions")}</span>
          <pre className="mt-1 text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3 max-h-40 overflow-auto">{agent.instructions}</pre>
        </div>
      )}
    </div>
  )
}

function AgentBindings({ agent }: { agent: AgentWithBindings }) {
  const { t } = useTranslation(["ai"])

  const sections = [
    { label: t("ai:agents.knowledgeBases"), ids: agent.knowledgeBaseIds },
    { label: t("ai:agents.tools"), ids: agent.toolIds },
    { label: t("ai:agents.mcpServers"), ids: agent.mcpServerIds },
    { label: t("ai:agents.skills"), ids: agent.skillIds },
  ]

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <div key={s.label}>
          <h4 className="text-sm font-medium mb-2">{s.label}</h4>
          {s.ids.length === 0 ? (
            <p className="text-sm text-muted-foreground">-</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {s.ids.map((id) => (
                <Badge key={id} variant="outline">ID: {id}</Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function AgentSessions({ agentId }: { agentId: number }) {
  const { t } = useTranslation(["ai", "common"])
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["ai-agent-sessions", agentId],
    queryFn: () => sessionApi.list({ agentId, pageSize: 50 }),
  })
  const sessions = data?.items ?? []

  const deleteMutation = useMutation({
    mutationFn: (sid: number) => sessionApi.delete(sid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agent-sessions"] })
      toast.success(t("ai:chat.sessionDeleted"))
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">{t("common:loading")}</p>

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{t("ai:chat.noSessions")}</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>{t("ai:chat.title")}</TableHead>
          <TableHead>{t("ai:agents.status")}</TableHead>
          <TableHead>{t("common:createdAt")}</TableHead>
          <TableHead className="w-[80px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((s: AgentSession) => (
          <TableRow key={s.id}>
            <TableCell className="font-mono text-xs">{s.id}</TableCell>
            <TableCell>{s.title || "-"}</TableCell>
            <TableCell>
              <Badge variant={SESSION_STATUS_VARIANT[s.status] ?? "secondary"}>
                {t(`ai:chat.sessionStatus.${s.status}`)}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
              {formatDateTime(s.createdAt)}
            </TableCell>
            <TableCell>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="px-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("ai:chat.deleteSession")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("ai:chat.deleteSessionDesc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(s.id)} disabled={deleteMutation.isPending}>
                      {t("common:delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function Component() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation(["ai", "common"])
  const [editOpen, setEditOpen] = useState(false)

  const { data: agent, isLoading } = useQuery({
    queryKey: ["ai-agent", id],
    queryFn: () => agentApi.get(Number(id)),
    enabled: !!id,
  })

  if (isLoading || !agent) {
    return <div className="py-8 text-center text-muted-foreground">{t("common:loading")}</div>
  }

  const TypeIcon = TYPE_ICON[agent.type] ?? Bot

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/ai/agents">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <TypeIcon className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{agent.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline">{t(`ai:agents.agentTypes.${agent.type}`)}</Badge>
            <Badge variant={agent.isActive ? "default" : "secondary"}>
              {agent.isActive ? t("ai:statusLabels.active") : t("ai:statusLabels.inactive")}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          {t("common:edit")}
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("ai:agents.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="bindings">{t("ai:agents.tabs.bindings")}</TabsTrigger>
          <TabsTrigger value="sessions">{t("ai:agents.tabs.sessions")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <AgentOverview agent={agent} />
        </TabsContent>
        <TabsContent value="bindings" className="pt-4">
          <AgentBindings agent={agent} />
        </TabsContent>
        <TabsContent value="sessions" className="pt-4">
          <AgentSessions agentId={agent.id} />
        </TabsContent>
      </Tabs>

      <AgentSheet open={editOpen} onOpenChange={setEditOpen} agent={agent} />
    </div>
  )
}
