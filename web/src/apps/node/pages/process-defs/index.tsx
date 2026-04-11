import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, Cpu, Pencil, Trash2 } from "lucide-react"
import { usePermission } from "@/hooks/use-permission"
import { useListPage } from "@/hooks/use-list-page"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DataTableActions,
  DataTableActionsCell,
  DataTableActionsHead,
  DataTableCard,
  DataTableEmptyRow,
  DataTableLoadingRow,
  DataTablePagination,
  DataTableToolbar,
  DataTableToolbarGroup,
} from "@/components/ui/data-table"
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
import { formatDateTime } from "@/lib/utils"
import { ProcessDefSheet, type ProcessDefItem } from "../../components/process-def-sheet"

const RESTART_POLICY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  always: "default",
  on_failure: "secondary",
  never: "outline",
}

export function Component() {
  const { t } = useTranslation(["node", "common"])
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProcessDefItem | null>(null)

  const canCreate = usePermission("node:process-def:create")
  const canUpdate = usePermission("node:process-def:update")
  const canDelete = usePermission("node:process-def:delete")

  const {
    keyword, setKeyword, page, setPage,
    items: processDefs, total, totalPages, isLoading, handleSearch,
  } = useListPage<ProcessDefItem>({
    queryKey: "process-defs",
    endpoint: "/api/v1/process-defs",
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/process-defs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-defs"] })
      toast.success(t("node:processDefs.deleteSuccess"))
    },
    onError: (err) => toast.error(err.message),
  })

  function handleCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function handleEdit(item: ProcessDefItem) {
    setEditing(item)
    setFormOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("node:processDefs.title")}</h2>
        {canCreate && (
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("node:processDefs.create")}
          </Button>
        )}
      </div>

      <DataTableToolbar>
        <DataTableToolbarGroup>
          <form onSubmit={handleSearch} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("node:processDefs.searchPlaceholder")}
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

      <DataTableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">{t("node:processDefs.displayName")}</TableHead>
              <TableHead className="w-[150px]">{t("node:processDefs.name")}</TableHead>
              <TableHead className="w-[200px]">{t("node:processDefs.startCommand")}</TableHead>
              <TableHead className="w-[120px]">{t("node:processDefs.restartPolicy")}</TableHead>
              <TableHead className="w-[100px]">{t("node:processDefs.probeType")}</TableHead>
              <TableHead className="w-[150px]">{t("common:createdAt")}</TableHead>
              <DataTableActionsHead className="min-w-[140px]">{t("common:actions")}</DataTableActionsHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <DataTableLoadingRow colSpan={7} />
            ) : processDefs.length === 0 ? (
              <DataTableEmptyRow
                colSpan={7}
                icon={Cpu}
                title={t("node:processDefs.empty")}
                description={canCreate ? t("node:processDefs.emptyHint") : undefined}
              />
            ) : (
              processDefs.map((item) => {
                const rpVariant = RESTART_POLICY_VARIANTS[item.restartPolicy] ?? ("secondary" as const)
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.displayName}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{item.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground truncate max-w-[200px]">
                      {item.startCommand}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rpVariant}>
                        {t(`node:processDefs.${item.restartPolicy}`, item.restartPolicy)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {t(`node:processDefs.${item.probeType}`, item.probeType)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <DataTableActionsCell>
                      <DataTableActions>
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-2.5"
                            onClick={() => handleEdit(item)}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            {t("common:edit")}
                          </Button>
                        )}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="px-2.5 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                {t("common:delete")}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("node:processDefs.deleteTitle")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("node:processDefs.deleteDesc", { name: item.displayName })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(item.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  {t("node:processDefs.confirmDelete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </DataTableActions>
                    </DataTableActionsCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </DataTableCard>

      <DataTablePagination
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <ProcessDefSheet open={formOpen} onOpenChange={setFormOpen} processDef={editing} />
    </div>
  )
}
