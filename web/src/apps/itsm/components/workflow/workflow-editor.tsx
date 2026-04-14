import { useState, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type ReactFlowInstance,
  MarkerType,
  Panel,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Button } from "@/components/ui/button"
import { Save, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { nodeTypes } from "./custom-nodes"
import { NodePalette } from "./node-palette"
import { NodePropertyPanel, EdgePropertyPanel } from "./property-panel"
import { type WFNodeData, type WFEdgeData, type NodeType, NODE_COLORS } from "./types"

interface WorkflowEditorProps {
  initialData?: { nodes: Node[]; edges: Edge[] }
  onSave: (data: { nodes: Node[]; edges: Edge[] }) => void
  saving?: boolean
  validationErrors?: Array<{ nodeId?: string; edgeId?: string; message: string }>
}

let nodeId = 0
function getNodeId() { return `node_${Date.now()}_${++nodeId}` }

export function WorkflowEditor({ initialData, onSave, saving, validationErrors }: WorkflowEditorProps) {
  const { t } = useTranslation("itsm")
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [selectedNode, setSelectedNode] = useState<(Node & { data: WFNodeData }) | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<(Edge & { data?: WFEdgeData }) | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState(initialData?.nodes ?? [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData?.edges ?? [])

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { outcome: "", isDefault: false } as WFEdgeData,
    }, eds))
  }, [setEdges])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const nodeType = event.dataTransfer.getData("application/reactflow-nodetype") as NodeType
    if (!nodeType || !rfInstance || !reactFlowWrapper.current) return

    const bounds = reactFlowWrapper.current.getBoundingClientRect()
    const position = rfInstance.screenToFlowPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })

    const newNode: Node = {
      id: getNodeId(),
      type: "workflow",
      position,
      data: {
        label: t(`workflow.node.${nodeType}`),
        nodeType,
        ...(nodeType === "approve" ? { executionMode: "single" } : {}),
        ...(nodeType === "wait" ? { waitMode: "signal" } : {}),
      } satisfies WFNodeData,
    }
    setNodes((nds) => [...nds, newNode])
  }, [rfInstance, setNodes, t])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedEdge(null)
    setSelectedNode(node as Node & { data: WFNodeData })
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedNode(null)
    setSelectedEdge(edge as Edge & { data?: WFEdgeData })
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [])

  function handleSave() {
    onSave({ nodes, edges })
  }

  // Find source node type for edge panel
  const edgeSourceNodeType = selectedEdge
    ? (nodes.find((n) => n.id === selectedEdge.source)?.data as WFNodeData | undefined)?.nodeType
    : undefined

  return (
    <ReactFlowProvider>
    <div className="flex h-full" ref={reactFlowWrapper}>
      <NodePalette />
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onInit={setRfInstance}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
          fitView
          className="bg-background"
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(n) => NODE_COLORS[(n.data as WFNodeData)?.nodeType] ?? "#6b7280"}
            maskColor="rgba(0,0,0,0.1)"
          />
          <Panel position="top-right" className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? t("workflow.saving") : t("workflow.save")}
            </Button>
          </Panel>
          {validationErrors && validationErrors.length > 0 && (
            <Panel position="bottom-left" className="max-w-sm">
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <AlertCircle size={14} />
                  {t("workflow.validationErrors")}
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-destructive/80">
                  {validationErrors.map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
      {selectedNode && (
        <NodePropertyPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
      {selectedEdge && (
        <EdgePropertyPanel edge={selectedEdge} sourceNodeType={edgeSourceNodeType} onClose={() => setSelectedEdge(null)} />
      )}
    </div>
    </ReactFlowProvider>
  )
}
