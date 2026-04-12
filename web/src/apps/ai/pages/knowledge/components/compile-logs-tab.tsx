import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTableCard } from "@/components/ui/data-table"
import { formatDateTime } from "@/lib/utils"
import type { LogItem } from "../types"

export function CompileLogsTab({ kbId }: { kbId: number }) {
  const { t } = useTranslation(["ai", "common"])

  const { data, isLoading } = useQuery({
    queryKey: ["ai-kb-logs", kbId],
    queryFn: () => api.get<{ items: LogItem[]; total: number }>(
      `/api/v1/ai/knowledge-bases/${kbId}/logs?pageSize=50`,
    ),
  })
  const logs = data?.items ?? []

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">{t("common:createdAt")}</TableHead>
            <TableHead className="w-[100px]">{t("ai:knowledge.logs.action")}</TableHead>
            <TableHead className="w-[140px]">{t("ai:knowledge.logs.model")}</TableHead>
            <TableHead className="w-[80px] text-center">{t("ai:knowledge.logs.created")}</TableHead>
            <TableHead className="w-[80px] text-center">{t("ai:knowledge.logs.updated")}</TableHead>
            <TableHead className="w-[80px] text-center">{t("ai:knowledge.logs.edges")}</TableHead>
            <TableHead className="w-[80px] text-center">{t("ai:knowledge.logs.lint")}</TableHead>
            <TableHead>{t("ai:knowledge.logs.error")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="h-28 text-center text-sm text-muted-foreground">
                {t("common:loading")}
              </TableCell>
            </TableRow>
          ) : logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-44 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <History className="h-10 w-10 stroke-1" />
                  <p className="text-sm font-medium">{t("ai:knowledge.logs.empty")}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDateTime(log.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={log.action === "recompile" ? "secondary" : "outline"}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-[140px]">
                  {log.modelId || "—"}
                </TableCell>
                <TableCell className="text-center text-sm">{log.nodesCreated}</TableCell>
                <TableCell className="text-center text-sm">{log.nodesUpdated}</TableCell>
                <TableCell className="text-center text-sm">{log.edgesCreated}</TableCell>
                <TableCell className="text-center text-sm">
                  {log.lintIssues > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">{log.lintIssues}</span>
                  ) : "0"}
                </TableCell>
                <TableCell className="text-sm text-destructive truncate max-w-[200px]">
                  {log.errorMessage || ""}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </DataTableCard>
  )
}
