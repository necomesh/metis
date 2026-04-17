import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { WFNodeData } from "../types"
import { NODE_COLORS } from "../types"

const GATEWAY_SYMBOLS: Record<string, string> = {
  exclusive: "✕",
  parallel: "✛",
  inclusive: "○",
}

function GatewayNodeInner({ data, selected }: NodeProps & { data: WFNodeData }) {
  const nodeType = data.nodeType
  const color = NODE_COLORS[nodeType] ?? "#f97316"
  const symbol = GATEWAY_SYMBOLS[nodeType] ?? "?"

  return (
    <div className="relative" style={{ width: 56, height: 56 }}>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div
        className={`flex h-14 w-14 rotate-45 items-center justify-center rounded-sm border-2 shadow-md ${selected ? "ring-2 ring-primary" : ""}`}
        style={{ borderColor: color, backgroundColor: `${color}20` }}
      >
        <span className="-rotate-45 text-lg font-bold" style={{ color }}>
          {symbol}
        </span>
      </div>
      <div
        className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium"
        style={{ color }}
      >
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  )
}

export const GatewayNode = memo(GatewayNodeInner)
