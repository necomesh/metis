"use client"

import type { LucideIcon } from "lucide-react"
import type { MouseEventHandler, ReactNode } from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function ConfigSearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/58" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="workspace-toolbar-input h-8 bg-transparent pl-9 pr-8 text-sm"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
          onClick={() => onChange("")}
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Clear</span>
        </Button>
      ) : null}
    </div>
  )
}

function QuietStatus({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean
  activeLabel: string
  inactiveLabel: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/65 bg-background/35 px-2.5 py-1 text-xs font-medium text-foreground/72">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500/78" : "bg-muted-foreground/45",
        )}
      />
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}

function IconTooltipButton({
  label,
  icon: Icon,
  className,
  onClick,
  disabled,
}: {
  label: string
  icon: LucideIcon
  className?: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("text-muted-foreground hover:text-foreground", className)}
          onClick={onClick}
          disabled={disabled}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function FormSection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-3 border-t border-border/45 pt-4 first:border-t-0 first:pt-0", className)}>
      <h3 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground/72 uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

export {
  ConfigSearchField,
  FormSection,
  IconTooltipButton,
  QuietStatus,
}
