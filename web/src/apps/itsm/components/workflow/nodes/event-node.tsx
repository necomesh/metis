import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Play, Square, Clock, Zap } from "lucide-react"
import type { WFNodeData } from "../types"
import { NODE_COLORS } from "../types"

const EVENT_ICONS: Record<string, typeof Play> = {
  start: Play,
  end: Square,
  timer: Clock,
  signal: Zap,
}

function EventNodeInner({ data, selected }: NodeProps & { data: WFNodeData }) {
  const nodeType = data.nodeType
  const Icon = EVENT_ICONS[nodeType] ?? Play
  const color = NODE_COLORS[nodeType] ?? "#6b7280"
  const isStart = nodeType === "start"
  const isEnd = nodeType === "end"
  const isIntermediate = nodeType === "timer" || nodeType === "signal"

  const borderWidth = isEnd ? 3 : isIntermediate ? 2 : 1

  return (
    <div
      className={`flex items-center justify-center rounded-full shadow-md ${selected ? "ring-2 ring-primary" : ""}`}
      style={{
        width: isStart || isEnd ? 100 : 56,
        height: isStart || isEnd ? 40 : 56,
        borderWidth,
        borderStyle: "solid",
        borderColor: color,
        backgroundColor: `${color}18`,
        ...(isIntermediate ? { outline: `2px solid ${color}`, outlineOffset: 2 } : {}),
      }}
    >
      {!isStart && <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />}
      <div className="flex items-center gap-1.5">
        <Icon style={{ color }} size={isStart || isEnd ? 16 : 20} />
        {(isStart || isEnd) && (
          <span className="text-sm font-semibold" style={{ color }}>{data.label}</span>
        )}
      </div>
      {!isEnd && <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />}
      {isIntermediate && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium" style={{ color }}>
          {data.label}
        </div>
      )}
    </div>
  )
}

export const EventNode = memo(EventNodeInner)
