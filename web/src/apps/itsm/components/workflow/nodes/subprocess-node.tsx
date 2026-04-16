import { memo, useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Layers, Plus, Minus } from "lucide-react"
import type { WFNodeData } from "../types"
import { NODE_COLORS } from "../types"

function SubprocessNodeInner({ data, selected }: NodeProps & { data: WFNodeData }) {
  const color = NODE_COLORS.subprocess
  const [expanded, setExpanded] = useState(data.subprocessExpanded ?? false)

  return (
    <div
      className={`min-w-[220px] rounded-lg border-[3px] shadow-md ${selected ? "ring-2 ring-primary" : ""}`}
      style={{ borderColor: color, backgroundColor: `${color}08` }}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-center gap-2 px-3 py-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${color}20` }}
        >
          <Layers style={{ color }} size={15} />
        </div>
        <span className="truncate text-sm font-medium">{data.label}</span>
      </div>
      {expanded && (
        <div className="mx-2 mb-2 flex h-16 items-center justify-center rounded border border-dashed text-xs text-muted-foreground" style={{ borderColor: `${color}40` }}>
          子流程缩略
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setExpanded((v) => !v)
        }}
        className="flex w-full items-center justify-center border-t py-1 text-xs text-muted-foreground hover:bg-muted/50"
        style={{ borderColor: `${color}30` }}
      >
        {expanded ? <Minus size={12} /> : <Plus size={12} />}
      </button>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  )
}

export const SubprocessNode = memo(SubprocessNodeInner)
