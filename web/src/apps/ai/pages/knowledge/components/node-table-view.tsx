import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { BookOpen, ChevronDown, ChevronRight, FileText } from "lucide-react"
import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTableCard } from "@/components/ui/data-table"
import { useKbSources } from "../hooks/use-kb-sources"
import type { NodeItem, SourceItem } from "../types"

function NodeRow({ node, kbId, sources }: { node: NodeItem; kbId: number; sources: SourceItem[] }) {
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

  const nodeSources = useMemo(() => {
    if (!node.sourceIds || node.sourceIds.length === 0 || sources.length === 0) return []
    return node.sourceIds
      .map(sid => sources.find(s => s.id === sid))
      .filter((s): s is SourceItem => s != null)
  }, [node.sourceIds, sources])

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
            <Badge variant="outline" className="border-transparent bg-green-500/20 text-green-700 dark:bg-green-500/20 dark:text-green-400">
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
            {nodeSources.length > 0 && (
              <div className="mt-3 pt-2 border-t">
                <span className="text-xs font-medium text-muted-foreground">{t("knowledge.nodes.sources")}</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {nodeSources.map(src => (
                    <Badge key={src.id} variant="outline" className="text-xs gap-1">
                      <FileText className="h-3 w-3" />
                      {src.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function NodeTableView({ kbId }: { kbId: number }) {
  const { t } = useTranslation(["ai", "common"])

  const { data, isLoading } = useQuery({
    queryKey: ["ai-kb-nodes", kbId],
    queryFn: () => api.get<{ items: NodeItem[]; total: number }>(
      `/api/v1/ai/knowledge-bases/${kbId}/nodes?pageSize=100`,
    ),
  })
  const nodes = data?.items ?? []

  const { data: sourcesData } = useKbSources(kbId)
  const sources = sourcesData?.items ?? []

  return (
    <DataTableCard>
      {!isLoading && data && data.total > nodes.length && (
        <div className="px-4 pt-3 text-xs text-muted-foreground">
          {t("ai:knowledge.nodes.showingFirst", { count: nodes.length, total: data.total })}
        </div>
      )}
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
            nodes.map((node) => <NodeRow key={node.id} node={node} kbId={kbId} sources={sources} />)
          )}
        </TableBody>
      </Table>
    </DataTableCard>
  )
}
