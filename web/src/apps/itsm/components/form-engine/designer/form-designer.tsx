import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { FormSchema, FormField, FieldType } from "../types"
import { FieldTypePalette } from "./field-palette"
import { DesignerCanvas } from "./designer-canvas"
import { FieldPropertyEditor } from "./field-property-editor"

interface FormDesignerProps {
  schema: FormSchema
  onChange: (schema: FormSchema) => void
}

function generateFieldKey(type: FieldType, existing: FormField[]): string {
  const keys = new Set(existing.map((f) => f.key))
  let i = 1
  let key = `${type}_${i}`
  while (keys.has(key)) {
    i++
    key = `${type}_${i}`
  }
  return key
}

export function FormDesigner({ schema, onChange }: FormDesignerProps) {
  const { t } = useTranslation("itsm")
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null)

  const fields = schema.fields
  const layout = schema.layout ?? null
  const selectedField = selectedFieldKey
    ? fields.find((f) => f.key === selectedFieldKey) ?? null
    : null

  const updateFields = useCallback(
    (next: FormField[]) => {
      onChange({ ...schema, fields: next })
    },
    [schema, onChange],
  )

  const handleAddField = useCallback(
    (type: FieldType) => {
      const key = generateFieldKey(type, fields)
      const newField: FormField = {
        key,
        type,
        label: t(`forms.type.${type}`),
        required: false,
      }
      updateFields([...fields, newField])
      setSelectedFieldKey(key)
    },
    [fields, updateFields, t],
  )

  const handleDeleteField = useCallback(
    (key: string) => {
      updateFields(fields.filter((f) => f.key !== key))
      if (selectedFieldKey === key) setSelectedFieldKey(null)
    },
    [fields, updateFields, selectedFieldKey],
  )

  const handleMoveField = useCallback(
    (key: string, direction: "up" | "down") => {
      const idx = fields.findIndex((f) => f.key === key)
      if (idx < 0) return
      const target = direction === "up" ? idx - 1 : idx + 1
      if (target < 0 || target >= fields.length) return
      const next = [...fields]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      updateFields(next)
    },
    [fields, updateFields],
  )

  const handleFieldChange = useCallback(
    (updated: FormField) => {
      updateFields(fields.map((f) => (f.key === updated.key ? updated : f)))
    },
    [fields, updateFields],
  )

  return (
    <div className="flex h-full gap-0 border rounded-lg overflow-hidden bg-background">
      {/* Left: Field type palette */}
      <div className="w-48 shrink-0 border-r bg-muted/30">
        <div className="px-3 py-2 border-b">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("forms.fieldPalette")}
          </h3>
        </div>
        <ScrollArea className="h-[calc(100%-37px)]">
          <div className="p-2">
            <FieldTypePalette onAddField={handleAddField} />
          </div>
        </ScrollArea>
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 min-w-0">
        <div className="px-3 py-2 border-b">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("forms.canvas")}
          </h3>
        </div>
        <ScrollArea className="h-[calc(100%-37px)]">
          <div className="p-3">
            <DesignerCanvas
              fields={fields}
              layout={layout}
              selectedFieldKey={selectedFieldKey}
              onSelectField={setSelectedFieldKey}
              onDeleteField={handleDeleteField}
              onMoveField={handleMoveField}
            />
          </div>
        </ScrollArea>
      </div>

      {/* Right: Property editor */}
      <div className="w-64 shrink-0 border-l bg-muted/30">
        <div className="px-3 py-2 border-b">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("forms.properties")}
          </h3>
        </div>
        <ScrollArea className="h-[calc(100%-37px)]">
          <div className="p-3">
            {selectedField ? (
              <FieldPropertyEditor
                field={selectedField}
                allFields={fields}
                onChange={handleFieldChange}
              />
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">
                {t("forms.selectFieldHint")}
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
