import { useState, useMemo, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft, Pencil, Plus, Search, Star, Trash2,
  Users, Building2, MoreHorizontal, ArrowRightLeft,
  ChevronRight, X, Check, ChevronsUpDown, Network,
} from "lucide-react"
import { usePermission } from "@/hooks/use-permission"
import { useListPage } from "@/hooks/use-list-page"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import {
  DataTableActionsCell, DataTableActionsHead, DataTableEmptyRow,
  DataTableLoadingRow, DataTablePagination,
} from "@/components/ui/data-table"
import type { TreeNode, MemberWithPositions, PositionItem } from "../../types"
import { findNodeById } from "../../types"
import { DepartmentSheet } from "../../components/department-sheet"
import { EditPositionsSheet } from "../../components/change-position-sheet"
import { UserOrgSheet } from "../../components/user-org-sheet"
import { AddMemberSheet } from "../../components/add-member-sheet"

// ─── Info Card ──────────────────────────────────────────────────────────────

function InfoCard({
  dept,
  parentName,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  isDeleting,
}: {
  dept: TreeNode
  parentName: string | null
  canUpdate: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const { t } = useTranslation(["org", "common"])

  return (
    <div className="border-b border-border/50 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/55 bg-surface/60 text-sm font-semibold text-foreground/80">
            {dept.name.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="workspace-page-title truncate">{dept.name}</h2>
              <Badge variant="outline" className="bg-transparent text-[10px] font-normal text-muted-foreground">
                {dept.code}
              </Badge>
              <Badge variant="outline" className="gap-1.5 bg-transparent font-normal">
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  dept.isActive ? "bg-emerald-500" : "bg-muted-foreground/45",
                )} />
                {dept.isActive ? t("org:departments.active") : t("org:departments.inactive")}
              </Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t("org:departments.manager")}</span>
                <span className="ml-2 text-foreground">{dept.managerName || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("org:departments.parentDept")}</span>
                <span className="ml-2 text-foreground">{parentName || t("org:departments.topLevel")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("org:assignments.memberCount")}</span>
                <span className="ml-2 text-foreground tabular-nums">{dept.memberCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("org:departments.createdAt")}</span>
                <span className="ml-2 text-foreground">{dept.createdAt ? formatDateTime(dept.createdAt, { dateOnly: true }) : "—"}</span>
              </div>
            </div>
            {dept.description && (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{dept.description}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t("common:edit")}
            </Button>
          )}
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t("common:actions")}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("common:delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Allowed Positions Section ──────────────────────────────────────────────

function AllowedPositionsSection({ deptId }: { deptId: number }) {
  const { t } = useTranslation(["org", "common"])
  const queryClient = useQueryClient()
  const canUpdate = usePermission("org:department:update")
  const [popoverOpen, setPopoverOpen] = useState(false)

  const { data: allowedPositions = [] } = useQuery({
    queryKey: ["departments", deptId, "positions"],
    queryFn: async () => {
      const res = await api.get<{ items: PositionItem[] }>(`/api/v1/org/departments/${deptId}/positions`)
      return res.items ?? []
    },
  })

  const { data: allPositions = [] } = useQuery({
    queryKey: ["positions", "all"],
    queryFn: async () => {
      const res = await api.get<{ items: PositionItem[] }>("/api/v1/org/positions?page=1&pageSize=1000")
      return res.items ?? []
    },
    enabled: popoverOpen,
  })

  const allowedIds = useMemo(() => new Set(allowedPositions.map((p) => p.id)), [allowedPositions])

  const saveMutation = useMutation({
    mutationFn: (positionIds: number[]) =>
      api.put(`/api/v1/org/departments/${deptId}/positions`, { positionIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments", deptId, "positions"] })
    },
    onError: (err) => toast.error(err.message),
  })

  function togglePosition(posId: number) {
    const current = allowedPositions.map((p) => p.id)
    const next = current.includes(posId) ? current.filter((id) => id !== posId) : [...current, posId]
    saveMutation.mutate(next)
  }

  function removePosition(posId: number) {
    const next = allowedPositions.map((p) => p.id).filter((id) => id !== posId)
    saveMutation.mutate(next)
  }

  return (
    <div className="workspace-surface rounded-xl">
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
        <h3 className="text-sm font-semibold">{t("org:departments.allowedPositions")}</h3>
        {canUpdate && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5" />
                {t("org:departments.managePositions")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <Command>
                <CommandInput placeholder={t("org:positions.searchPlaceholder")} />
                <CommandList>
                  <CommandEmpty>{t("org:positions.empty")}</CommandEmpty>
                  <CommandGroup>
                    {allPositions.map((pos) => (
                      <CommandItem
                        key={pos.id}
                        value={pos.name}
                        onSelect={() => togglePosition(pos.id)}
                      >
                        <Check className={cn("mr-2 h-4 w-4", allowedIds.has(pos.id) ? "opacity-100" : "opacity-0")} />
                        {pos.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="px-5 py-3">
        {allowedPositions.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t("org:departments.noPositions")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allowedPositions.map((pos) => (
              <Badge key={pos.id} variant="outline" className="gap-1.5 bg-white/35 py-1 pr-1">
                <span>{pos.name}</span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  {t("org:positions.membersCount", { count: pos.memberCount ?? 0 })}
                </span>
                {canUpdate && (
                  <button
                    type="button"
                    className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-surface-soft hover:text-foreground"
                    onClick={() => removePosition(pos.id)}
                    aria-label={t("common:delete")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Member List Section ────────────────────────────────────────────────────

function MemberSection({
  deptId,
  deptName,
}: {
  deptId: number
  deptName: string
}) {
  const { t } = useTranslation(["org", "common"])
  const queryClient = useQueryClient()
  const canCreate = usePermission("org:assignment:create")
  const canUpdate = usePermission("org:assignment:update")
  const canDelete = usePermission("org:assignment:delete")

  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [editPositionsTarget, setEditPositionsTarget] = useState<MemberWithPositions | null>(null)
  const [orgSheetTarget, setOrgSheetTarget] = useState<MemberWithPositions | null>(null)
  const [removeTarget, setRemoveTarget] = useState<MemberWithPositions | null>(null)

  const extraParams = useMemo(() => ({ departmentId: String(deptId) }), [deptId])

  const {
    keyword, setKeyword, page, setPage,
    items, total, totalPages, isLoading, handleSearch,
  } = useListPage<MemberWithPositions>({
    queryKey: "org-assignments",
    endpoint: "/api/v1/org/users",
    extraParams,
  })

  const existingUserIds = useMemo(() => new Set(items.map((m) => m.userId)), [items])

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["org-assignments"] })
    queryClient.invalidateQueries({ queryKey: ["departments", "tree"] })
  }, [queryClient])

  const removeMutation = useMutation({
    mutationFn: async (member: MemberWithPositions) => {
      await api.put(`/api/v1/org/users/${member.userId}/departments/${member.departmentId}/positions`, {
        positionIds: [],
      })
    },
    onSuccess: () => {
      toast.success(t("org:assignments.removeSuccess"))
      invalidateAll()
      setRemoveTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Build a minimal TreeNode for AddMemberSheet compatibility
  const selectedDept = useMemo(() => ({
    id: deptId,
    name: deptName,
    code: "",
    memberCount: total,
    parentId: null,
    managerId: null,
    managerName: "",
    sort: 0,
    description: "",
    isActive: true,
    createdAt: "",
    updatedAt: "",
  }), [deptId, deptName, total])

  return (
    <>
      <div className="workspace-surface rounded-xl">
        <div className="flex flex-col gap-3 border-b border-border/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold">
            {t("org:departments.members")}
            {total > 0 && <span className="ml-1.5 font-normal text-muted-foreground">({total})</span>}
          </h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form onSubmit={handleSearch} className="flex min-w-0 gap-2">
              <div className="relative min-w-0">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={t("org:assignments.searchPlaceholder")}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="workspace-toolbar-input h-8 w-full pl-8 text-xs sm:w-48"
                />
              </div>
            </form>
            {canCreate && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setAddSheetOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t("org:assignments.addMember")}
              </Button>
            )}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">{t("org:assignments.user")}</TableHead>
              <TableHead className="min-w-[200px]">{t("org:assignments.position")}</TableHead>
              <TableHead className="w-[140px]">{t("org:assignments.assignedAt")}</TableHead>
              <DataTableActionsHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <DataTableLoadingRow colSpan={4} />
            ) : items.length === 0 ? (
              <DataTableEmptyRow
                colSpan={4}
                icon={Users}
                title={t("org:assignments.empty")}
                description={canCreate ? t("org:assignments.emptyHint") : undefined}
              />
            ) : (
              items.map((item) => (
                <TableRow key={item.userId} className="border-border/45 hover:bg-surface-soft/45">
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-3">
                      {item.avatar ? (
                        <img src={item.avatar} alt={item.username} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground/80">
                          {item.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.username}</p>
                        {item.email && <p className="truncate text-xs text-muted-foreground">{item.email}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.positions.map((pos) => (
                        <Badge key={pos.assignmentId} variant={pos.isPrimary ? "default" : "outline"} className={cn("gap-1 text-[11px]", !pos.isPrimary && "bg-transparent")}>
                          {pos.isPrimary && <Star className="h-3 w-3" />}
                          {pos.positionName}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {item.createdAt ? formatDateTime(item.createdAt, { dateOnly: true }) : "—"}
                  </TableCell>
                  <DataTableActionsCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="rounded-lg" aria-label={t("common:actions")}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => setEditPositionsTarget(item)}>
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            {t("org:assignments.editPositions")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setOrgSheetTarget(item)}>
                          <Building2 className="mr-2 h-4 w-4" />
                          {t("org:assignments.viewOrgInfo")}
                        </DropdownMenuItem>
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setRemoveTarget(item)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("org:assignments.removeMember")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </DataTableActionsCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="border-t border-border/60 px-5 py-3">
            <DataTablePagination
              total={total}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              className="pt-0"
            />
          </div>
        )}
      </div>

      <AddMemberSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        selectedDept={selectedDept}
        deptId={deptId}
        existingUserIds={existingUserIds}
        onSuccess={() => {}}
      />

      {editPositionsTarget && (
        <EditPositionsSheet
          open={!!editPositionsTarget}
          onOpenChange={(open) => { if (!open) setEditPositionsTarget(null) }}
          userId={editPositionsTarget.userId}
          departmentId={deptId}
          currentPositions={editPositionsTarget.positions}
          onSuccess={invalidateAll}
        />
      )}

      <UserOrgSheet
        open={!!orgSheetTarget}
        onOpenChange={(open) => { if (!open) setOrgSheetTarget(null) }}
        userId={orgSheetTarget?.userId ?? null}
        username={orgSheetTarget?.username ?? ""}
        email={orgSheetTarget?.email ?? ""}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("org:assignments.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("org:assignments.removeDesc", { name: removeTarget?.username })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && removeMutation.mutate(removeTarget)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("org:assignments.confirmRemove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Sub-departments Section ────────────────────────────────────────────────

function SubDepartmentsSection({ children }: { children: TreeNode[] }) {
  const { t } = useTranslation("org")
  const navigate = useNavigate()

  return (
    <div className="workspace-surface rounded-xl">
      <div className="border-b border-border/50 px-5 py-3">
        <h3 className="text-sm font-semibold">
          {t("departments.subDepartments")}
          <span className="ml-1.5 font-normal text-muted-foreground">({children.length})</span>
        </h3>
      </div>
      <div className="divide-y divide-border/45">
        {children.map((child) => (
          <button
            key={child.id}
            type="button"
            className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-surface-soft/45"
            onClick={() => navigate(`/org/departments/${child.id}`)}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{child.name}</span>
                <Badge variant="outline" className="text-[10px]">{child.code}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {child.managerName || "—"} · {t("departments.memberCount_label", { count: child.memberCount })}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Detail Page ───────────────────────────────────────────────────────

export function Component() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation(["org", "common"])
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const canUpdate = usePermission("org:department:update")
  const canDelete = usePermission("org:department:delete")

  const { data: treeData } = useQuery({
    queryKey: ["departments", "tree"],
    queryFn: async () => {
      const res = await api.get<{ items: TreeNode[] }>("/api/v1/org/departments/tree")
      return res.items ?? []
    },
  })

  const dept = useMemo(() => {
    if (!treeData || !id) return null
    return findNodeById(treeData, Number(id))
  }, [treeData, id])

  const parentName = useMemo(() => {
    if (!treeData || !dept?.parentId) return null
    const parent = findNodeById(treeData, dept.parentId)
    return parent?.name ?? null
  }, [treeData, dept])

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/org/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments", "tree"] })
      toast.success(t("org:departments.deleteSuccess"))
      navigate("/org/departments")
    },
    onError: (err) => toast.error(err.message),
  })

  if (!treeData) {
    return (
      <div className="workspace-page">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded-xl border border-border/50 bg-muted/30" />
        <div className="h-64 animate-pulse rounded-xl border border-border/50 bg-muted/30" />
      </div>
    )
  }

  if (!dept) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Network className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("org:departments.empty")}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/org/departments">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("org:departments.title")}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="workspace-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/org/departments">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("org:departments.title")}
          </Link>
        </Button>
      </div>

      <InfoCard
        dept={dept}
        parentName={parentName}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteDialogOpen(true)}
        isDeleting={deleteMutation.isPending}
      />

      <AllowedPositionsSection deptId={dept.id} />

      <MemberSection deptId={dept.id} deptName={dept.name} />

      {dept.children && dept.children.length > 0 && (
        <SubDepartmentsSection>{dept.children}</SubDepartmentsSection>
      )}

      <DepartmentSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        department={{
          id: dept.id,
          name: dept.name,
          code: dept.code,
          parentId: dept.parentId,
          managerId: dept.managerId,
          managerName: dept.managerName,
          sort: dept.sort,
          description: dept.description,
          isActive: dept.isActive,
          createdAt: dept.createdAt,
          updatedAt: dept.updatedAt,
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("org:departments.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("org:departments.deleteDesc", { name: dept.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {t("org:departments.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
