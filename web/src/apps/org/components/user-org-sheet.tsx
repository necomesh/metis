import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Star } from "lucide-react"
import { useMemo } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

interface UserOrgSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number | null
  username: string
  email: string
}

interface UserPositionItem {
  id: number
  userId: number
  departmentId: number
  positionId: number
  isPrimary: boolean
  department?: { id: number; name: string }
  position?: { id: number; name: string }
}

export function UserOrgSheet({ open, onOpenChange, userId, username, email }: UserOrgSheetProps) {
  const { t } = useTranslation(["org", "common"])

  const { data: positions, isLoading } = useQuery({
    queryKey: ["user-org-positions", userId],
    queryFn: async () => {
      const res = await api.get<{ items: UserPositionItem[] }>(`/api/v1/org/users/${userId}/positions`)
      return res.items
    },
    enabled: open && !!userId,
  })

  const grouped = useMemo(() => {
    const map = new Map<number, {
      department: { id: number; name: string }
      positions: UserPositionItem[]
    }>()
    for (const item of positions ?? []) {
      const dept = item.department ?? { id: item.departmentId, name: "-" }
      const group = map.get(dept.id)
      if (group) {
        group.positions.push(item)
      } else {
        map.set(dept.id, { department: dept, positions: [item] })
      }
    }
    return Array.from(map.values())
  }, [positions])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{t("org:assignments.orgInfo")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("org:assignments.orgInfo")}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-auto px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground/80">
                {username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{username}</p>
                {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("org:assignments.orgAssignments")}
              </p>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
              ) : grouped.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("org:assignments.noAssignments")}</p>
              ) : (
                <div className="space-y-2">
                  {grouped.map((group) => (
                    <div
                      key={group.department.id}
                      className="rounded-lg border border-border/55 bg-surface/35 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{group.department.name}</p>
                        <Badge variant="outline" className="shrink-0 bg-transparent font-normal">
                          {t("org:departments.positionCount", { count: group.positions.length })}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {group.positions.map((item) => (
                          <Badge
                            key={item.id}
                            variant={item.isPrimary ? "default" : "outline"}
                            className="gap-1 text-[11px]"
                          >
                            {item.isPrimary && <Star className="h-3 w-3" />}
                            {item.position?.name ?? "-"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
