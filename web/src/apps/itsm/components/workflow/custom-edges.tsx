import { memo } from "react"
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
  EdgeLabelRenderer,
} from "@xyflow/react"
import type { WFEdgeData } from "./types"
import { conditionSummary } from "./types"

function WorkflowEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps & { data?: WFEdgeData }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const edgeData = data as WFEdgeData | undefined
  const outcome = edgeData?.outcome
  const isDefault = edgeData?.isDefault
  const condition = edgeData?.condition
  const condText = conditionSummary(condition)

  const isApproved = outcome === "approved" || outcome === "approve"
  const isRejected = outcome === "rejected" || outcome === "reject"

  const strokeColor = selected
    ? "hsl(var(--primary))"
    : isRejected
      ? "#ef4444"
      : isApproved
        ? "#22c55e"
        : undefined

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={strokeColor ? { stroke: strokeColor } : undefined}
      />
      <EdgeLabelRenderer>
        {(outcome || condText || isDefault) && (
          <div
            className="nodrag nopan pointer-events-none absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {isDefault && !outcome && !condText && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">/</span>
            )}
            {outcome && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  isApproved
                    ? "bg-green-500/15 text-green-600"
                    : isRejected
                      ? "bg-red-500/15 text-red-600"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {outcome}
              </span>
            )}
            {condText && !outcome && (
              <span className="max-w-[140px] truncate rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">
                {condText}
              </span>
            )}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

export const WorkflowEdge = memo(WorkflowEdgeInner)

export const edgeTypes = {
  workflow: WorkflowEdge,
}
