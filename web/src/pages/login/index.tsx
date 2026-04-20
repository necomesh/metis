import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, Navigate, Link } from "react-router"
import { Sparkles } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { AuthBrandLockup } from "@/components/auth/brand-lockup"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, type SiteInfo } from "@/lib/api"
import { useAuthStore, TwoFactorRequiredError, AccountLockedError } from "@/stores/auth"

interface AuthProviderInfo {
  providerKey: string
  displayName: string
  sortOrder: number
}

interface CaptchaData {
  enabled: boolean
  id?: string
  image?: string
}

const providerIcons: Record<string, string> = {
  github: "M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z",
  google: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23zM5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62zM12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z",
}

function ProviderIcon({ provider }: { provider: string }) {
  const path = providerIcons[provider]
  if (!path) return null
  return (
    <svg aria-hidden="true" className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d={path} />
    </svg>
  )
}

export default function LoginPage() {
  const { t } = useTranslation("auth")
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const user = useAuthStore((s) => s.user)

  const { data: siteInfo } = useQuery({
    queryKey: ["site-info"],
    queryFn: () => api.get<SiteInfo>("/api/v1/site-info"),
    staleTime: 60_000,
  })

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [captchaAnswer, setCaptchaAnswer] = useState("")
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [providers, setProviders] = useState<AuthProviderInfo[]>([])
  const [registrationOpen, setRegistrationOpen] = useState(false)

  const loadCaptcha = useCallback(async () => {
    try {
      const data = await api.get<CaptchaData>("/api/v1/captcha")
      setCaptcha(data)
      setCaptchaAnswer("")
    } catch {
      setCaptcha(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([
      api.get<AuthProviderInfo[]>("/api/v1/auth/providers"),
      api.get<{ registrationOpen: boolean }>("/api/v1/auth/registration-status"),
    ]).then(([providersResult, registrationResult]) => {
      if (cancelled) return

      if (providersResult.status === "fulfilled") {
        setProviders(providersResult.value)
      }
      if (registrationResult.status === "fulfilled") {
        setRegistrationOpen(registrationResult.value.registrationOpen)
      }
    })

    loadCaptcha()

    return () => {
      cancelled = true
    }
  }, [loadCaptcha])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await login(username, password, captcha?.id, captchaAnswer)
      navigate("/", { replace: true })
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        navigate("/2fa", { state: { twoFactorToken: err.twoFactorToken } })
        return
      }
      if (err instanceof AccountLockedError) {
        setError(t("login.accountLocked"))
      } else {
        setError(err instanceof Error ? err.message : t("login.loginFailed"))
      }
      loadCaptcha()
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuth(providerKey: string) {
    setError("")
    try {
      const data = await api.get<{ authURL: string; state: string }>(`/api/v1/auth/oauth/${providerKey}`)
      sessionStorage.setItem("oauth_provider", providerKey)
      window.location.assign(data.authURL)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.oauthFailed"))
    }
  }

  const appName = siteInfo?.appName ?? "Metis"
  const heroSignals = [
    t("login.heroSignalAuth"),
    t("login.heroSignalPolicy"),
    t("login.heroSignalLocale"),
  ]

  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <AuthShell
      aside={
        <div className="flex h-full w-full items-center">
          <div className="ml-8 flex w-full max-w-[36rem] flex-col gap-8 py-4 pr-4 lg:ml-12 xl:ml-16 xl:max-w-[38rem] xl:pr-10">
            <div className="space-y-8">
              <AuthBrandLockup appName={appName} hasLogo={siteInfo?.hasLogo} />

              <div className="max-w-[36rem] space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                  {t("login.heroEyebrow")}
                </div>
                <div className="space-y-4">
                  <h1 className="max-w-none text-[2.75rem] font-semibold tracking-[-0.05em] text-foreground sm:text-[3.15rem] xl:text-[3.35rem]">
                    {t("login.heroTitle")}
                  </h1>
                  <p className="max-w-[32rem] text-base leading-7 text-muted-foreground sm:text-[1.0625rem]">
                    {t("login.heroDescription")}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
              {heroSignals.map((signal) => (
                <span key={signal} className="rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium">
                  {signal}
                </span>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <div className="w-full max-w-[32rem] lg:max-w-[28rem]">
        <div className="auth-panel-glass rounded-[1.5rem] px-5 py-5 sm:rounded-[1.75rem] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mb-8 space-y-5">
            <div className="lg:hidden">
              <AuthBrandLockup appName={appName} hasLogo={siteInfo?.hasLogo} compact />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                {t("login.welcome")}
              </p>
              <h2 className="text-[1.625rem] font-semibold tracking-[-0.04em] text-foreground text-balance sm:text-[1.875rem] lg:text-[2rem]">
                {t("login.title", { appName })}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {t("login.subtitle")}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <Label htmlFor="username" className="mb-2 block text-[13px] font-medium text-foreground/78">
                  {t("login.username")}
                </Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  spellCheck={false}
                  placeholder={t("login.usernamePlaceholder")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="auth-input"
                />
              </div>

              <div>
                <Label htmlFor="password" className="mb-2 block text-[13px] font-medium text-foreground/78">
                  {t("login.password")}
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="auth-input"
                />
              </div>

              {captcha?.enabled ? (
                <div>
                  <Label htmlFor="captcha" className="mb-2 block text-[13px] font-medium text-foreground/78">
                    {t("login.captcha")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="captcha"
                      name="captcha"
                      autoComplete="one-time-code"
                      inputMode="text"
                      placeholder={t("login.captchaPlaceholder")}
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      className="auth-input flex-1"
                      required
                    />
                    {captcha.image ? (
                      <button
                        type="button"
                        className="flex h-[2.875rem] w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background/80 transition hover:border-ring/60 hover:bg-background"
                        onClick={loadCaptcha}
                        aria-label={t("login.captchaRefresh")}
                        title={t("login.captchaRefresh")}
                      >
                        <img
                          src={captcha.image}
                          alt={t("login.captcha")}
                          width={96}
                          height={40}
                          className="h-10 w-24 object-cover"
                        />
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {error ? (
              <div aria-live="polite" className="rounded-2xl border border-destructive/18 bg-destructive/6 px-3.5 py-3 text-[13px] leading-snug text-destructive">
                {error}
              </div>
            ) : null}

            <div className="space-y-4 pt-1">
              <Button
                type="submit"
                className="h-11 w-full rounded-xl text-sm font-medium tracking-[-0.01em] shadow-[0_24px_50px_-24px_hsl(var(--primary)/0.75)]"
                disabled={loading}
              >
                {loading ? t("login.submitting") : t("login.submit")}
              </Button>

              {providers.length > 0 ? (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/70" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white/78 px-2.5 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                        {t("login.or")}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2.5">
                    {providers.map((provider) => (
                      <Button
                        key={provider.providerKey}
                        type="button"
                        variant="outline"
                        className="h-10 justify-center rounded-xl border-border/70 bg-background/86 text-[13px] font-medium text-foreground/78 shadow-none hover:border-ring/40 hover:bg-background hover:text-foreground"
                        onClick={() => handleOAuth(provider.providerKey)}
                      >
                        <ProviderIcon provider={provider.providerKey} />
                        {provider.displayName}
                      </Button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </form>

          <div className="mt-6 text-center text-[12.5px] text-muted-foreground">
            {registrationOpen ? (
              <p>
                {t("login.noAccount")}{" "}
                <Link to="/register" className="font-medium text-foreground transition hover:text-primary">
                  {t("login.createAccount")}
                </Link>
              </p>
            ) : (
              <p>{t("login.cantLogin")}</p>
            )}
          </div>
        </div>
      </div>
      {siteInfo?.version ? (
        <div className="pointer-events-none absolute bottom-5 right-5 text-xs text-muted-foreground/80 sm:bottom-6 sm:right-6 lg:bottom-7 lg:right-8" translate="no">
          {siteInfo.version}
        </div>
      ) : null}
    </AuthShell>
  )
}
