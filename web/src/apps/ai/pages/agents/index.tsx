import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, Bot, Pencil, Trash2, Code2, BrainCircuit } from "lucide-react"
import { usePermission } from "@/hooks/use-permission"
import { useListPage } from "@/hooks/use-list-page"
import { agentApi, type AgentInfo } from "@/lib/api"
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { formatDateTime } from "@/lib/utils"
import { AgentSheet } from "./components/agent-sheet"

const TYPE_ICON: Record<string, typeof Bot> = {
  assistant: BrainCircuit,
  coding: Code2,
}

const VISIBILITY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  public: "default",
  team: "secondary",
  private: "outline",
}

export function Component() {
  const { t } = useTranslation(["ai", "common"])
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AgentInfo | null>(null)

  const canCreate = usePermission("ai:agent:create")
  const canUpdate = usePermission("ai:agent:update")
  const canDelete = usePermission("ai:agent:delete")

  const {
    keyword, setKeyword, page, setPage,
    items: agents, total, totalPages, isLoading, handleSearch,
  } = useListPage<AgentInfo>({
    queryKey: "ai-agents",
    endpoint: "/api/v1/ai/agents",
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => agentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] })
      toast.success(t("ai:agents.deleteSuccess"))
    },
    onError: (err) => toast.error(err.message),
  })

  function handleCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function handleEdit(item: AgentInfo) {
    setEditing(item)
    setFormOpen(true)
  }

  const colSpan = 6

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("ai:agents.title")}</h2>
        {canCreate && (
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("ai:agents.create")}
          </Button>
        )}
      </div>

      <DataTableToolbar>
        <DataTableToolbarGroup>
          <form onSubmit={handleSearch} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("ai:agents.searchPlaceholder")}
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
              <TableHead className="min-w-[200px]">{t("ai:agents.name")}</TableHead>
              <TableHead className="w-[120px]">{t("ai:agents.type")}</TableHead>
              <TableHead className="w-[100px]">{t("ai:agents.visibility")}</TableHead>
              <TableHead className="w-[80px]">{t("ai:agents.status")}</TableHead>
              <TableHead className="w-[150px]">{t("common:createdAt")}</TableHead>
              <DataTableActionsHead className="min-w-[120px]">{t("common:actions")}</DataTableActionsHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <DataTableLoadingRow colSpan={colSpan} />
            ) : agents.length === 0 ? (
              <DataTableEmptyRow
                colSpan={colSpan}
                icon={Bot}
                title={t("ai:agents.empty")}
                description={canCreate ? t("ai:agents.emptyHint") : undefined}
              />
            ) : (
              agents.map((item) => {
                const TypeIcon = TYPE_ICON[item.type] ?? Bot
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{t(`ai:agents.agentTypes.${item.type}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={VISIBILITY_VARIANTS[item.visibility] ?? "secondary"}>
                        {t(`ai:agents.visibilityOptions.${item.visibility}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? "default" : "secondary"}>
                        {item.isActive ? t("ai:statusLabels.active") : t("ai:statusLabels.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <DataTableActionsCell>
                      <DataTableActions>
                        {canUpdate && (
                          <Button variant="ghost" size="sm" className="px-2.5" onClick={() => handleEdit(item)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            {t("common:edit")}
                          </Button>
                        )}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="px-2.5 text-destructive hover:text-destructive">
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                {t("common:delete")}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("ai:agents.deleteTitle")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("ai:agents.deleteDesc", { name: item.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(item.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  {t("ai:agents.confirmDelete")}
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

      <DataTablePagination total={total} page={page} totalPages={totalPages} onPageChange={setPage} />

      <AgentSheet open={formOpen} onOpenChange={setFormOpen} agent={editing} />
    </div>
  )
}
