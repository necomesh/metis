import { useTranslation } from "react-i18next"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { FieldType, FormField, FormLayout } from "../types"

interface DesignerCanvasProps {
  fields: FormField[]
  layout: FormLayout | null
  layoutColumns: 1 | 2 | 3
  selectedFieldKey: string | null
  onSelectField: (key: string | null) => void
  onAddField: (type: FieldType) => void
  onReorderFields: (activeKey: string, overKey: string) => void
  onDeleteField: (key: string) => void
  onMoveField: (key: string, direction: "up" | "down") => void
}

export function DesignerCanvas({
  fields,
  layout,
  layoutColumns,
  selectedFieldKey,
  onSelectField,
  onAddField,
  onReorderFields,
  onDeleteField,
  onMoveField,
}: DesignerCanvasProps) {
  const { t } = useTranslation("itsm")
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorderFields(String(active.id), String(over.id))
  }

  function handleDragOver(event: React.DragEvent) {
    if (event.dataTransfer.types.includes("application/metis-form-field-type")) {
      event.preventDefault()
      event.dataTransfer.dropEffect = "copy"
    }
  }

  function handleDrop(event: React.DragEvent) {
    const type = event.dataTransfer.getData("application/metis-form-field-type") as FieldType
    if (!type) return
    event.preventDefault()
    onAddField(type)
  }

  const fieldKeys = fields.map((field) => field.key)
  const gridClassName = cn(
    "grid gap-2",
    layoutColumns === 1 && "grid-cols-1",
    layoutColumns === 2 && "grid-cols-2",
    layoutColumns === 3 && "grid-cols-3",
  )

  if (fields.length === 0) {
    return (
      <div
        className="mx-auto flex min-h-[320px] max-w-[720px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-white/64 text-muted-foreground"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <p className="text-sm font-medium">{t("forms.empty")}</p>
        <p className="mt-1 text-xs">{t("forms.emptyHint")}</p>
      </div>
    )
  }

  // Render fields as section groups or flat list
  if (layout?.sections && layout.sections.length > 0) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="mx-auto max-w-[760px] space-y-4" onDragOver={handleDragOver} onDrop={handleDrop}>
        {layout.sections.map((section, si) => {
          const sectionFields = section.fields
            .map((key) => fields.find((f) => f.key === key))
            .filter(Boolean) as FormField[]

          return (
            <div key={si} className="overflow-hidden rounded-xl border border-border/65 bg-white/76">
              <div className="border-b border-border/60 bg-white/70 px-3 py-2">
                <h4 className="text-sm font-medium">{section.title}</h4>
                {section.description && (
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                )}
              </div>
              <SortableContext items={sectionFields.map((field) => field.key)} strategy={rectSortingStrategy}>
                <div className={cn(gridClassName, "p-2")}>
                {sectionFields.map((field) => (
                  <FieldCard
                    key={field.key}
                    field={field}
                    layoutColumns={layoutColumns}
                    isSelected={selectedFieldKey === field.key}
                    onSelect={() => onSelectField(field.key)}
                    onDelete={() => onDeleteField(field.key)}
                    onMoveUp={() => onMoveField(field.key, "up")}
                    onMoveDown={() => onMoveField(field.key, "down")}
                    t={t}
                  />
                ))}
                {sectionFields.length === 0 && (
                  <p className="text-xs text-muted-foreground py-3 text-center">
                    {t("forms.empty")}
                  </p>
                )}
                </div>
              </SortableContext>
            </div>
          )
        })}
        </div>
      </DndContext>
    )
  }

  // Flat list
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={fieldKeys} strategy={rectSortingStrategy}>
        <div className={cn("mx-auto max-w-[760px]", gridClassName)} onDragOver={handleDragOver} onDrop={handleDrop}>
      {fields.map((field) => (
        <FieldCard
          key={field.key}
          field={field}
          layoutColumns={layoutColumns}
          isSelected={selectedFieldKey === field.key}
          onSelect={() => onSelectField(field.key)}
          onDelete={() => onDeleteField(field.key)}
          onMoveUp={() => onMoveField(field.key, "up")}
          onMoveDown={() => onMoveField(field.key, "down")}
          t={t}
        />
      ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function fieldSpanClass(field: FormField, layoutColumns: 1 | 2 | 3) {
  if (layoutColumns === 1) return "col-span-1"
  if (field.width === "third") return "col-span-1"
  if (field.width === "half") return layoutColumns === 2 ? "col-span-1" : "col-span-2"
  return layoutColumns === 2 ? "col-span-2" : "col-span-3"
}

function FieldCard({
  field,
  layoutColumns,
  isSelected,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  t,
}: {
  field: FormField
  layoutColumns: 1 | 2 | 3
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  t: (key: string) => string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.key })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        fieldSpanClass(field, layoutColumns),
        "flex cursor-pointer items-center gap-2 rounded-lg border border-border/65 bg-white/76 px-3 py-2.5 transition-colors",
        isSelected
          ? "border-primary/55 bg-primary/5 ring-1 ring-primary/20"
          : "hover:border-primary/35 hover:bg-white",
        isDragging && "z-10 opacity-70 shadow-[0_18px_46px_-28px_rgba(15,23,42,0.45)]",
      )}
      onClick={onSelect}
    >
      <button
        type="button"
        className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted/70 active:cursor-grabbing"
        aria-label="Drag field"
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{field.label}</span>
          <span className="text-xs text-muted-foreground">{field.key}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {t(`forms.type.${field.type}`)}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </span>
      </div>
      {isSelected && (
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
