import { useState, useMemo } from "react"
import { useParams, useNavigate, Link } from "react-router"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, BookOpen, Bot, BrainCircuit, ChevronRight, Code2, MessageSquare, Package, Pencil, Plug, Share2, Trash2, Wrench } from "lucide-react"
import { sessionApi, api, type AgentWithBindings, type AgentSession } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { formatDateTime } from "@/lib/utils"

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

export interface AgentDetailPageConfig {
  agentType: "assistant" | "coding"
  i18nKey: string
  basePath: string
  queryKey: string
  getApiFn: (id: number) => Promise<AgentWithBindings>
  deleteApiFn: (id: number) => Promise<unknown>
  listQueryKey: string
}

interface NamedItem {
  id: number
  name: string
  displayName?: string
  description?: string
}

interface CapabilitySetItem extends NamedItem {
  isActive: boolean
}

interface CapabilitySet {
  id: number
  type: "tool" | "mcp" | "skill" | "knowledge_base" | "knowledge_graph"
  name: string
  description: string
  icon?: string
  itemCount: number
  items: CapabilitySetItem[]
}

function capabilitySetIcon(type: CapabilitySet["type"]) {
  const iconMap = {
    tool: Wrench,
    mcp: Plug,
    skill: Package,
    knowledge_base: BookOpen,
    knowledge_graph: Share2,
  }
  return iconMap[type]
}

function capabilitySetTitle(set: CapabilitySet, t: (key: string, options?: { defaultValue?: string }) => string) {
  if (set.type === "tool") {
    return t(`ai:tools.toolkits.${set.name}.name`, { defaultValue: set.name })
  }
  return set.name
}

function capabilityItemName(
  type: CapabilitySet["type"],
  item: CapabilitySetItem,
  t: (key: string, options?: { defaultValue?: string }) => string
) {
  if (type === "tool") {
    return t(`ai:tools.toolDefs.${item.name}.name`, { defaultValue: item.displayName || item.name })
  }
  return item.displayName || item.name
}

function AgentBindingsCard({ agent }: { agent: AgentWithBindings }) {
  const { t } = useTranslation(["ai"])
  const [openSetId, setOpenSetId] = useState<number | null>(null)

  const { data: capabilitySets = [] } = useQuery({
    queryKey: ["ai-capability-sets"],
    queryFn: () =>
      api.get<{ items: CapabilitySet[] }>("/api/v1/ai/capability-sets").then((r) => r?.items ?? []),
  })

  const idsMap = useMemo<Record<string, number[]>>(() => ({
    tools: agent.toolIds,
    mcp: agent.mcpServerIds,
    skills: agent.skillIds,
    kb: agent.knowledgeBaseIds,
    kg: agent.knowledgeGraphIds,
  }), [agent.toolIds, agent.mcpServerIds, agent.skillIds, agent.knowledgeBaseIds, agent.knowledgeGraphIds])

  const selectedBySet = useMemo(() => {
    const map: Record<number, number[]> = {}
    if (agent.capabilitySetBindings?.length) {
      for (const binding of agent.capabilitySetBindings) {
        map[binding.setId] = binding.itemIds ?? []
      }
      return map
    }
    const legacyKeyByType: Record<CapabilitySet["type"], keyof typeof idsMap> = {
      tool: "tools",
      mcp: "mcp",
      skill: "skills",
      knowledge_base: "kb",
      knowledge_graph: "kg",
    }
    for (const set of capabilitySets) {
      const ids = idsMap[legacyKeyByType[set.type]] ?? []
      const selected = set.items.filter((item) => ids.includes(item.id)).map((item) => item.id)
      if (selected.length > 0) {
        map[set.id] = selected
      }
    }
    return map
  }, [agent.capabilitySetBindings, capabilitySets, idsMap])

  const boundSets = useMemo(() => {
    return capabilitySets
      .map((set) => ({ set, selectedIds: selectedBySet[set.id] ?? [] }))
      .filter((entry) => entry.selectedIds.length > 0)
  }, [capabilitySets, selectedBySet])

  const sheetData = useMemo(() => {
    const entry = boundSets.find((item) => item.set.id === openSetId)
    if (!entry) return { title: "", description: "", items: [] as { name: string; description?: string; isActive: boolean }[] }
    return {
      title: capabilitySetTitle(entry.set, t),
      description: entry.set.description,
      items: entry.set.items
        .filter((item) => entry.selectedIds.includes(item.id))
        .map((item) => ({
          name: capabilityItemName(entry.set.type, item, t),
          description: item.description,
          isActive: item.isActive,
        })),
    }
  }, [boundSets, openSetId, t])

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ai:agents.bindings")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/45">
          {boundSets.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">{t("ai:agents.noCapabilitySets")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {boundSets.map(({ set, selectedIds }) => {
                const Icon = capabilitySetIcon(set.type)
                return (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => setOpenSetId(set.id)}
                    className="group rounded-xl border border-border/55 bg-background/30 px-4 py-3 text-left transition-colors hover:border-border/90 hover:bg-accent/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/55 bg-background/70 text-primary">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">{capabilitySetTitle(set, t)}</p>
                            <Badge variant="outline">{selectedIds.length}/{set.itemCount}</Badge>
                          </div>
                          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{set.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={openSetId !== null} onOpenChange={(open) => { if (!open) setOpenSetId(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border/50 pb-4">
            <SheetTitle>{sheetData.title}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              {sheetData.items.map((item, i) => (
                <div key={i} className="rounded-xl border border-border/55 bg-background/30 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    {!item.isActive && <Badge variant="secondary">{t("ai:agents.unavailable")}</Badge>}
                  </div>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function AgentConfiguration({ agent }: { agent: AgentWithBindings }) {
  const { t } = useTranslation(["ai"])

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ai:agents.sections.basic")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <span className="text-sm text-muted-foreground">{t("ai:agents.visibility")}</span>
              <p className="font-medium">{t(`ai:agents.visibilityOptions.${agent.visibility}`)}</p>
            </div>
            {agent.description && (
              <div className="col-span-2 sm:col-span-3">
                <span className="text-sm text-muted-foreground">{t("ai:agents.description")}</span>
                <p className="text-sm mt-1">{agent.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Model Config (assistant) */}
      {agent.type === "assistant" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ai:agents.sections.modelConfig")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
            </div>
            {agent.systemPrompt && (
              <div className="mt-4">
                <span className="text-sm text-muted-foreground">{t("ai:agents.systemPrompt")}</span>
                <pre className="mt-1 text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3 max-h-64 overflow-auto">{agent.systemPrompt}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Runtime Config (coding) */}
      {agent.type === "coding" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ai:agents.sections.execution")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <span className="text-sm text-muted-foreground">{t("ai:agents.runtime")}</span>
                <p className="font-medium">{agent.runtime ? t(`ai:agents.runtimes.${agent.runtime}`) : "-"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">{t("ai:agents.execMode")}</span>
                <p className="font-medium">{agent.execMode ? t(`ai:agents.execModes.${agent.execMode}`) : "-"}</p>
              </div>
              {agent.workspace && (
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-sm text-muted-foreground">{t("ai:agents.workspace")}</span>
                  <p className="font-mono text-sm">{agent.workspace}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <AgentBindingsCard agent={agent} />

      {/* Instructions */}
      {agent.instructions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ai:agents.sections.instructions")}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3 max-h-40 overflow-auto">{agent.instructions}</pre>
          </CardContent>
        </Card>
      )}
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

export function AgentDetailPage({ config }: { config: AgentDetailPageConfig }) {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation(["ai", "common"])
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: agent, isLoading } = useQuery({
    queryKey: [config.queryKey, id],
    queryFn: () => config.getApiFn(Number(id)),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => config.deleteApiFn(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [config.listQueryKey] })
      toast.success(t(`ai:${config.i18nKey}.deleteSuccess`))
      navigate(config.basePath)
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading || !agent) {
    return <div className="py-8 text-center text-muted-foreground">{t("common:loading")}</div>
  }

  const TypeIcon = TYPE_ICON[agent.type] ?? Bot

  return (
    <div className="workspace-page">
      <div className="workspace-page-header gap-4">
        <div className="min-w-0 flex-1">
          <nav className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link to={config.basePath} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t(`ai:${config.i18nKey}.title`)}
            </Link>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-foreground">{agent.name}</span>
          </nav>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-surface-soft/78 text-foreground/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <TypeIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="workspace-page-title">{agent.name}</h2>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={agent.isActive ? "default" : "secondary"}>
                  {agent.isActive ? t("ai:statusLabels.active") : t("ai:statusLabels.inactive")}
                </Badge>
                <span className="text-sm text-muted-foreground">{t(`ai:agents.agentTypes.${agent.type}`)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={!agent.isActive}
            onClick={() => navigate(`/ai/chat?agentId=${agent.id}&autostart=1`)}
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            {t("ai:chat.startChat")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`${config.basePath}/${id}/edit`)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {t("common:edit")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("common:delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t(`ai:${config.i18nKey}.deleteTitle`)}</AlertDialogTitle>
                <AlertDialogDescription>{t(`ai:${config.i18nKey}.deleteDesc`, { name: agent.name })}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                  {t(`ai:${config.i18nKey}.confirmDelete`)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="workspace-surface rounded-xl p-1.5" variant="default">
          <TabsTrigger value="config">{t("ai:agents.tabs.config")}</TabsTrigger>
          <TabsTrigger value="sessions">{t("ai:agents.tabs.sessions")}</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="pt-4">
          <AgentConfiguration agent={agent} />
        </TabsContent>
        <TabsContent value="sessions" className="pt-4">
          <AgentSessions agentId={agent.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
