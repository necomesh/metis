import { useMemo, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { nodeTypes } from "./nodes"
import { edgeTypes } from "./custom-edges"
import { type WFNodeData, NODE_COLORS } from "./types"
import type { ActivityItem } from "../../api"

interface WorkflowViewerProps {
  workflowJson: unknown
  activities: ActivityItem[]
  currentActivityId?: number | null
}

export function WorkflowViewer({ workflowJson, activities, currentActivityId }: WorkflowViewerProps) {
  const { t } = useTranslation("itsm")
  const [clickedActivity, setClickedActivity] = useState<ActivityItem | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)

  // Build activity lookup by nodeId
  const activityMap = useMemo(() => {
    const map = new Map<string, ActivityItem>()
    for (const a of activities) {
      map.set(a.nodeId, a)
    }
    return map
  }, [activities])

  // Parse workflow JSON and apply state highlighting
  const { nodes, edges } = useMemo(() => {
    if (!workflowJson) return { nodes: [], edges: [] }

    let wf: { nodes?: unknown[]; edges?: unknown[] }
    try {
      wf = typeof workflowJson === "string" ? JSON.parse(workflowJson) : workflowJson
    } catch {
      return { nodes: [], edges: [] }
    }

    const rawNodes = (wf.nodes ?? []) as Array<{
      id: string; position: { x: number; y: number }; data?: Record<string, unknown>; type?: string
    }>
    const rawEdges = (wf.edges ?? []) as Array<{
      id: string; source: string; target: string; data?: Record<string, unknown>
    }>

    // Map node IDs that have completed activities
    const completedNodeIds = new Set<string>()
    const activeNodeIds = new Set<string>()
    for (const a of activities) {
      if (a.status === "completed") completedNodeIds.add(a.nodeId)
      else if (a.status === "pending" || a.status === "in_progress") activeNodeIds.add(a.nodeId)
    }

    // Track edges between completed/active nodes
    const visitedEdgeIds = new Set<string>()
    for (const e of rawEdges) {
      if (completedNodeIds.has(e.source) && (completedNodeIds.has(e.target) || activeNodeIds.has(e.target))) {
        visitedEdgeIds.add(e.id)
      }
    }

    const nodes: Node[] = rawNodes.map((n) => {
      const nodeData = (n.data ?? {}) as WFNodeData
      const isActive = activeNodeIds.has(n.id)
      const isCompleted = completedNodeIds.has(n.id)

      let className = ""
      if (isActive) className = "ring-2 ring-blue-500 ring-offset-2"
      else if (isCompleted) className = "opacity-70"
      else className = "opacity-40"

      return {
        id: n.id,
        type: nodeData.nodeType ?? (n.type === "workflow" ? "form" : n.type) ?? "form",
        position: n.position,
        data: nodeData,
        className,
        selectable: false,
        draggable: false,
      }
    })

    const edges: Edge[] = rawEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "workflow",
      markerEnd: { type: MarkerType.ArrowClosed },
      data: e.data,
      style: visitedEdgeIds.has(e.id)
        ? { stroke: "#22c55e", strokeWidth: 2 }
        : { stroke: "#d4d4d8", strokeWidth: 1 },
      animated: visitedEdgeIds.has(e.id),
    }))

    return { nodes, edges }
  }, [workflowJson, activities])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const activity = activityMap.get(node.id)
    if (activity && activity.status === "completed") {
      setClickedActivity(activity)
    }
  }, [activityMap])

  return (
    <div className="h-[400px] w-full rounded-md border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        className="bg-muted/20"
      >
        <Background />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const nodeData = n.data as WFNodeData
            const activity = activityMap.get(n.id)
            if (activity?.status === "completed") return "#22c55e"
            if (activity?.status === "pending" || activity?.status === "in_progress") return "#3b82f6"
            return NODE_COLORS[nodeData?.nodeType] ?? "#6b7280"
          }}
          maskColor="rgba(0,0,0,0.05)"
        />
      </ReactFlow>
      {clickedActivity && (
        <div className="border-t bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{clickedActivity.name}</span>
            <Badge variant={clickedActivity.status === "completed" ? "default" : "secondary"}>
              {clickedActivity.status}
            </Badge>
          </div>
          {clickedActivity.transitionOutcome && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("workflow.viewer.outcome")}: {clickedActivity.transitionOutcome}
            </p>
          )}
          {clickedActivity.finishedAt && (
            <p className="text-xs text-muted-foreground">
              {t("workflow.viewer.finishedAt")}: {new Date(clickedActivity.finishedAt).toLocaleString()}
            </p>
          )}
          <button className="mt-1 text-xs text-muted-foreground underline" onClick={() => setClickedActivity(null)}>
            {t("workflow.viewer.close")}
          </button>
        </div>
      )}
    </div>
  )
}
