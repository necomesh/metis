import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, KeyRound, Clock, Trash2, Copy, Check, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { usePermission } from "@/hooks/use-permission"
import { observeApi, type TokenResponse } from "../../api"

const MAX_TOKENS = 10

function useRelativeTime() {
  const { t } = useTranslation("observe")
  return (dateStr: string | null): string | null => {
    if (!dateStr) return null
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return t("tokens.justNow")
    if (minutes < 60) return t("tokens.minutesAgo", { n: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t("tokens.hoursAgo", { n: hours })
    return t("tokens.daysAgo", { n: Math.floor(hours / 24) })
  }
}

// ── Create Token Sheet ────────────────────────────────────────────────────────

type SheetPhase = "form" | "reveal"

function CreateTokenSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation("observe")
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<SheetPhase>("form")
  const [name, setName] = useState("")
  const [rawToken, setRawToken] = useState("")
  const [copied, setCopied] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)

  const { mutate: createToken, isPending } = useMutation({
    mutationFn: () => observeApi.createToken(name),
    onSuccess: (data) => {
      setRawToken(data.token)
      setPhase("reveal")
      queryClient.invalidateQueries({ queryKey: ["observe-tokens"] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const handleCopy = () => {
    navigator.clipboard.writeText(rawToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success(t("tokens.secretCopied"))
  }

  const handleClose = () => {
    if (phase === "reveal" && !copied) {
      setCloseConfirm(true)
      return
    }
    doClose()
  }

  const doClose = () => {
    setPhase("form")
    setName("")
    setRawToken("")
    setCopied(false)
    setCloseConfirm(false)
    onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("tokens.createTitle")}</SheetTitle>
          </SheetHeader>

          {phase === "form" ? (
            <div className="mt-6 space-y-4 px-1">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("tokens.name")}</label>
                <Input
                  placeholder={t("tokens.namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && name.trim() && createToken()}
                />
              </div>
              <Button
                className="w-full"
                disabled={!name.trim() || isPending}
                onClick={() => createToken()}
              >
                {isPending ? t("tokens.generating") : t("tokens.generate")}
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-5 px-1">
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{t("tokens.secretDesc")}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("tokens.secretTitle")}
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <code className="flex-1 break-all font-mono text-xs text-foreground">
                    {rawToken}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button className="w-full" onClick={doClose}>
                {t("tokens.closeAnyway")}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={closeConfirm} onOpenChange={setCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tokens.secretTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("tokens.closeConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCloseConfirm(false)}>
              {t("tokens.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={doClose}>{t("tokens.closeAnyway")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Token Card ────────────────────────────────────────────────────────────────

function TokenCard({
  token,
  onRevoke,
  canRevoke,
}: {
  token: TokenResponse
  onRevoke: (token: TokenResponse) => void
  canRevoke: boolean
}) {
  const { t } = useTranslation("observe")
  const relativeTime = useRelativeTime()
  const lastUsed = relativeTime(token.lastUsedAt)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md border border-border bg-muted/40 p-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-sm">{token.name}</p>
          <code className="font-mono text-xs text-muted-foreground">
            {token.prefix}{"•".repeat(16)}
          </code>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {t("tokens.personal")}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {lastUsed ? lastUsed : t("tokens.neverUsed")}
            </span>
          </div>
        </div>
      </div>

      {canRevoke && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRevoke(token)}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {t("tokens.revoke")}
        </Button>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function Component() {
  const { t } = useTranslation("observe")
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<TokenResponse | null>(null)

  const canCreate = usePermission("observe:token:create")
  const canRevoke = usePermission("observe:token:revoke")

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["observe-tokens"],
    queryFn: observeApi.listTokens,
  })

  const { mutate: revokeToken, isPending: isRevoking } = useMutation({
    mutationFn: (id: number) => observeApi.revokeToken(id),
    onSuccess: () => {
      toast.success(t("tokens.revokeSuccess"))
      queryClient.invalidateQueries({ queryKey: ["observe-tokens"] })
      setRevokeTarget(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const atLimit = tokens.length >= MAX_TOKENS

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("tokens.title")}</h2>
        {canCreate && (
          <Button
            size="sm"
            disabled={atLimit}
            onClick={() => setCreateOpen(true)}
            title={atLimit ? t("tokens.limitReached") : undefined}
          >
            <Plus className="h-4 w-4 mr-1" />
            {atLimit ? t("tokens.limitReached") : t("tokens.create")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-muted/30" />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 gap-3 text-center">
          <KeyRound className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-sm">{t("tokens.empty")}</p>
          <p className="max-w-sm text-xs text-muted-foreground">{t("tokens.emptyHint")}</p>
          {canCreate && (
            <Button size="sm" className="mt-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t("tokens.create")}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tokens.map((token) => (
            <TokenCard
              key={token.id}
              token={token}
              onRevoke={setRevokeTarget}
              canRevoke={canRevoke}
            />
          ))}
        </div>
      )}

      <CreateTokenSheet open={createOpen} onOpenChange={setCreateOpen} />

      {/* Revoke confirm dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tokens.revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tokens.revokeDesc", { name: revokeTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("tokens.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRevoking}
              onClick={() => revokeTarget && revokeToken(revokeTarget.id)}
            >
              {t("tokens.revokeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
