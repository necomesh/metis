import { useState, useMemo } from "react"
import { useParams, Link } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft, Pencil, Zap, RefreshCw, Plus, Search,
  Star, Trash2, Cpu,
} from "lucide-react"
import { usePermission } from "@/hooks/use-permission"
import { api, type PaginatedResponse } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
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
  DataTableActions,
  DataTableActionsCell,
  DataTableActionsHead,
} from "@/components/ui/data-table"
import { getProviderBrand } from "../../lib/provider-brand"
import { StatusDot } from "../../components/status-dot"
import { ProviderSheet, type ProviderItem } from "../../components/provider-sheet"
import { ModelSheet, type ModelItem } from "../../components/model-sheet"

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  inactive: "secondary",
  error: "destructive",
  deprecated: "outline",
}

const TYPE_ORDER = ["llm", "embed", "rerank", "tts", "stt", "image", ""] as const

function groupByType(models: ModelItem[]) {
  const groups: Record<string, ModelItem[]> = {}
  for (const m of models) {
    const key = m.type || ""
    const arr = groups[key] || (groups[key] = [])
    arr.push(m)
  }
  return TYPE_ORDER.filter((t) => groups[t]).map((t) => ({ type: t, items: groups[t] }))
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
    <div className="rounded-xl border bg-card">
      <div className={cn("h-1 w-full rounded-t-xl", brand.stripe)} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                brand.avatarBg,
              )}
            >
              {brand.avatarText}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{provider.name}</h2>
              <p className="text-sm text-muted-foreground">{provider.baseUrl}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("ai:providers.type")}</p>
            <Badge variant="outline" className="mt-1">{t(`ai:types.${provider.type}`, provider.type)}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("ai:providers.protocol")}</p>
            <p className="mt-1 text-sm">{provider.protocol}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("ai:providers.status")}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <StatusDot status={provider.status} loading={isTesting} />
              <Badge variant={STATUS_VARIANTS[provider.status] ?? "secondary"}>
                {t(`ai:statusLabels.${provider.status}`, provider.status)}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("ai:providers.apiKey")}</p>
            <p className="mt-1 font-mono text-sm">{provider.apiKeyMasked || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("ai:providers.healthCheckedAt")}</p>
            <p className="mt-1 text-sm">
              {provider.healthCheckedAt ? formatDateTime(provider.healthCheckedAt) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("ai:providers.modelCount")}</p>
            <p className="mt-1 text-sm">{provider.modelCount}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Model Management Section ───────────────────────────────────────────────

function ModelManagementSection({ provider }: { provider: ProviderItem }) {
  const { t } = useTranslation(["ai", "common"])
  const queryClient = useQueryClient()
  const [modelFormOpen, setModelFormOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelItem | null>(null)
  const [searchKeyword, setSearchKeyword] = useState("")

  const canCreateModel = usePermission("ai:model:create")
  const canUpdateModel = usePermission("ai:model:update")
  const canDeleteModel = usePermission("ai:model:delete")
  const canSetDefault = usePermission("ai:model:default")

  const { data, isLoading } = useQuery({
    queryKey: ["ai-models", { providerId: provider.id }],
    queryFn: () =>
      api.get<PaginatedResponse<ModelItem>>(
        `/api/v1/ai/models?providerId=${provider.id}&pageSize=100`,
      ),
  })
  const allModels = data?.items ?? []

  const filteredModels = useMemo(() => {
    if (!searchKeyword) return allModels
    const kw = searchKeyword.toLowerCase()
    return allModels.filter(
      (m) =>
        m.displayName.toLowerCase().includes(kw) ||
        m.modelId.toLowerCase().includes(kw),
    )
  }, [allModels, searchKeyword])

  const groups = groupByType(filteredModels)

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

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h3 className="text-sm font-semibold">{t("ai:models.title")}</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("ai:models.searchPlaceholder")}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="h-8 w-48 pl-8 text-xs"
            />
          </div>
          {canCreateModel && (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => { setEditingModel(null); setModelFormOpen(true) }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("ai:models.create")}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          {t("common:loading")}
        </div>
      ) : allModels.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <Cpu className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t("ai:models.empty")}</p>
          <p className="text-xs text-muted-foreground/70">{t("ai:models.emptyHint")}</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          {t("ai:models.empty")}
        </div>
      ) : (
        <div className="divide-y">
          {groups.map(({ type, items }) => (
            <div key={type}>
              <div className="px-5 py-2 bg-muted/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {type ? t(`ai:modelTypes.${type}`) : t("ai:modelTypes.unclassified")}
                  <span className="ml-1.5 text-muted-foreground/60 font-normal normal-case">({items.length})</span>
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">{t("ai:models.displayName")}</TableHead>
                    <TableHead className="w-[140px]">{t("ai:models.modelId")}</TableHead>
                    <TableHead className="w-[70px]">{t("ai:models.status")}</TableHead>
                    <TableHead className="w-[50px]">{t("ai:models.isDefault")}</TableHead>
                    <DataTableActionsHead className="min-w-[140px]">{t("common:actions")}</DataTableActionsHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.displayName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{m.modelId}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[m.status] ?? "secondary"}>
                          {t(`ai:statusLabels.${m.status}`, m.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.isDefault && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                      </TableCell>
                      <DataTableActionsCell>
                        <DataTableActions>
                          {canSetDefault && !m.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-2"
                              disabled={setDefaultMutation.isPending}
                              onClick={() => setDefaultMutation.mutate(m.id)}
                            >
                              <Star className="mr-1 h-3.5 w-3.5" />
                              {t("ai:models.setDefault")}
                            </Button>
                          )}
                          {canUpdateModel && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-2"
                              onClick={() => { setEditingModel(m); setModelFormOpen(true) }}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              {t("common:edit")}
                            </Button>
                          )}
                          {canDeleteModel && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-2 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  {t("common:delete")}
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
                        </DataTableActions>
                      </DataTableActionsCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      <ModelSheet
        open={modelFormOpen}
        onOpenChange={setModelFormOpen}
        model={editingModel}
        defaultProviderId={provider.id}
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/ai/providers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{provider.name}</h2>
      </div>

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
