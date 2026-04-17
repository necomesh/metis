import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, Server } from "lucide-react"
import { usePermission } from "@/hooks/use-permission"
import { useListPage } from "@/hooks/use-list-page"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DataTableToolbar, DataTableToolbarGroup } from "@/components/ui/data-table"
import { ProviderSheet, type ProviderItem } from "../../components/provider-sheet"
import { ProviderCard, ProviderGuideCard } from "../../components/provider-card"

export function Component() {
  const { t } = useTranslation(["ai", "common"])
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProviderItem | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)

  const canCreate = usePermission("ai:provider:create")
  const canUpdate = usePermission("ai:provider:update")
  const canDelete = usePermission("ai:provider:delete")
  const canTest = usePermission("ai:provider:test")

  const {
    keyword, setKeyword, items: providers, isLoading, handleSearch,
  } = useListPage<ProviderItem>({
    queryKey: "ai-providers",
    endpoint: "/api/v1/ai/providers",
    pageSize: 100,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/ai/providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] })
      setDeleteTarget(null)
      toast.success(t("ai:providers.deleteSuccess"))
    },
    onError: (err) => toast.error(err.message),
  })

  const testMutation = useMutation({
    mutationFn: (id: number) => {
      setTestingId(id)
      return api.post<{ success: boolean; error?: string }>(`/api/v1/ai/providers/${id}/test`)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] })
      if (data.success) {
        toast.success(t("ai:providers.testSuccess"))
      } else {
        toast.error(t("ai:providers.testFailed", { error: data.error }))
      }
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setTestingId(null),
  })

  function handleCreate() {
    setFormOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("ai:providers.title")}</h2>
        {canCreate && (
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("ai:providers.create")}
          </Button>
        )}
      </div>

      <DataTableToolbar>
        <DataTableToolbarGroup>
          <form onSubmit={handleSearch} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("ai:providers.searchPlaceholder")}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline">
              {t("common:search")}
            </Button>
          </form>
        </DataTableToolbarGroup>
      </DataTableToolbar>

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[200px] animate-pulse rounded-xl border bg-muted/30" />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Server className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("ai:providers.empty")}</p>
            {canCreate && (
              <p className="mt-1 text-xs text-muted-foreground/70">{t("ai:providers.emptyHint")}</p>
            )}
          </div>
          {canCreate && (
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("ai:providers.create")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canTest={canTest}
              testingId={testingId}
              onTest={(id) => testMutation.mutate(id)}
              onDelete={setDeleteTarget}
            />
          ))}
          {canCreate && <ProviderGuideCard onClick={handleCreate} />}
        </div>
      )}

      <ProviderSheet open={formOpen} onOpenChange={setFormOpen} provider={null} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ai:providers.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ai:providers.deleteDesc", { name: deleteTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {t("ai:providers.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
