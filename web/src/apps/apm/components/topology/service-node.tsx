import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Globe, Server, CreditCard, Package, Bell, Database, Cpu } from "lucide-react"
import type { TopologyNode } from "../../api"

export type ServiceNodeData = TopologyNode & {
  colorMode?: "errorRate" | "latency" | "throughput"
  p95Ms?: number
  filtered?: boolean // true = 不匹配搜索，降低 opacity
}

// --- Icon mapping ---
const ICON_RULES: [RegExp, typeof Server][] = [
  [/gateway|api-gw|nginx|ingress|proxy|edge/i, Globe],
  [/pay|billing|stripe|checkout/i, CreditCard],
  [/inventory|stock|warehouse|product|catalog/i, Package],
  [/notif|email|sms|alert|push|message/i, Bell],
  [/db|database|redis|postgres|mysql|mongo|cache/i, Database],
  [/worker|queue|consumer|scheduler|cron/i, Cpu],
]

export function getServiceIcon(name: string) {
  for (const [re, Icon] of ICON_RULES) {
    if (re.test(name)) return Icon
  }
  return Server
}

// --- Health ---
type HealthLevel = "critical" | "warning" | "healthy"

export function getHealthLevel(errorRate: number): HealthLevel {
  if (errorRate > 5) return "critical"
  if (errorRate > 1) return "warning"
  return "healthy"
}

const RING_COLOR: Record<HealthLevel, string> = {
  critical: "ring-red-500 shadow-red-500/20",
  warning: "ring-amber-500 shadow-amber-500/15",
  healthy: "ring-emerald-500 shadow-emerald-500/10",
}

const ICON_BG: Record<HealthLevel, string> = {
  critical: "bg-red-500/15 text-red-500",
  warning: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  healthy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
}

// --- Color by latency / throughput ---
function getLatencyHealth(p95Ms: number | undefined, _errorRate: number): HealthLevel {
  if (!p95Ms) return getHealthLevel(_errorRate) // fallback
  if (p95Ms > 500) return "critical"
  if (p95Ms > 100) return "warning"
  return "healthy"
}

function getThroughputColor(requestCount: number): string {
  if (requestCount > 500) return "ring-violet-500 shadow-violet-500/15"
  if (requestCount > 100) return "ring-blue-500 shadow-blue-500/15"
  return "ring-sky-400 shadow-sky-400/10"
}

function getThroughputIconBg(requestCount: number): string {
  if (requestCount > 500) return "bg-violet-500/12 text-violet-500"
  if (requestCount > 100) return "bg-blue-500/10 text-blue-600 dark:text-blue-400"
  return "bg-sky-400/10 text-sky-600 dark:text-sky-400"
}

export const ServiceNode = memo(function ServiceNode({ data, selected }: NodeProps) {
  const node = data as ServiceNodeData
  const colorMode = node.colorMode ?? "errorRate"
  const Icon = getServiceIcon(node.serviceName)

  // Determine ring + icon bg based on color mode
  let ringClass: string
  let iconBgClass: string

  if (colorMode === "latency") {
    const h = getLatencyHealth(node.p95Ms, node.errorRate)
    ringClass = RING_COLOR[h]
    iconBgClass = ICON_BG[h]
  } else if (colorMode === "throughput") {
    ringClass = getThroughputColor(node.requestCount)
    iconBgClass = getThroughputIconBg(node.requestCount)
  } else {
    const h = getHealthLevel(node.errorRate)
    ringClass = RING_COLOR[h]
    iconBgClass = ICON_BG[h]
  }

  return (
    <div
      className={`flex flex-col items-center transition-opacity duration-200 ${
        node.filtered ? "opacity-[0.15]" : "opacity-100"
      }`}
    >
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-muted-foreground/20 !border-0 !top-[28px]"
      />

      {/* Circle node */}
      <div
        className={`
          relative flex items-center justify-center
          w-14 h-14 rounded-full
          ring-[3px] ${ringClass}
          ${selected ? "ring-primary !shadow-lg !ring-[3px]" : ""}
          bg-card border border-border/50
          cursor-pointer transition-all duration-200
          hover:scale-110 hover:shadow-lg
          shadow-sm
        `}
      >
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${iconBgClass}`}>
          <Icon className="w-4 h-4" strokeWidth={2} />
        </div>
      </div>

      {/* Label below */}
      <span className="mt-1.5 text-[11px] font-medium text-foreground max-w-[90px] truncate text-center leading-tight">
        {node.serviceName}
      </span>

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-muted-foreground/20 !border-0 !top-[28px]"
      />
    </div>
  )
})
