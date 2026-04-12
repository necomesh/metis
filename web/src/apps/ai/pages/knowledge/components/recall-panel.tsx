import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Search, FileText, Link2 } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useKbSources } from "../hooks/use-kb-sources"
import type { NodeItem, SourceItem, SourceTextEntry } from "../types"

function RecallCard({
  node, rank, sources, sourceTextsMap, expandedId, expandedContent, loadingContent, onToggleExpand, t,
}: {
  node: NodeItem
  rank: number
  sources: SourceItem[]
  sourceTextsMap: Map<number, SourceTextEntry>
  expandedId: string | null
  expandedContent: Record<string, string>
  loadingContent: string | null
  onToggleExpand: (id: string) => void
  t: (key: string) => string
}) {
  const [showRawSource, setShowRawSource] = useState(false)
  const nodeSources = useMemo(() => {
    if (!node.sourceIds || node.sourceIds.length === 0 || sources.length === 0) return []
    return node.sourceIds
      .map(sid => sources.find(s => s.id === sid))
      .filter((s): s is SourceItem => s != null)
  }, [node.sourceIds, sources])

  const hasRawSource = !!node.sourceIds && node.sourceIds.some(sid => sourceTextsMap.has(sid))

  return (
    <div className="rounded-md border p-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium leading-snug">{node.title}</h4>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-primary font-medium bg-primary/10 rounded px-1.5 py-0.5">
            #{rank}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {node.edgeCount} {t("ai:knowledge.recall.edgeCount")}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{node.summary || "—"}</p>
      {(nodeSources.length > 0 || node.hasContent || hasRawSource) && (
        <div className="flex items-center justify-between mt-1.5">
          {nodeSources.length > 0 ? (
            <TooltipProvider delayDuration={100}>
              <div className="flex flex-wrap gap-1">
                {nodeSources.map(src => (
                  <Tooltip key={src.id}>
                    <TooltipTrigger asChild>
                      {src.sourceUrl ? (
                        <a
                          href={src.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border hover:bg-muted transition-colors"
                        >
                          <Link2 className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="max-w-[80px] truncate">{src.title}</span>
                        </a>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 cursor-default">
                          <FileText className="h-2.5 w-2.5" />
                          <span className="max-w-[80px] truncate">{src.title}</span>
                        </Badge>
                      )}
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="font-medium">{src.title}</p>
                      {src.sourceUrl && <p className="text-xs text-muted-foreground mt-0.5 break-all">{src.sourceUrl}</p>}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          ) : <span />}
          <div className="flex items-center gap-2 shrink-0">
            {hasRawSource && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setShowRawSource(prev => !prev)}
              >
                {t("ai:knowledge.recall.viewRawSource")}
              </button>
            )}
            {node.hasContent && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => onToggleExpand(node.id)}
              >
                {expandedId === node.id
                  ? t("ai:knowledge.recall.hideContent")
                  : t("ai:knowledge.recall.viewContent")}
              </button>
            )}
          </div>
        </div>
      )}
      {expandedId === node.id && (
        <div className="mt-2">
          {loadingContent === node.id ? (
            <p className="text-xs text-muted-foreground">{t("ai:knowledge.nodes.loadingContent")}</p>
          ) : (
            <pre className="rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
              {expandedContent[node.id] || t("ai:knowledge.nodes.noContent")}
            </pre>
          )}
        </div>
      )}
      {/* Raw source texts */}
      {showRawSource && hasRawSource && (
        <div className="mt-1.5 space-y-1.5">
          {node.sourceIds!.map(sid => {
            const entry = sourceTextsMap.get(sid)
            if (!entry) return null
            return (
              <div key={sid} className="rounded border p-2">
                <div className="flex items-center gap-1 mb-1">
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] font-medium truncate">{entry.title}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{entry.format}</Badge>
                </div>
                <pre className="rounded bg-muted p-1.5 text-[11px] font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto leading-relaxed">
                  {entry.content}
                </pre>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function RecallPanel({
  kbId,
  results,
  sourceTexts,
  isLoading,
  hasSearched,
  onSearch,
}: {
  kbId: number
  results: NodeItem[]
  sourceTexts?: SourceTextEntry[]
  isLoading: boolean
  hasSearched: boolean
  onSearch: (query: string) => void
}) {
  const { t } = useTranslation(["ai", "common"])
  const { data: sourcesData } = useKbSources(kbId)
  const sources = sourcesData?.items ?? []
  const [query, setQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedContent, setExpandedContent] = useState<Record<string, string>>({})
  const [loadingContent, setLoadingContent] = useState<string | null>(null)

  const sourceTextsMap = useMemo(() => {
    const m = new Map<number, SourceTextEntry>()
    if (sourceTexts) {
      for (const st of sourceTexts) m.set(st.id, st)
    }
    return m
  }, [sourceTexts])

  function handleSearch() {
    if (!query.trim()) return
    onSearch(query.trim())
  }

  async function toggleExpand(nodeId: string) {
    if (expandedId === nodeId) {
      setExpandedId(null)
      return
    }
    if (expandedContent[nodeId] === undefined) {
      setLoadingContent(nodeId)
      try {
        const resp = await api.get<NodeItem>(`/api/v1/ai/knowledge-bases/${kbId}/nodes/${nodeId}`)
        setExpandedContent(prev => ({ ...prev, [nodeId]: resp.content ?? "" }))
      } catch {
        setExpandedContent(prev => ({ ...prev, [nodeId]: "" }))
      } finally {
        setLoadingContent(null)
      }
    }
    setExpandedId(nodeId)
  }

  return (
    <div
      className="flex flex-col rounded-lg border bg-card overflow-hidden shrink-0 w-80"
      style={{ height: "calc(100vh - 280px)", minHeight: 400 }}
    >
      <div className="p-3 border-b">
        <h3 className="text-sm font-semibold mb-2">{t("ai:knowledge.recall.title")}</h3>
        <div className="flex gap-1.5">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ai:knowledge.recall.searchPlaceholder")}
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
          />
          <Button size="sm" className="h-8 px-2.5 shrink-0" onClick={handleSearch} disabled={isLoading}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!hasSearched ? (
          <p className="text-sm text-muted-foreground text-center mt-8">{t("ai:knowledge.recall.empty")}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground text-center mt-8">{t("common:loading")}</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">{t("ai:knowledge.recall.noResults")}</p>
        ) : (
          results.map((node, index) => (
            <RecallCard
              key={node.id}
              node={node}
              rank={index + 1}
              sources={sources}
              sourceTextsMap={sourceTextsMap}
              expandedId={expandedId}
              expandedContent={expandedContent}
              loadingContent={loadingContent}
              onToggleExpand={toggleExpand}
              t={t}
            />
          ))
        )}
      </div>
    </div>
  )
}
