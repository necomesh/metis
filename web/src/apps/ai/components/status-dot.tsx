import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500",
  inactive: "bg-gray-400",
  error: "bg-red-500",
}

const PULSE_STYLES: Record<string, string> = {
  active: "animate-pulse",
  error: "animate-pulse",
}

interface StatusDotProps {
  status: string
  loading?: boolean
  className?: string
}

export function StatusDot({ status, loading, className }: StatusDotProps) {
  if (loading) {
    return <Loader2 className={cn("h-3.5 w-3.5 animate-spin text-muted-foreground", className)} />
  }

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        STATUS_STYLES[status] ?? "bg-gray-400",
        PULSE_STYLES[status],
        className,
      )}
    />
  )
}
