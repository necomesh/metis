import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { MoreHorizontal, Pencil, Trash2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useState } from "react"
import type { ServiceDefItem } from "../api"

// ─── Brand color mapping ─────────────────────────────────

const engineBrand = {
  smart: {
    stripe: "bg-violet-500",
    avatarBg: "bg-violet-50 text-violet-700",
  },
  classic: {
    stripe: "bg-sky-500",
    avatarBg: "bg-sky-50 text-sky-700",
  },
} as const

function getBrand(engineType: string) {
  return engineBrand[engineType as keyof typeof engineBrand] ?? engineBrand.classic
}

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  return `${months}个月前`
}

// ─── ServiceCard ─────────────────────────────────────────

interface ServiceCardProps {
  service: ServiceDefItem
  canUpdate: boolean
  canDelete: boolean
  onDelete: (id: number) => void
}

export function ServiceCard({ service, canUpdate, canDelete, onDelete }: ServiceCardProps) {
  const { t } = useTranslation("itsm")
  const navigate = useNavigate()
  const brand = getBrand(service.engineType)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col rounded-xl border bg-card transition-all duration-200 cursor-pointer overflow-hidden",
          "hover:border-primary/20 hover:shadow-md hover:-translate-y-0.5",
        )}
        onClick={() => navigate(`/itsm/services/${service.id}`)}
      >
        {/* Stripe */}
        <div className={cn("h-[3px] w-full", brand.stripe)} />

        {/* Header */}
        <div className="flex items-start gap-3 px-4 pt-3 pb-2">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold", brand.avatarBg)}>
            {getInitials(service.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-5">{service.name}</p>
            <p className="truncate text-xs text-muted-foreground font-mono">{service.code}</p>
          </div>
          {(canUpdate || canDelete) && (
            <div data-action-zone="" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canUpdate && (
                    <DropdownMenuItem onClick={() => navigate(`/itsm/services/${service.id}`)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />{t("edit")}
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" />{t("services.confirmDelete")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Chips */}
        <div className="flex items-center gap-1.5 px-4 pb-3">
          <Badge variant={service.engineType === "smart" ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
            {service.engineType === "smart" ? t("services.engineSmart") : t("services.engineClassic")}
          </Badge>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", service.isActive ? "bg-green-500" : "bg-gray-400")} />
          <span>{service.isActive ? t("services.active") : t("services.inactive")}</span>
          <span className="ml-auto">{relativeTime(service.updatedAt)}</span>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("services.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("services.deleteDesc", { name: service.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">{t("common:cancel")}</AlertDialogCancel>
            <AlertDialogAction size="sm" onClick={() => onDelete(service.id)}>{t("services.confirmDelete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── GuideCard ───────────────────────────────────────────

interface GuideCardProps {
  onClick: () => void
}

export function GuideCard({ onClick }: GuideCardProps) {
  const { t } = useTranslation("itsm")

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl",
        "border-2 border-dashed border-muted-foreground/20 bg-muted/20",
        "transition-colors hover:border-primary/30 hover:bg-muted/40 cursor-pointer",
      )}
    >
      <Plus className="h-8 w-8 text-muted-foreground/40" />
      <span className="text-sm text-muted-foreground">{t("services.guideCardHint")}</span>
    </button>
  )
}
