import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import {
  FileText, ShieldCheck, Wrench, Zap, Code2, Bell,
} from "lucide-react"
import type { WFNodeData, Participant } from "../types"
import { NODE_COLORS } from "../types"
import { useTranslation } from "react-i18next"

const TASK_ICONS: Record<string, typeof FileText> = {
  form: FileText,
  approve: ShieldCheck,
  process: Wrench,
  action: Zap,
  script: Code2,
  notify: Bell,
}

const EXECUTION_MODE_LABEL: Record<string, string> = {
  single: "单签",
  parallel: "会签",
  sequential: "依次",
}

function participantSummary(participants?: Participant[]): string {
  if (!participants || participants.length === 0) return ""
  const first = participants[0].name ?? participants[0].value ?? participants[0].type
  if (participants.length === 1) return first
  return `${first} +${participants.length - 1}`
}

function TaskNodeInner({ data, selected }: NodeProps & { data: WFNodeData }) {
  const { t } = useTranslation("itsm")
  const nodeType = data.nodeType
  const Icon = TASK_ICONS[nodeType] ?? Wrench
  const color = NODE_COLORS[nodeType] ?? "#6b7280"

  const summary = buildSummary(data, t)

  return (
    <div
      className={`min-w-[180px] max-w-[220px] rounded-lg border-2 shadow-md ${selected ? "ring-2 ring-primary" : ""}`}
      style={{ borderColor: color, backgroundColor: `${color}08` }}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-center gap-2 px-3 py-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon style={{ color }} size={15} />
        </div>
        <span className="truncate text-sm font-medium">{data.label}</span>
      </div>
      {summary && (
        <div className="border-t px-3 py-1.5" style={{ borderColor: `${color}20` }}>
          <span className="text-xs text-muted-foreground">{summary}</span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  )
}

function buildSummary(data: WFNodeData, t: (key: string) => string): string {
  const parts: string[] = []

  if (data.nodeType === "form") {
    if (data.formDefinitionId) {
      parts.push(t("workflow.summary.formBound"))
    } else {
      parts.push(t("workflow.summary.formUnbound"))
    }
  }

  if (data.nodeType === "approve") {
    const mode = data.executionMode ?? "single"
    parts.push(EXECUTION_MODE_LABEL[mode] ?? mode)
  }

  if (data.nodeType === "action") {
    if (data.actionId) {
      parts.push(t("workflow.summary.actionBound"))
    } else {
      parts.push(t("workflow.summary.actionUnbound"))
    }
  }

  if (data.nodeType === "notify") {
    parts.push(data.channelType ?? t("workflow.summary.notifyUnset"))
  }

  const pSummary = participantSummary(data.participants)
  if (pSummary && (data.nodeType === "form" || data.nodeType === "approve" || data.nodeType === "process")) {
    parts.push(pSummary)
  }

  return parts.join(" · ")
}

export const TaskNode = memo(TaskNodeInner)
