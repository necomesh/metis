import { useTranslation } from "react-i18next"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"

export interface BindingItem {
  id: number
  name: string
  displayName?: string
  description?: string
}

interface BindingCheckboxListProps {
  title: string
  items: BindingItem[]
  isLoading: boolean
  value: number[]
  onChange: (ids: number[]) => void
}

export function BindingCheckboxList({ title, items, isLoading, value, onChange }: BindingCheckboxListProps) {
  const { t } = useTranslation(["ai"])

  function toggle(id: number) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="rounded-md border max-h-48 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("ai:agents.noItems")}
          </p>
        ) : (
          <div>
            {items.map((item) => (
              <label
                key={String(item.id)}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  id={`binding-${title}-${item.id}`}
                  checked={value.includes(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-sm">{item.displayName || item.name}</span>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
