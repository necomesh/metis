import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import {
  type ConditionGroup,
  type SimpleCondition,
  isConditionGroup,
  toConditionGroup,
  conditionSummary,
  type GatewayCondition,
} from "../types"

const OPERATORS = [
  "equals", "not_equals", "contains_any", "gt", "lt", "gte", "lte", "is_empty", "is_not_empty",
] as const

interface ConditionBuilderProps {
  condition?: GatewayCondition | ConditionGroup
  onChange: (condition: ConditionGroup | undefined) => void
}

export function ConditionBuilder({ condition, onChange }: ConditionBuilderProps) {
  const { t } = useTranslation("itsm")
  const group = condition ? toConditionGroup(condition) : undefined

  function ensureGroup(): ConditionGroup {
    return group ?? { logic: "and", conditions: [] }
  }

  function addCondition() {
    const g = ensureGroup()
    onChange({
      ...g,
      conditions: [...g.conditions, { field: "", operator: "equals", value: "" }],
    })
  }

  function addGroup() {
    const g = ensureGroup()
    onChange({
      ...g,
      conditions: [...g.conditions, { logic: "and", conditions: [{ field: "", operator: "equals", value: "" }] }],
    })
  }

  function toggleLogic() {
    const g = ensureGroup()
    onChange({ ...g, logic: g.logic === "and" ? "or" : "and" })
  }

  function updateCondition(index: number, patch: Partial<SimpleCondition>) {
    const g = ensureGroup()
    const updated = g.conditions.map((c, i) => {
      if (i !== index || isConditionGroup(c)) return c
      return { ...c, ...patch }
    })
    onChange({ ...g, conditions: updated })
  }

  function removeCondition(index: number) {
    const g = ensureGroup()
    const updated = g.conditions.filter((_, i) => i !== index)
    if (updated.length === 0) {
      onChange(undefined)
      return
    }
    onChange({ ...g, conditions: updated })
  }

  const summary = conditionSummary(condition)

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{t("workflow.prop.condition")}</Label>
      {summary && (
        <div className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground truncate" title={summary}>
          {summary}
        </div>
      )}

      {group && group.conditions.length > 0 && (
        <div className="space-y-1.5 rounded border p-2">
          <button
            type="button"
            onClick={toggleLogic}
            className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20"
          >
            {group.logic.toUpperCase()}
          </button>
          {group.conditions.map((cond, i) =>
            isConditionGroup(cond) ? (
              <div key={i} className="ml-2 rounded border-l-2 border-primary/30 pl-2">
                <ConditionBuilder
                  condition={cond}
                  onChange={(updated) => {
                    const g = ensureGroup()
                    const conditions = [...g.conditions]
                    if (updated) {
                      conditions[i] = updated
                    } else {
                      conditions.splice(i, 1)
                    }
                    onChange(conditions.length > 0 ? { ...g, conditions } : undefined)
                  }}
                />
              </div>
            ) : (
              <div key={i} className="flex items-center gap-1">
                <Input
                  value={cond.field}
                  onChange={(e) => updateCondition(i, { field: e.target.value })}
                  placeholder={t("workflow.prop.condField")}
                  className="h-7 flex-1 text-[11px]"
                />
                <Select
                  value={cond.operator}
                  onValueChange={(v) => updateCondition(i, { operator: v as SimpleCondition["operator"] })}
                >
                  <SelectTrigger className="h-7 w-20 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op} value={op} className="text-[11px]">{op}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={String(cond.value ?? "")}
                  onChange={(e) => updateCondition(i, { value: e.target.value })}
                  placeholder={t("workflow.prop.condValue")}
                  className="h-7 flex-1 text-[11px]"
                />
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeCondition(i)}>
                  <Trash2 size={11} />
                </Button>
              </div>
            ),
          )}
        </div>
      )}

      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={addCondition}>
          <Plus size={11} className="mr-0.5" />{t("workflow.condition.add")}
        </Button>
        <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={addGroup}>
          <Plus size={11} className="mr-0.5" />{t("workflow.condition.addGroup")}
        </Button>
      </div>
    </div>
  )
}
