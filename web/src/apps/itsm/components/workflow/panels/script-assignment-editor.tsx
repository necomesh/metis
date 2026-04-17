import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Equal } from "lucide-react"
import type { ScriptAssignment } from "../types"

interface ScriptAssignmentEditorProps {
  assignments: ScriptAssignment[]
  onChange: (assignments: ScriptAssignment[]) => void
}

export function ScriptAssignmentEditor({ assignments, onChange }: ScriptAssignmentEditorProps) {
  const { t } = useTranslation("itsm")

  function addAssignment() {
    onChange([...assignments, { variable: "", expression: "" }])
  }

  function updateAssignment(index: number, patch: Partial<ScriptAssignment>) {
    onChange(assignments.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  function removeAssignment(index: number) {
    onChange(assignments.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{t("workflow.prop.scriptAssignments")}</Label>
      {assignments.length > 0 && (
        <div className="space-y-1">
          {assignments.map((a, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={a.variable}
                onChange={(e) => updateAssignment(i, { variable: e.target.value })}
                placeholder={t("workflow.script.variable")}
                className="h-7 w-24 text-[11px] font-mono"
              />
              <Equal size={12} className="shrink-0 text-muted-foreground" />
              <Input
                value={a.expression}
                onChange={(e) => updateAssignment(i, { expression: e.target.value })}
                placeholder={t("workflow.script.expression")}
                className="h-7 flex-1 text-[11px] font-mono"
              />
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeAssignment(i)}>
                <Trash2 size={11} />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={addAssignment}>
        <Plus size={11} className="mr-0.5" />{t("workflow.script.add")}
      </Button>
    </div>
  )
}
