import { useTranslation } from "react-i18next"
import {
  Play, Square, FileText, ShieldCheck, Wrench, Zap, GitBranch, Bell, Clock,
  Code2, Radio, Layers, CircleDot, GitMerge,
} from "lucide-react"
import { NODE_COLORS, type NodeType } from "./types"

const ICONS: Record<string, typeof Play> = {
  start: Play, end: Square, timer: Clock, signal: Radio,
  form: FileText, approve: ShieldCheck, process: Wrench, action: Zap,
  script: Code2, notify: Bell,
  exclusive: GitBranch, parallel: GitMerge, inclusive: CircleDot,
  subprocess: Layers, wait: Clock,
}

const GROUPS: { label: string; types: NodeType[] }[] = [
  { label: "workflow.group.events", types: ["start", "end", "timer", "signal"] },
  { label: "workflow.group.tasks", types: ["form", "approve", "process", "action", "script", "notify"] },
  { label: "workflow.group.gateways", types: ["exclusive", "parallel", "inclusive"] },
  { label: "workflow.group.other", types: ["subprocess", "wait"] },
]

export function NodePalette() {
  const { t } = useTranslation("itsm")

  function onDragStart(event: React.DragEvent, nodeType: NodeType) {
    event.dataTransfer.setData("application/reactflow-nodetype", nodeType)
    event.dataTransfer.effectAllowed = "move"
  }

  return (
    <div className="flex w-[160px] flex-col gap-2 overflow-y-auto border-r bg-muted/30 p-3">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t(group.label)}
          </div>
          <div className="space-y-1">
            {group.types.map((nt) => {
              const Icon = ICONS[nt] ?? Wrench
              const color = NODE_COLORS[nt]
              return (
                <div
                  key={nt}
                  draggable
                  onDragStart={(e) => onDragStart(e, nt)}
                  className="flex cursor-grab items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm hover:border-primary/50 active:cursor-grabbing"
                >
                  <Icon size={14} style={{ color }} />
                  <span>{t(`workflow.node.${nt}`)}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
