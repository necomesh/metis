import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { Pencil, Trash2, Zap, MoreHorizontal, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getProviderBrand } from "../lib/provider-brand"
import { StatusDot } from "./status-dot"
import type { ProviderItem } from "./provider-sheet"

interface ProviderCardProps {
  provider: ProviderItem
  canUpdate: boolean
  canDelete: boolean
  canTest: boolean
  testingId: number | null
  onTest: (id: number) => void
  onDelete: (provider: ProviderItem) => void
}

function formatRelativeTime(dateStr: string | null): string | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "<1m"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function ModelChips({ provider, t }: { provider: ProviderItem; t: (key: string) => string }) {
  if (provider.modelCount === 0) return null

  // We only have the total count from the list API, not per-type breakdown.
  // Show total count badge. Per-type breakdown shows on detail page.
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="secondary" className="text-xs font-normal">
        {provider.modelCount} {t("ai:providers.modelCount")}
      </Badge>
    </div>
  )
}

export function ProviderCard({
  provider,
  canUpdate,
  canDelete,
  canTest,
  testingId,
  onTest,
  onDelete,
}: ProviderCardProps) {
  const { t } = useTranslation(["ai", "common"])
  const navigate = useNavigate()
  const brand = getProviderBrand(provider.type)
  const isTesting = testingId === provider.id
  const relTime = formatRelativeTime(provider.healthCheckedAt)

  function handleCardClick(e: React.MouseEvent) {
    // Don't navigate if clicking on action buttons or dropdown
    const target = e.target as HTMLElement
    if (target.closest("[data-action-zone]")) return
    navigate(`/ai/providers/${provider.id}`)
  }

  return (
    <div
      className="group relative flex cursor-pointer flex-col rounded-xl border bg-card transition-all hover:border-primary/20 hover:shadow-md hover:-translate-y-0.5"
      onClick={handleCardClick}
    >
      {/* Brand color stripe */}
      <div className={cn("h-1 w-full rounded-t-xl", brand.stripe)} />

      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
            brand.avatarBg,
          )}
        >
          {brand.avatarText}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold">{provider.name}</h3>
            {(canUpdate || canDelete) && (
              <div data-action-zone>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canUpdate && (
                      <DropdownMenuItem onClick={() => navigate(`/ai/providers/${provider.id}`)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        {t("common:edit")}
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(provider)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          {t("common:delete")}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{provider.baseUrl}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {provider.apiKeyMasked || "—"}
          </p>
        </div>
      </div>

      {/* Model chips */}
      <div className="px-4 pb-2">
        <ModelChips provider={provider} t={t} />
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <StatusDot status={provider.status} loading={isTesting} />
          <span>
            {t(`ai:statusLabels.${provider.status}`, provider.status)}
            {relTime && ` · ${relTime}`}
          </span>
        </div>
        <div className="flex items-center gap-1" data-action-zone>
          {canTest && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isTesting}
              onClick={() => onTest(provider.id)}
            >
              <Zap className="mr-1 h-3 w-3" />
              {isTesting ? t("ai:providers.testing") : t("ai:providers.testConnection")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Guide card (add new provider) ──────────────────────────────────────────

interface GuideCardProps {
  onClick: () => void
}

export function ProviderGuideCard({ onClick }: GuideCardProps) {
  const { t } = useTranslation("ai")

  return (
    <button
      type="button"
      className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/20 transition-colors hover:border-primary/30 hover:bg-muted/40"
      onClick={onClick}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Plus className="h-5 w-5 text-muted-foreground" />
      </div>
      <span className="text-sm text-muted-foreground">{t("providers.create")}</span>
    </button>
  )
}
