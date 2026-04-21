import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

interface AuthBrandLockupProps {
  appName: string
  hasLogo?: boolean
  compact?: boolean
}

export function AuthBrandLockup({ appName, hasLogo = false, compact = false }: AuthBrandLockupProps) {
  return (
    <div className={cn("flex items-center", compact ? "gap-3" : "gap-3.5")}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/88 text-foreground shadow-[0_18px_50px_-24px_rgba(15,23,42,0.28)]",
          compact ? "h-10 w-10" : "h-12 w-12"
        )}
      >
        {hasLogo ? (
          <img
            src="/api/v1/site-info/logo"
            alt={appName}
            width={compact ? 20 : 28}
            height={compact ? 20 : 28}
            loading="eager"
            className={cn("object-contain", compact ? "h-5 w-5" : "h-7 w-7")}
          />
        ) : (
          <Sparkles aria-hidden="true" className={cn("text-primary", compact ? "h-4.5 w-4.5" : "h-5 w-5")} />
        )}
      </div>

      <div>
        <div className={cn("font-semibold tracking-tight text-foreground", compact ? "text-[1.125rem]" : "text-[1.625rem]")}> 
          <span translate="no">{appName}</span>
        </div>
      </div>
    </div>
  )
}
