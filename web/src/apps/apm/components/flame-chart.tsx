import { useRef, useEffect, useMemo, useState, useCallback } from "react"
import type { Span } from "../api"

const SERVICE_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#6366f1", // indigo
  "#f97316", // orange
]

const MIN_BLOCK_WIDTH = 2
const ROW_HEIGHT = 22
const ROW_GAP = 1
const PADDING_TOP = 8
const PADDING_LEFT = 0

interface SpanBlock {
  span: Span
  x: number
  y: number
  width: number
  depth: number
  colorIdx: number
  isCritical: boolean
}

function computeDepths(spans: Span[]): Map<string, number> {
  const map = new Map<string, Span>()
  for (const s of spans) map.set(s.spanId, s)

  const depths = new Map<string, number>()

  function getDepth(spanId: string): number {
    if (depths.has(spanId)) return depths.get(spanId)!
    const span = map.get(spanId)!
    if (!span.parentSpanId || !map.has(span.parentSpanId)) {
      depths.set(spanId, 0)
      return 0
    }
    const d = getDepth(span.parentSpanId) + 1
    depths.set(spanId, d)
    return d
  }

  for (const s of spans) getDepth(s.spanId)
  return depths
}

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

  const roots = spans.filter((s) => !s.parentSpanId || !map.has(s.parentSpanId))
  let bestRoot = { duration: 0, path: [] as string[] }
  for (const root of roots) {
    const result = longestPath(root.spanId)
    if (result.duration > bestRoot.duration) bestRoot = result
  }
  return new Set(bestRoot.path)
}

interface FlameChartProps {
  spans: Span[]
  selectedSpanId?: string | null
  onSelectSpan?: (span: Span) => void
}

export function FlameChart({ spans, selectedSpanId, onSelectSpan }: FlameChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; span: Span } | null>(null)
  const [canvasWidth, setCanvasWidth] = useState(800)

  const { blocks, canvasHeight } = useMemo(() => {
    if (spans.length === 0) return { blocks: [], canvasHeight: 100, serviceColorMap: new Map<string, number>() }

    const depths = computeDepths(spans)
    const criticalPath = findCriticalPath(spans)

    let minTime = Infinity
    let maxTime = -Infinity
    for (const span of spans) {
      const start = new Date(span.startTime).getTime()
      const end = start + span.duration / 1e6
      if (start < minTime) minTime = start
      if (end > maxTime) maxTime = end
    }
    const totalDuration = maxTime - minTime

    const svcList = [...new Set(spans.map((s) => s.serviceName))]
    const colorMap = new Map<string, number>()
    svcList.forEach((svc, i) => colorMap.set(svc, i % SERVICE_COLORS.length))

    let maxDepth = 0
    const blocks: SpanBlock[] = spans.map((span) => {
      const depth = depths.get(span.spanId) ?? 0
      if (depth > maxDepth) maxDepth = depth
      const startMs = new Date(span.startTime).getTime() - minTime
      const durationMs = span.duration / 1e6
      const x = PADDING_LEFT + (totalDuration > 0 ? (startMs / totalDuration) * canvasWidth : 0)
      const w = totalDuration > 0 ? Math.max((durationMs / totalDuration) * canvasWidth, MIN_BLOCK_WIDTH) : canvasWidth
      const y = PADDING_TOP + depth * (ROW_HEIGHT + ROW_GAP)

      return {
        span,
        x,
        y,
        width: w,
        depth,
        colorIdx: colorMap.get(span.serviceName) ?? 0,
        isCritical: criticalPath.has(span.spanId),
      }
    })

    const height = PADDING_TOP + (maxDepth + 1) * (ROW_HEIGHT + ROW_GAP) + 8

    return { blocks, canvasHeight: height, serviceColorMap: colorMap }
  }, [spans, canvasWidth])

  // Observe container width
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(entry.contentRect.width)
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    for (const block of blocks) {
      const color = block.span.statusCode === "STATUS_CODE_ERROR"
        ? "#ef4444"
        : SERVICE_COLORS[block.colorIdx]
      const isSelected = selectedSpanId === block.span.spanId

      ctx.fillStyle = isSelected ? color : `${color}cc`
      ctx.fillRect(block.x, block.y, block.width, ROW_HEIGHT)

      // Critical path border
      if (block.isCritical) {
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2
        ctx.strokeRect(block.x, block.y, block.width, ROW_HEIGHT)
      }

      // Selected highlight
      if (isSelected) {
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2
        ctx.strokeRect(block.x, block.y, block.width, ROW_HEIGHT)
      }

      // Text label if block is wide enough
      if (block.width > 40) {
        ctx.fillStyle = "#ffffff"
        ctx.font = "10px ui-monospace, monospace"
        ctx.textBaseline = "middle"
        const label = `${block.span.serviceName} ${block.span.spanName}`
        const maxChars = Math.floor((block.width - 8) / 6)
        const text = label.length > maxChars ? label.slice(0, maxChars - 1) + "…" : label
        ctx.fillText(text, block.x + 4, block.y + ROW_HEIGHT / 2)
      }
    }
  }, [blocks, canvasWidth, canvasHeight, selectedSpanId])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const hit = blocks.find(
        (b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + ROW_HEIGHT,
      )

      if (hit) {
        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, span: hit.span })
      } else {
        setTooltip(null)
      }
    },
    [blocks],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const hit = blocks.find(
        (b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + ROW_HEIGHT,
      )
      if (hit) onSelectSpan?.(hit.span)
    },
    [blocks, onSelectSpan],
  )

  if (spans.length === 0) return null

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        style={{ width: canvasWidth, height: canvasHeight, cursor: "pointer" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onClick={handleClick}
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg text-xs"
          style={{
            left: Math.min(tooltip.x + 12, canvasWidth - 200),
            top: tooltip.y + 12,
          }}
        >
          <div className="font-medium">{tooltip.span.serviceName}</div>
          <div className="text-muted-foreground">{tooltip.span.spanName}</div>
          <div className="mt-1 font-mono">{(tooltip.span.duration / 1e6).toFixed(2)}ms</div>
        </div>
      )}
    </div>
  )
}
