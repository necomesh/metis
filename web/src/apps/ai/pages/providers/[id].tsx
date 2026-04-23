import { useState } from "react"
import { useParams, Link } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft, Pencil, Zap, RefreshCw, Plus, Search,
  Star, Trash2, Cpu, ChevronLeft, ChevronRight,
} from "lucide-react"
import { usePermission } from "@/hooks/use-permission"
import { api, type PaginatedResponse } from "@/lib/api"
import { toast } from "sonner"
import { formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DataTableActionsCell,
  DataTableActionsHead,
} from "@/components/ui/data-table"
import { getProviderBrand } from "../../lib/provider-brand"
import { ProviderLogo } from "../../components/provider-logo"
import { StatusDot } from "../../components/status-dot"
import { ProviderSheet, type ProviderItem } from "../../components/provider-sheet"
import { ModelSheet, type ModelItem } from "../../components/model-sheet"

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  inactive: "secondary",
  error: "destructive",
  deprecated: "outline",
}

const TYPE_ORDER = ["llm", "embed", "rerank", "tts", "stt", "image", "other", ""] as const

function groupByType(models: ModelItem[]) {
  const groups: Record<string, ModelItem[]> = {}
  for (const m of models) {
    const key = m.type || ""
    const arr = groups[key] || (groups[key] = [])
    arr.push(m)
  }
  return TYPE_ORDER.filter((t) => groups[t]).map((t) => ({ type: t, items: groups[t] }))
}

function getEmptyTypeGroups() {
  return TYPE_ORDER
    .filter((type) => type)
    .map((type) => ({ type, items: [] as ModelItem[] }))
}

const PAGE_SIZE = 5

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages] as const
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages] as const
}

// ─── Provider Info Section ──────────────────────────────────────────────────

function ProviderInfoSection({
  provider,
  canUpdate,
  canTest,
  onEdit,
  onTest,
  onSync,
  isTesting,
  isSyncing,
}: {
  provider: ProviderItem
  canUpdate: boolean
  canTest: boolean
  onEdit: () => void
  onTest: () => void
  onSync: () => void
  isTesting: boolean
  isSyncing: boolean
}) {
  const { t } = useTranslation(["ai", "common"])
  const brand = getProviderBrand(provider.type)

  return (
    <section className="space-y-4 border-b pb-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted/35 p-2">
            <ProviderLogo type={provider.type} label={brand.label} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold leading-tight">{provider.name}</h2>
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {t(`ai:types.${provider.type}`, provider.type)}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span>{provider.baseUrl}</span>
              <div className="flex items-center gap-1.5">
                <StatusDot status={provider.status} loading={isTesting} />
                <span>{t(`ai:statusLabels.${provider.status}`, provider.status)}</span>
              </div>
              <span>{t("ai:providers.protocol")}: {provider.protocol}</span>
              <span>{t("ai:providers.healthCheckedAt")}: {provider.healthCheckedAt ? formatDateTime(provider.healthCheckedAt) : "—"}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {canTest && (
            <Button variant="outline" size="sm" disabled={isTesting} onClick={onTest}>
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              {isTesting ? t("ai:providers.testing") : t("ai:providers.testConnection")}
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={isSyncing} onClick={onSync}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {isSyncing ? t("ai:providers.syncing") : t("ai:providers.syncModels")}
          </Button>
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t("common:edit")}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── Model Type Panel ───────────────────────────────────────────────────────

function ModelTypePanel({
  type,
  rawItems,
  keyword,
  onKeywordChange,
  page,
  onPageChange,
  canCreate,
  canUpdate,
  canDelete,
  canSetDefault,
  onCreateModel,
  onEditModel,
  deleteMutation,
  setDefaultMutation,
}: {
  type: string
  rawItems: ModelItem[]
  keyword: string
  onKeywordChange: (keyword: string) => void
  page: number
  onPageChange: (page: number) => void
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canSetDefault: boolean
  onCreateModel: (type: string) => void
  onEditModel: (model: ModelItem) => void
  deleteMutation: ReturnType<typeof useMutation<unknown, Error, number>>
  setDefaultMutation: ReturnType<typeof useMutation<unknown, Error, number>>
}) {
  const { t } = useTranslation(["ai", "common"])

  const filteredItems = !keyword
    ? rawItems
    : rawItems.filter((m) => {
        const kw = keyword.toLowerCase()
        return (
          m.displayName.toLowerCase().includes(kw) ||
          m.modelId.toLowerCase().includes(kw)
        )
      })

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <section className="flex h-[420px] flex-col overflow-hidden rounded-2xl border border-border/50 bg-background/40">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium tracking-[0.01em] text-foreground/90">
            {type ? t(`ai:modelTypes.${type}`) : t("ai:modelTypes.unclassified")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative border-b border-border/50">
            <Search className="absolute left-0 top-2 h-3.5 w-3.5 text-muted-foreground/70" />
            <Input
              placeholder={t("ai:models.searchPlaceholder")}
              value={keyword}
              onChange={(e) => {
                onKeywordChange(e.target.value)
                onPageChange(1)
              }}
              className="h-8 w-40 rounded-none border-0 bg-transparent px-0 pl-7 text-xs shadow-none ring-0 placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:outline-none"
            />
          </div>
          {canCreate && type ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onCreateModel(type)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("ai:models.create")}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mx-4 border-t border-border/50" />
      {filteredItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <Cpu className="h-8 w-8 text-muted-foreground/35" />
          <p className="text-sm text-muted-foreground">
            {keyword ? t("ai:models.emptySearch") : t("ai:models.empty")}
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[148px]">{t("ai:models.displayName")}</TableHead>
                  <TableHead className="w-[220px] min-w-[220px]">{t("ai:models.modelId")}</TableHead>
                  <TableHead className="w-[68px]">{t("ai:models.status")}</TableHead>
                  <TableHead className="w-[44px] text-center">{t("ai:models.isDefault")}</TableHead>
                  <DataTableActionsHead className="w-[104px] text-center">{t("common:actions")}</DataTableActionsHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.displayName}</TableCell>
                    <TableCell className="w-[220px] max-w-[220px] font-mono text-xs text-muted-foreground">
                      <span className="block truncate whitespace-nowrap" title={m.modelId}>
                        {m.modelId}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[m.status] ?? "secondary"}>
                        {t(`ai:statusLabels.${m.status}`, m.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {m.isDefault && <Star className="mx-auto h-4 w-4 fill-yellow-500 text-yellow-500" />}
                    </TableCell>
                    <DataTableActionsCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canSetDefault && !m.isDefault && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={setDefaultMutation.isPending}
                            onClick={() => setDefaultMutation.mutate(m.id)}
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEditModel(m)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("ai:models.deleteTitle")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("ai:models.deleteDesc", { name: m.displayName })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(m.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  {t("ai:models.confirmDelete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </DataTableActionsCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              {getVisiblePages(safePage, totalPages).map((p, index) => {
                if (p === "ellipsis") {
                  return (
                    <span key={`ellipsis-${safePage}-${index}`} className="px-1 text-muted-foreground/60">
                      ...
                    </span>
                  )
                }

                return (
                  <Button
                    key={p}
                    variant={p === safePage ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 min-w-7 px-1.5 text-xs"
                    onClick={() => onPageChange(p)}
                  >
                    {p}
                  </Button>
                )
              })}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={safePage <= 1}
                onClick={() => onPageChange(Math.max(1, safePage - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={safePage >= totalPages}
                onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

// ─── Model Management Section ───────────────────────────────────────────────

function ModelManagementSection({ provider }: { provider: ProviderItem }) {
  const { t } = useTranslation(["ai", "common"])
  const queryClient = useQueryClient()
  const [modelFormOpen, setModelFormOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelItem | null>(null)
  const [creatingType, setCreatingType] = useState<string | null>(null)
  const [searchByType, setSearchByType] = useState<Record<string, string>>({})
  const [pageByType, setPageByType] = useState<Record<string, number>>({})

  const canCreateModel = usePermission("ai:model:create")
  const canUpdateModel = usePermission("ai:model:update")
  const canDeleteModel = usePermission("ai:model:delete")
  const canSetDefault = usePermission("ai:model:default")

  const { data, isLoading } = useQuery({
    queryKey: ["ai-models", { providerId: provider.id }],
    queryFn: () =>
      api.get<PaginatedResponse<ModelItem>>(
        `/api/v1/ai/models?providerId=${provider.id}&pageSize=500`,
      ),
  })
  const allModels = data?.items ?? []
  const groups = allModels.length > 0 ? groupByType(allModels) : getEmptyTypeGroups()

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/ai/models/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-models"] })
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] })
      toast.success(t("ai:models.deleteSuccess"))
    },
    onError: (err) => toast.error(err.message),
  })

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/v1/ai/models/${id}/default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-models"] })
      toast.success(t("ai:models.setDefaultSuccess"))
    },
    onError: (err) => toast.error(err.message),
  })

  function handleCreateModel(type: string) {
    setEditingModel(null)
    setCreatingType(type)
    setModelFormOpen(true)
  }

  function handleEditModel(model: ModelItem) {
    setEditingModel(model)
    setCreatingType(null)
    setModelFormOpen(true)
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          {t("common:loading")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {groups.map(({ type, items: rawItems }) => (
            <ModelTypePanel
              key={type}
              type={type}
              rawItems={rawItems}
              keyword={searchByType[type] ?? ""}
              onKeywordChange={(kw) => setSearchByType((prev) => ({ ...prev, [type]: kw }))}
              page={pageByType[type] ?? 1}
              onPageChange={(p) => setPageByType((prev) => ({ ...prev, [type]: p }))}
              canCreate={canCreateModel}
              canUpdate={canUpdateModel}
              canDelete={canDeleteModel}
              canSetDefault={canSetDefault}
              onCreateModel={handleCreateModel}
              onEditModel={handleEditModel}
              deleteMutation={deleteMutation}
              setDefaultMutation={setDefaultMutation}
            />
          ))}
        </div>
      )}

      <ModelSheet
        open={modelFormOpen}
        onOpenChange={setModelFormOpen}
        model={editingModel}
        defaultProviderId={provider.id}
        defaultType={creatingType ?? undefined}
      />
    </div>
  )
}

// ─── Main Detail Page ───────────────────────────────────────────────────────

export function Component() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation(["ai", "common"])
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const canUpdate = usePermission("ai:provider:update")
  const canTest = usePermission("ai:provider:test")

  const { data: provider, isLoading, isError } = useQuery({
    queryKey: ["ai-provider", id],
    queryFn: () => api.get<ProviderItem>(`/api/v1/ai/providers/${id}`),
    enabled: !!id,
  })

  const testMutation = useMutation({
    mutationFn: () =>
      api.post<{ success: boolean; error?: string }>(`/api/v1/ai/providers/${id}/test`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-provider", id] })
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] })
      if (data.success) {
        toast.success(t("ai:providers.testSuccess"))
      } else {
        toast.error(t("ai:providers.testFailed", { error: data.error }))
      }
    },
    onError: (err) => toast.error(err.message),
  })

  const syncMutation = useMutation({
    mutationFn: () =>
      api.post<{ added: number }>(`/api/v1/ai/providers/${id}/sync-models`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-models"] })
      queryClient.invalidateQueries({ queryKey: ["ai-provider", id] })
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] })
      toast.success(t("ai:providers.syncSuccess", { count: data.added }))
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded-xl border bg-muted/30" />
        <div className="h-64 animate-pulse rounded-xl border bg-muted/30" />
      </div>
    )
  }

  if (isError || !provider) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("ai:providers.empty")}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/ai/providers">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("ai:providers.backToList")}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/ai/providers" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("ai:providers.backToList")}
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-foreground">{provider.name}</span>
      </nav>

      <ProviderInfoSection
        provider={provider}
        canUpdate={canUpdate}
        canTest={canTest}
        onEdit={() => setEditOpen(true)}
        onTest={() => testMutation.mutate()}
        onSync={() => syncMutation.mutate()}
        isTesting={testMutation.isPending}
        isSyncing={syncMutation.isPending}
      />

      <ModelManagementSection provider={provider} />

      <ProviderSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        provider={provider}
      />
    </div>
  )
}
