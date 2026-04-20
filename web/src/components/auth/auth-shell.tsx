import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "@/components/language-switcher"

interface AuthShellProps {
  aside?: ReactNode
  children: ReactNode
  className?: string
}

export function AuthShell({ aside, children, className }: AuthShellProps) {
  return (
    <div className="auth-shell-bg relative min-h-dvh overflow-hidden lg:h-dvh">
      <div className="auth-grid pointer-events-none absolute inset-0" />
      <div className="auth-orb-primary pointer-events-none absolute left-[8%] top-[10%] h-72 w-72 rounded-full blur-3xl" />
      <div className="auth-orb-secondary pointer-events-none absolute bottom-[8%] right-[10%] h-80 w-80 rounded-full blur-3xl" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1560px] items-stretch px-3 py-3 sm:px-4 sm:py-4 lg:h-dvh lg:px-7 lg:py-7">
        <div
          className={cn(
            "auth-stage relative grid w-full grid-cols-1 overflow-hidden rounded-[1.75rem] sm:rounded-[2rem] lg:h-full",
            aside && "lg:grid-cols-[minmax(0,1.08fr)_minmax(26rem,30rem)]",
            className
          )}
        >
          {aside ? (
            <aside className="hidden min-h-full px-8 py-8 lg:flex lg:items-center lg:px-10 xl:px-14 xl:py-10">
              {aside}
            </aside>
          ) : null}

          <main className={cn(
            "flex min-h-full items-center justify-center px-4 py-5 sm:px-6 sm:py-6 lg:justify-end lg:px-10 lg:py-10 xl:px-14",
            aside && "lg:bg-transparent"
          )}>
            {children}
          </main>

          <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </div>
  )
}
