import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Calendar, Clock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { RefreshLabel } from "../hooks/use-time-range"
import { REFRESH_OPTIONS } from "../hooks/use-time-range"

interface TimeRangePickerProps {
  value: string
  presets: ReadonlyArray<{ label: string; minutes: number }>
  onSelect: (label: string) => void
  onRefresh: () => void
  onCustomRange?: (start: string, end: string) => void
  refreshInterval?: RefreshLabel
  onRefreshIntervalChange?: (interval: RefreshLabel) => void
}

function toLocalDatetime(isoString: string): string {
  const d = new Date(isoString)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export function TimeRangePicker({
  value,
  presets,
  onSelect,
  onRefresh,
  onCustomRange,
  refreshInterval = "off",
  onRefreshIntervalChange,
}: TimeRangePickerProps) {
  const { t } = useTranslation("apm")
  const [customOpen, setCustomOpen] = useState(false)
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  const handleOpenCustom = () => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    setCustomStart(toLocalDatetime(oneHourAgo.toISOString()))
    setCustomEnd(toLocalDatetime(now.toISOString()))
  }

  const handleApplyCustom = () => {
    if (customStart && customEnd && onCustomRange) {
      onCustomRange(new Date(customStart).toISOString(), new Date(customEnd).toISOString())
      setCustomOpen(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
      {presets.map((p) => (
        <Button
          key={p.label}
          variant={value === p.label ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => {
            if (value === p.label) {
              onRefresh()
            } else {
              onSelect(p.label)
            }
          }}
        >
          {t(`timeRange.${p.label}`)}
        </Button>
      ))}

      {onCustomRange && (
        <Popover open={customOpen} onOpenChange={(open) => {
          setCustomOpen(open)
          if (open) handleOpenCustom()
        }}>
          <PopoverTrigger asChild>
            <Button
              variant={value === "custom" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
            >
              <Calendar className="mr-1 h-3 w-3" />
              {t("timeRange.custom")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">{t("timeRange.startTime")}</Label>
                <Input
                  type="datetime-local"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">{t("timeRange.endTime")}</Label>
                <Input
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button size="sm" className="h-8" onClick={handleApplyCustom}>
                {t("timeRange.apply")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {onRefreshIntervalChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-1 h-7 gap-1 px-2 text-xs">
              <RefreshCw className={`h-3 w-3 ${refreshInterval !== "off" ? "animate-spin" : ""}`} />
              {refreshInterval !== "off" && <span>{refreshInterval}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {REFRESH_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.label}
                onClick={() => onRefreshIntervalChange(opt.label)}
                className={refreshInterval === opt.label ? "bg-accent" : ""}
              >
                {t(`timeRange.refresh.${opt.label}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
