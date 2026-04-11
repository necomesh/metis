import { useState } from "react"
import { useParams, Link } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft, RefreshCw, BookOpen, ChevronDown, ChevronRight, FileText, Globe,
  Plus, History,
} from "lucide-react"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTableCard } from "@/components/ui/data-table"
import { formatDateTime } from "@/lib/utils"
import { usePermission } from "@/hooks/use-permission"
import { SourceUpload } from "./components/source-upload"
import { UrlAddForm } from "./components/url-add-form"

interface KnowledgeBaseDetail {
  id: number
  name: string
  description: string
  sourceCount: number
  nodeCount: number
  compileStatus: string
  compileModelId: number
  autoCompile: boolean
  crawlEnabled: boolean
  crawlSchedule: string
  createdAt: string
  updatedAt: string
}

interface SourceItem {
  id: number
  title: string
  format: string
  extractStatus: string
  byteSize: number
  sourceType: string
  createdAt: string
}

interface NodeItem {
  id: number
  title: string
  summary: string
  hasContent: boolean
  edgeCount: number
  content?: string
}

type CompileStatus = "idle" | "compiling" | "completed" | "error"

interface LogItem {
  id: number
  action: string
  modelId: string
  nodesCreated: number
  nodesUpdated: number
  edgesCreated: number
  lintIssues: number
  errorMessage: string
  createdAt: string
}

function CompileStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("ai")
  const s = status as CompileStatus

  if (s === "compiling") {
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse">
        {t("knowledge.compileStatus.compiling")}
      </Badge>
    )
  }
  if (s === "completed") {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        {t("knowledge.compileStatus.completed")}
      </Badge>
    )
  }
  if (s === "error") {
    return (
      <Badge variant="destructive">
        {t("knowledge.compileStatus.error")}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      {t("knowledge.compileStatus.idle")}
    </Badge>
  )
}

function ExtractStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("ai")
  if (status === "completed") {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        {t("knowledge.extractStatus.completed")}
      </Badge>
    )
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive">
        {t("knowledge.extractStatus.failed")}
      </Badge>
    )
  }
  if (status === "processing") {
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse">
        {t("knowledge.extractStatus.processing")}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      {t("knowledge.extractStatus.pending")}
    </Badge>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Sources Tab ─────────────────────────────────────────────────────────────

function SourcesTab({ kbId, canCreate }: { kbId: number; canCreate: boolean }) {
  const { t } = useTranslation(["ai", "common"])
  const queryClient = useQueryClient()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [urlFormOpen, setUrlFormOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["ai-kb-sources", kbId],
    queryFn: () => api.get<{ items: SourceItem[]; total: number }>(
      `/api/v1/ai/knowledge-bases/${kbId}/sources?pageSize=100`,
    ),
  })
  const sources = data?.items ?? []

  const deleteMutation = useMutation({
    mutationFn: (sourceId: number) =>
      api.delete(`/api/v1/ai/knowledge-bases/${kbId}/sources/${sourceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-kb-sources", kbId] })
      queryClient.invalidateQueries({ queryKey: ["ai-kb-detail", kbId] })
      toast.success(t("ai:knowledge.sources.deleteSuccess"))
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("ai:knowledge.sources.uploadFile")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setUrlFormOpen(true)}>
            <Globe className="mr-1.5 h-4 w-4" />
            {t("ai:knowledge.sources.addUrl")}
          </Button>
        </div>
      )}

      <DataTableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">{t("ai:knowledge.sources.title")}</TableHead>
              <TableHead className="w-[100px]">{t("ai:knowledge.sources.format")}</TableHead>
              <TableHead className="w-[120px]">{t("ai:knowledge.sources.extractStatus")}</TableHead>
              <TableHead className="w-[100px]">{t("ai:knowledge.sources.size")}</TableHead>
              <TableHead className="w-[150px]">{t("common:createdAt")}</TableHead>
              <TableHead className="w-[80px] text-right">{t("common:actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                  {t("common:loading")}
                </TableCell>
              </TableRow>
            ) : sources.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-44 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="h-10 w-10 stroke-1" />
                    <p className="text-sm font-medium">{t("ai:knowledge.sources.empty")}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sources.map((src) => (
                <TableRow key={src.id}>
                  <TableCell className="font-medium">{src.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{src.format || src.sourceType}</Badge>
                  </TableCell>
                  <TableCell>
                    <ExtractStatusBadge status={src.extractStatus} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatBytes(src.byteSize)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(src.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 text-destructive hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(src.id)}
                    >
                      {t("common:delete")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataTableCard>

      <SourceUpload
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        kbId={kbId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["ai-kb-sources", kbId] })
          queryClient.invalidateQueries({ queryKey: ["ai-kb-detail", kbId] })
        }}
      />
      <UrlAddForm
        open={urlFormOpen}
        onOpenChange={setUrlFormOpen}
        kbId={kbId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["ai-kb-sources", kbId] })
          queryClient.invalidateQueries({ queryKey: ["ai-kb-detail", kbId] })
        }}
      />
    </div>
  )
}

// ─── Knowledge Graph Tab ──────────────────────────────────────────────────────

function NodeRow({ node, kbId }: { node: NodeItem; kbId: number }) {
  const { t } = useTranslation("ai")
  const [expanded, setExpanded] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)

  async function toggleExpand() {
    if (!expanded && node.hasContent && content === null) {
      setLoadingContent(true)
      try {
        const data = await api.get<NodeItem>(`/api/v1/ai/knowledge-bases/${kbId}/nodes/${node.id}`)
        setContent(data.content ?? "")
      } catch {
        setContent("")
      } finally {
        setLoadingContent(false)
      }
    }
    setExpanded((prev) => !prev)
  }

  return (
    <>
      <TableRow className="cursor-pointer" onClick={toggleExpand}>
        <TableCell className="w-[40px] pr-0">
          {node.hasContent ? (
            expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <span className="h-4 w-4 block" />
          )}
        </TableCell>
        <TableCell className="font-medium">{node.title}</TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
          {node.summary || "—"}
        </TableCell>
        <TableCell className="text-sm text-center">{node.edgeCount}</TableCell>
        <TableCell>
          {node.hasContent && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {t("knowledge.nodes.hasContent")}
            </Badge>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell />
          <TableCell colSpan={4} className="pb-4">
            {loadingContent ? (
              <p className="text-sm text-muted-foreground">{t("knowledge.nodes.loadingContent")}</p>
            ) : (
              <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                {content || t("knowledge.nodes.noContent")}
              </pre>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function KnowledgeGraphTab({ kbId }: { kbId: number }) {
  const { t } = useTranslation(["ai", "common"])

  const { data, isLoading } = useQuery({
    queryKey: ["ai-kb-nodes", kbId],
    queryFn: () => api.get<{ items: NodeItem[]; total: number }>(
      `/api/v1/ai/knowledge-bases/${kbId}/nodes?pageSize=100`,
    ),
  })
  const nodes = data?.items ?? []

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]" />
            <TableHead className="min-w-[160px]">{t("ai:knowledge.nodes.title")}</TableHead>
            <TableHead className="min-w-[200px]">{t("ai:knowledge.nodes.summary")}</TableHead>
            <TableHead className="w-[90px] text-center">{t("ai:knowledge.nodes.edgeCount")}</TableHead>
            <TableHead className="w-[100px]">{t("ai:knowledge.nodes.content")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="h-28 text-center text-sm text-muted-foreground">
                {t("common:loading")}
              </TableCell>
            </TableRow>
          ) : nodes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-44 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-10 w-10 stroke-1" />
                  <p className="text-sm font-medium">{t("ai:knowledge.nodes.empty")}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            nodes.map((node) => <NodeRow key={node.id} node={node} kbId={kbId} />)
          )}
        </TableBody>
      </Table>
    </DataTableCard>
  )
}

// ─── Compile Logs Tab ─────────────────────────────────────────────────────────

function CompileLogsTab({ kbId }: { kbId: number }) {
  const { t } = useTranslation(["ai", "common"])

  const { data, isLoading } = useQuery({
    queryKey: ["ai-kb-logs", kbId],
    queryFn: () => api.get<{ items: LogItem[]; total: number }>(
      `/api/v1/ai/knowledge-bases/${kbId}/logs?pageSize=50`,
    ),
  })
  const logs = data?.items ?? []

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">{t("common:createdAt")}</TableHead>
            <TableHead className="w-[100px]">{t("ai:knowledge.logs.action")}</TableHead>
            <TableHead className="w-[140px]">{t("ai:knowledge.logs.model")}</TableHead>
            <TableHead className="w-[80px] text-center">{t("ai:knowledge.logs.created")}</TableHead>
            <TableHead className="w-[80px] text-center">{t("ai:knowledge.logs.updated")}</TableHead>
            <TableHead className="w-[80px] text-center">{t("ai:knowledge.logs.edges")}</TableHead>
            <TableHead className="w-[80px] text-center">{t("ai:knowledge.logs.lint")}</TableHead>
            <TableHead>{t("ai:knowledge.logs.error")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="h-28 text-center text-sm text-muted-foreground">
                {t("common:loading")}
              </TableCell>
            </TableRow>
          ) : logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-44 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <History className="h-10 w-10 stroke-1" />
                  <p className="text-sm font-medium">{t("ai:knowledge.logs.empty")}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDateTime(log.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={log.action === "recompile" ? "secondary" : "outline"}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-[140px]">
                  {log.modelId || "—"}
                </TableCell>
                <TableCell className="text-center text-sm">{log.nodesCreated}</TableCell>
                <TableCell className="text-center text-sm">{log.nodesUpdated}</TableCell>
                <TableCell className="text-center text-sm">{log.edgesCreated}</TableCell>
                <TableCell className="text-center text-sm">
                  {log.lintIssues > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">{log.lintIssues}</span>
                  ) : "0"}
                </TableCell>
                <TableCell className="text-sm text-destructive truncate max-w-[200px]">
                  {log.errorMessage || ""}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </DataTableCard>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Component() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation(["ai", "common"])
  const queryClient = useQueryClient()
  const kbId = Number(id)

  const canCreate = usePermission("ai:knowledge:create")
  const canCompile = usePermission("ai:knowledge:compile")

  const { data: kb, isLoading } = useQuery({
    queryKey: ["ai-kb-detail", kbId],
    queryFn: () => api.get<KnowledgeBaseDetail>(`/api/v1/ai/knowledge-bases/${kbId}`),
    enabled: !Number.isNaN(kbId),
  })

  const compileMutation = useMutation({
    mutationFn: () => api.post(`/api/v1/ai/knowledge-bases/${kbId}/compile`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-kb-detail", kbId] })
      toast.success(t("ai:knowledge.compileStarted"))
    },
    onError: (err) => toast.error(err.message),
  })

  const recompileMutation = useMutation({
    mutationFn: () => api.post(`/api/v1/ai/knowledge-bases/${kbId}/recompile`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-kb-detail", kbId] })
      toast.success(t("ai:knowledge.compileStarted"))
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        {t("common:loading")}
      </div>
    )
  }

  if (!kb) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        {t("ai:knowledge.notFound")}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/ai/knowledge">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold truncate">{kb.name}</h2>
            <CompileStatusBadge status={kb.compileStatus} />
          </div>
          {kb.description && (
            <p className="text-sm text-muted-foreground truncate">{kb.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-3 text-sm text-muted-foreground mr-2">
            <span>{t("ai:knowledge.sourceCount")}: {kb.sourceCount}</span>
            <span>{t("ai:knowledge.nodeCount")}: {kb.nodeCount}</span>
          </div>
          {canCompile && (
            <Button
              size="sm"
              variant="outline"
              disabled={compileMutation.isPending || recompileMutation.isPending || kb.compileStatus === "compiling"}
              onClick={() => {
                if (kb.compileStatus === "completed") {
                  recompileMutation.mutate()
                } else {
                  compileMutation.mutate()
                }
              }}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              {kb.compileStatus === "completed"
                ? t("ai:knowledge.recompile")
                : t("ai:knowledge.compile")}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">{t("ai:knowledge.tabs.sources")}</TabsTrigger>
          <TabsTrigger value="graph">{t("ai:knowledge.tabs.graph")}</TabsTrigger>
          <TabsTrigger value="logs">{t("ai:knowledge.tabs.logs")}</TabsTrigger>
        </TabsList>
        <TabsContent value="sources" className="mt-4">
          <SourcesTab kbId={kbId} canCreate={canCreate} />
        </TabsContent>
        <TabsContent value="graph" className="mt-4">
          <KnowledgeGraphTab kbId={kbId} />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <CompileLogsTab kbId={kbId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
