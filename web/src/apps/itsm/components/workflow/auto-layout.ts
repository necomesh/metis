import dagre from "@dagrejs/dagre"
import type { Node, Edge } from "@xyflow/react"
import type { NodeType } from "./types"

const NODE_DIMENSIONS: Record<NodeType, { width: number; height: number }> = {
  start: { width: 100, height: 40 },
  end: { width: 100, height: 40 },
  timer: { width: 56, height: 56 },
  signal: { width: 56, height: 56 },
  form: { width: 200, height: 72 },
  approve: { width: 200, height: 72 },
  process: { width: 200, height: 72 },
  action: { width: 200, height: 72 },
  script: { width: 200, height: 72 },
  notify: { width: 200, height: 72 },
  exclusive: { width: 56, height: 56 },
  parallel: { width: 56, height: 56 },
  inclusive: { width: 56, height: 56 },
  subprocess: { width: 240, height: 100 },
  wait: { width: 160, height: 56 },
}

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 })

  for (const node of nodes) {
    const nodeType = (node.data as { nodeType?: NodeType }).nodeType ?? "form"
    const dim = NODE_DIMENSIONS[nodeType] ?? { width: 160, height: 56 }
    g.setNode(node.id, { width: dim.width, height: dim.height })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    const nodeType = (node.data as { nodeType?: NodeType }).nodeType ?? "form"
    const dim = NODE_DIMENSIONS[nodeType] ?? { width: 160, height: 56 }
    return {
      ...node,
      position: {
        x: pos.x - dim.width / 2,
        y: pos.y - dim.height / 2,
      },
    }
  })
}
