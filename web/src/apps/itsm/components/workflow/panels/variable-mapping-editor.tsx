import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, ArrowRight } from "lucide-react"
import type { VariableMapping } from "../types"

interface VariableMappingEditorProps {
  label: string
  mappings: VariableMapping[]
  onChange: (mappings: VariableMapping[]) => void
  sourceLabel?: string
  targetLabel?: string
}

export function VariableMappingEditor({
  label,
  mappings,
  onChange,
  sourceLabel,
  targetLabel,
}: VariableMappingEditorProps) {
  const { t } = useTranslation("itsm")

  function addMapping() {
    onChange([...mappings, { source: "", target: "" }])
  }

  function updateMapping(index: number, patch: Partial<VariableMapping>) {
    onChange(mappings.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  function removeMapping(index: number) {
    onChange(mappings.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {mappings.length > 0 && (
        <div className="space-y-1">
          {mappings.map((m, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={m.source}
                onChange={(e) => updateMapping(i, { source: e.target.value })}
                placeholder={sourceLabel ?? t("workflow.mapping.source")}
                className="h-7 flex-1 text-[11px]"
              />
              <ArrowRight size={12} className="shrink-0 text-muted-foreground" />
              <Input
                value={m.target}
                onChange={(e) => updateMapping(i, { target: e.target.value })}
                placeholder={targetLabel ?? t("workflow.mapping.target")}
                className="h-7 flex-1 text-[11px]"
              />
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeMapping(i)}>
                <Trash2 size={11} />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={addMapping}>
        <Plus size={11} className="mr-0.5" />{t("workflow.mapping.add")}
      </Button>
    </div>
  )
}
