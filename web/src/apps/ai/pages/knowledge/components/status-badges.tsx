import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import type { CompileStatus } from "../types"

export function CompileStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("ai")
  const s = status as CompileStatus

  if (s === "compiling") {
    return (
      <Badge variant="outline" className="border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse">
        {t("knowledge.compileStatus.compiling")}
      </Badge>
    )
  }
  if (s === "completed") {
    return (
      <Badge variant="outline" className="border-transparent bg-green-500/20 text-green-700 dark:bg-green-500/20 dark:text-green-400">
        {t("knowledge.compileStatus.completed")}
      </Badge>
    )
  }
  if (s === "error") {
    return (
      <Badge variant="destructive">
        {t("knowledge.compileStatus.error")}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      {t("knowledge.compileStatus.idle")}
    </Badge>
  )
}

export function ExtractStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("ai")
  if (status === "completed") {
    return (
      <Badge variant="outline" className="border-transparent bg-green-500/20 text-green-700 dark:bg-green-500/20 dark:text-green-400">
        {t("knowledge.extractStatus.completed")}
      </Badge>
    )
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive">
        {t("knowledge.extractStatus.failed")}
      </Badge>
    )
  }
  if (status === "processing") {
    return (
      <Badge variant="outline" className="border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse">
        {t("knowledge.extractStatus.processing")}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      {t("knowledge.extractStatus.pending")}
    </Badge>
  )
}
