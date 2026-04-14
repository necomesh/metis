import { useMemo, useState, useCallback } from "react"
import { ChevronRight, ChevronDown, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { Span } from "../api"

const SERVICE_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-orange-500",
]

const SERVICE_BORDER_COLORS = [
  "border-blue-500",
  "border-emerald-500",
  "border-violet-500",
  "border-amber-500",
  "border-cyan-500",
  "border-pink-500",
  "border-indigo-500",
  "border-orange-500",
]

const SERVICE_DOT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-orange-500",
]

interface SpanNode {
  span: Span
  children: SpanNode[]
  depth: number
  childCount: number
}

function buildTree(spans: Span[]): SpanNode[] {
  const map = new Map<string, SpanNode>()
  const roots: SpanNode[] = []

  for (const span of spans) {
    map.set(span.spanId, { span, children: [], depth: 0, childCount: 0 })
  }

  for (const node of map.values()) {
    if (node.span.parentSpanId && map.has(node.span.parentSpanId)) {
      const parent = map.get(node.span.parentSpanId)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function sortAndCount(node: SpanNode): number {
    node.children.sort((a, b) => new Date(a.span.startTime).getTime() - new Date(b.span.startTime).getTime())
    let count = node.children.length
    for (const child of node.children) {
      count += sortAndCount(child)
    }
    node.childCount = count
    return count
  }
  roots.forEach(sortAndCount)

  return roots
}

function flattenTree(nodes: SpanNode[], collapsedSet: Set<string>): SpanNode[] {
  const result: SpanNode[] = []
  function walk(node: SpanNode) {
    result.push(node)
    if (!collapsedSet.has(node.span.spanId)) {
      node.children.forEach(walk)
    }
  }
  nodes.forEach(walk)
  return result
}

/** Find the critical path (longest chain) */
function findCriticalPath(spans: Span[]): Set<string> {
  const map = new Map<string, Span>()
  for (const s of spans) map.set(s.spanId, s)

  const childrenMap = new Map<string, Span[]>()
  for (const s of spans) {
    if (s.parentSpanId && map.has(s.parentSpanId)) {
      const arr = childrenMap.get(s.parentSpanId) ?? []
      arr.push(s)
      childrenMap.set(s.parentSpanId, arr)
    }
  }

  // For each span, compute the longest path ending at it
  const memo = new Map<string, { duration: number; path: string[] }>()

  function longestPath(spanId: string): { duration: number; path: string[] } {
    if (memo.has(spanId)) return memo.get(spanId)!
    const span = map.get(spanId)!
    const dur = span.duration / 1e6
    const children = childrenMap.get(spanId) ?? []

    if (children.length === 0) {
      const result = { duration: dur, path: [spanId] }
      memo.set(spanId, result)
      return result
    }

    let best = { duration: 0, path: [] as string[] }
    for (const child of children) {
      const sub = longestPath(child.spanId)
      if (sub.duration > best.duration) best = sub
    }

    const result = { duration: dur + best.duration, path: [spanId, ...best.path] }
    memo.set(spanId, result)
    return result
  }

  // Find root spans
  const roots = spans.filter((s) => !s.parentSpanId || !map.has(s.parentSpanId))
  let bestRoot = { duration: 0, path: [] as string[] }
  for (const root of roots) {
    const result = longestPath(root.spanId)
    if (result.duration > bestRoot.duration) bestRoot = result
  }

  return new Set(bestRoot.path)
}

interface WaterfallChartProps {
  spans: Span[]
  selectedSpanId?: string | null
  onSelectSpan?: (span: Span) => void
}

export function WaterfallChart({ spans, selectedSpanId, onSelectSpan }: WaterfallChartProps) {
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")

  const toggleCollapse = useCallback((spanId: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev)
      if (next.has(spanId)) next.delete(spanId)
      else next.add(spanId)
      return next
    })
  }, [])

  const { tree, traceStart, traceDuration, serviceColorMap, services, criticalPathSet } = useMemo(() => {
    const tree = buildTree(spans)

    let minTime = Infinity
    let maxTime = -Infinity
    for (const span of spans) {
      const start = new Date(span.startTime).getTime()
      const end = start + span.duration / 1e6
      if (start < minTime) minTime = start
      if (end > maxTime) maxTime = end
    }

    const svcList = [...new Set(spans.map((s) => s.serviceName))]
    const colorMap = new Map<string, number>()
    svcList.forEach((svc, i) => {
      colorMap.set(svc, i % SERVICE_COLORS.length)
    })

    const criticalPath = findCriticalPath(spans)

    return {
      tree,
      traceStart: minTime,
      traceDuration: maxTime - minTime,
      serviceColorMap: colorMap,
      services: svcList,
      criticalPathSet: criticalPath,
    }
  }, [spans])

  const flatNodes = useMemo(() => flattenTree(tree, collapsedSet), [tree, collapsedSet])

  const searchLower = searchQuery.toLowerCase()
  const matchingSpanIds = useMemo(() => {
    if (!searchLower) return null
    const ids = new Set<string>()
    for (const span of spans) {
      if (
        span.serviceName.toLowerCase().includes(searchLower) ||
        span.spanName.toLowerCase().includes(searchLower) ||
        span.spanId.toLowerCase().includes(searchLower)
      ) {
        ids.add(span.spanId)
      }
    }
    return ids
  }, [spans, searchLower])

  if (spans.length === 0) return null

  // Time ruler ticks (5 divisions)
  const ticks = Array.from({ length: 6 }, (_, i) => ({
    pct: (i / 5) * 100,
    label: `${((traceDuration * i) / 5).toFixed(1)}ms`,
  }))

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="Search spans..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-7 pl-7 text-xs"
        />
      </div>

      {/* Service legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {services.map((svc) => {
          const idx = serviceColorMap.get(svc) ?? 0
          return (
            <div key={svc} className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${SERVICE_DOT_COLORS[idx]}`} />
              <span>{svc}</span>
            </div>
          )
        })}
      </div>

      {/* Time ruler */}
      <div className="relative h-5" style={{ marginLeft: 240 }}>
        {ticks.map((tick) => (
          <div
            key={tick.pct}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${tick.pct}%` }}
          >
            <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">{tick.label}</span>
          </div>
        ))}
      </div>

      {/* Span rows */}
      <div className="space-y-0.5">
        {flatNodes.map((node) => {
          const span = node.span
          const startMs = new Date(span.startTime).getTime() - traceStart
          const durationMs = span.duration / 1e6
          const leftPct = traceDuration > 0 ? (startMs / traceDuration) * 100 : 0
          const widthPct = traceDuration > 0 ? Math.max((durationMs / traceDuration) * 100, 0.5) : 100
          const isError = span.statusCode === "STATUS_CODE_ERROR"
          const colorIdx = serviceColorMap.get(span.serviceName) ?? 0
          const colorClass = isError ? "bg-red-500" : SERVICE_COLORS[colorIdx]
          const isCritical = criticalPathSet.has(span.spanId)
          const isCollapsed = collapsedSet.has(span.spanId)
          const hasChildren = node.childCount > 0
          const isSelected = selectedSpanId === span.spanId

          const isSearchMatch = matchingSpanIds === null || matchingSpanIds.has(span.spanId)

          return (
            <button
              key={span.spanId}
              type="button"
              className={`group flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors ${
                isSelected ? "bg-accent" : "hover:bg-muted/50"
              } ${!isSearchMatch ? "opacity-30" : ""}`}
              onClick={() => onSelectSpan?.(span)}
            >
              {/* Label */}
              <div
                className="shrink-0 flex items-center gap-1 truncate text-xs"
                style={{ width: 232, paddingLeft: `${node.depth * 16}px` }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCollapse(span.spanId)
                    }}
                  >
                    {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                ) : (
                  <span className="w-4" />
                )}
                <span className="font-medium text-foreground truncate">{span.serviceName}</span>
                <span className="text-muted-foreground truncate">{span.spanName}</span>
                {isCollapsed && hasChildren && (
                  <span className="text-[10px] text-muted-foreground/60">+{node.childCount}</span>
                )}
              </div>

              {/* Bar area */}
              <div className="relative h-6 flex-1 rounded bg-muted/30">
                {/* Grid lines from time ruler */}
                {ticks.map((tick) => (
                  <div
                    key={tick.pct}
                    className="absolute top-0 bottom-0 border-l border-dashed border-muted-foreground/10"
                    style={{ left: `${tick.pct}%` }}
                  />
                ))}
                <div
                  className={`absolute top-0.5 bottom-0.5 rounded-sm ${colorClass} opacity-80 group-hover:opacity-100 transition-opacity ${
                    isCritical ? `border-l-2 ${SERVICE_BORDER_COLORS[colorIdx]}` : ""
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    minWidth: "2px",
                  }}
                />
                <span
                  className="absolute top-0.5 text-[10px] font-mono text-muted-foreground leading-5"
                  style={{ left: `${Math.min(leftPct + widthPct + 0.5, 92)}%` }}
                >
                  {durationMs.toFixed(1)}ms
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
