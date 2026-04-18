import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pencil } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet"
import { FormDesigner } from "../../form-engine"
import type { FormSchema } from "../../form-engine"

interface FormBindingPickerProps {
  formSchema?: unknown
  onChange: (schema: unknown) => void
}

function toFormSchema(raw: unknown): FormSchema {
  if (raw && typeof raw === "object") {
    const s = raw as FormSchema
    if (Array.isArray(s.fields)) return s
  }
  return { version: 1, fields: [] }
}

export function FormBindingPicker({ formSchema, onChange }: FormBindingPickerProps) {
  const { t } = useTranslation("itsm")
  const [designerOpen, setDesignerOpen] = useState(false)
  const [draft, setDraft] = useState<FormSchema>(() => toFormSchema(formSchema))

  const fields = toFormSchema(formSchema).fields
  const fieldCount = fields.length

  function handleOpen() {
    setDraft(toFormSchema(formSchema))
    setDesignerOpen(true)
  }

  function handleSave() {
    onChange(draft.fields.length > 0 ? draft : undefined)
    setDesignerOpen(false)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{t("workflow.prop.formBinding")}</Label>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleOpen}>
          <Pencil className="mr-1 h-3 w-3" />
          {t("workflow.prop.editForm")}
        </Button>
      </div>

      {fieldCount === 0 ? (
        <p className="text-xs text-muted-foreground">{t("workflow.prop.formUnbound")}</p>
      ) : (
        <div className="rounded border p-1.5">
          <div className="space-y-0.5">
            {fields.slice(0, 6).map((f) => (
              <div key={f.key} className="flex items-center justify-between text-[10px]">
                <span>{f.label || f.key}</span>
                <span className="text-muted-foreground">{t(`forms.type.${f.type}`)}</span>
              </div>
            ))}
            {fieldCount > 6 && (
              <div className="text-[10px] text-muted-foreground">+{fieldCount - 6} more</div>
            )}
          </div>
        </div>
      )}

      <Sheet open={designerOpen} onOpenChange={setDesignerOpen}>
        <SheetContent className="sm:max-w-4xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-0">
            <SheetTitle>{t("workflow.prop.formBinding")}</SheetTitle>
            <SheetDescription className="sr-only">{t("workflow.prop.formBinding")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 px-6 py-4">
            <FormDesigner schema={draft} onChange={setDraft} />
          </div>
          <SheetFooter className="px-6 pb-6">
            <Button variant="outline" size="sm" onClick={() => setDesignerOpen(false)}>
              {t("workflow.prop.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button size="sm" onClick={handleSave}>
              {t("workflow.prop.confirm", { defaultValue: "Confirm" })}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
