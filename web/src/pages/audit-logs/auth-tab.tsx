import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Search, ShieldAlert } from "lucide-react"
import { useListPage } from "@/hooks/use-list-page"
import { parseUserAgent } from "@/lib/ua-parser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DataTableCard,
  DataTableEmptyRow,
  DataTableLoadingRow,
  DataTablePagination,
  DataTableToolbar,
} from "@/components/ui/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/lib/utils"

interface AuditLog {
  id: number
  createdAt: string
  category: string
  userId: number | null
  username: string
  action: string
  summary: string
  level: string
  ipAddress: string
  userAgent: string
  detail: string | null
}

const actionVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  login_success: "default",
  login_failed: "destructive",
  logout: "secondary",
}

export function AuthTab() {
  const { t } = useTranslation(["audit", "common"])
  const [action, setAction] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const extraParams = useMemo(() => {
    const params: Record<string, string> = { category: "auth" }
    if (action) params.action = action
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo
    return params
  }, [action, dateFrom, dateTo])

  const {
    keyword,
    setKeyword,
    page,
    setPage,
    items,
    total,
    totalPages,
    isLoading,
    handleSearch,
  } = useListPage<AuditLog>({
    queryKey: "audit-logs-auth",
    endpoint: "/api/v1/audit-logs",
    extraParams,
  })

  return (
    <div className="space-y-4 pt-4">
      <DataTableToolbar className="flex-wrap items-center gap-2">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            placeholder={t("audit:auth.searchPlaceholder")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="h-8 w-48"
          />
          <Button type="submit" variant="outline">
            <Search className="mr-1 h-3.5 w-3.5" />
            {t("common:search")}
          </Button>
        </form>
        <Select value={action} onValueChange={(v) => { setAction(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue placeholder={t("audit:auth.eventType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("audit:all")}</SelectItem>
            <SelectItem value="login_success">{t("audit:auth.actions.login_success")}</SelectItem>
            <SelectItem value="login_failed">{t("audit:auth.actions.login_failed")}</SelectItem>
            <SelectItem value="logout">{t("audit:auth.actions.logout")}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          className="h-8 w-36"
        />
        <span className="text-muted-foreground text-sm">{t("audit:dateTo")}</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className="h-8 w-36"
        />
      </DataTableToolbar>

      <DataTableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">{t("audit:auth.columns.time")}</TableHead>
              <TableHead className="w-[140px]">{t("audit:auth.columns.user")}</TableHead>
              <TableHead className="w-[120px]">{t("audit:auth.columns.event")}</TableHead>
              <TableHead className="w-[140px]">{t("audit:auth.columns.ipAddress")}</TableHead>
              <TableHead className="min-w-[220px]">{t("audit:auth.columns.device")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <DataTableLoadingRow colSpan={5} />
            ) : items.length === 0 ? (
              <DataTableEmptyRow colSpan={5} icon={ShieldAlert} title={t("audit:auth.empty")} />
            ) : (
              items.map((log) => {
                const variant = actionVariants[log.action] ?? "outline" as const
                const label = t(`audit:auth.actions.${log.action}`, { defaultValue: log.action })
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{log.username || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={variant}>{label}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{log.ipAddress || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {log.userAgent ? parseUserAgent(log.userAgent) : "-"}
                    </TableCell>
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
    </div>
  )
}
