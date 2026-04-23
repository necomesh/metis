import { useMemo, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Activity, Bot, CheckCircle2, ExternalLink, Route, Save, ShieldCheck, TriangleAlert, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  type AgentItem,
  type EngineConfig,
  type EngineConfigUpdate,
  type EngineHealthItem,
  fetchAgents,
  fetchEngineConfig,
  fetchModels,
  fetchProviders,
  fetchUsers,
  updateEngineConfig,
} from "../../api"

type SectionStatus = "pass" | "warn" | "fail"

function statusFromHealth(item: EngineHealthItem | undefined): SectionStatus {
  return item?.status ?? "fail"
}

function EngineStatus({ status, label }: { status: SectionStatus; label?: string }) {
  const { t } = useTranslation("itsm")
  const content = label ?? t(`engineConfig.status.${status}`)
  const styles = {
    pass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    fail: "border-red-200 bg-red-50 text-red-700",
  }
  const icons = {
    pass: CheckCircle2,
    warn: TriangleAlert,
    fail: XCircle,
  }
  const Icon = icons[status]
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ${styles[status]}`}>
      <Icon className="h-3.5 w-3.5" />
      {content}
    </span>
  )
}

function AgentPreview({ agent }: { agent: AgentItem | undefined }) {
  const { t } = useTranslation("itsm")
  if (!agent) return null
  const strategyLabel = agent.strategy === "plan_and_execute"
    ? t("engineConfig.strategyPlanAndExecute")
    : t("engineConfig.strategyReact")
  return (
    <p className="text-xs leading-5 text-muted-foreground">
      {t("engineConfig.previewStrategy")}: {strategyLabel} · {t("engineConfig.previewTemperature")}: {agent.temperature.toFixed(2)} · {t("engineConfig.previewMaxTurns")}: {agent.maxTurns}
    </p>
  )
}

function EmptyAgentsAlert() {
  const { t } = useTranslation("itsm")
  const navigate = useNavigate()
  return (
    <Alert>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{t("engineConfig.noAgents")}</span>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate("/ai/agents")}>
          {t("engineConfig.goToAgents")}
          <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function AgentField({
  agentId,
  agents,
  onAgentChange,
}: {
  agentId: number
  agents: AgentItem[]
  onAgentChange: (id: number) => void
}) {
  const { t } = useTranslation("itsm")
  const selectedAgent = agentId ? agents.find((a) => a.id === agentId) : undefined

  if (agents.length === 0) {
    return <EmptyAgentsAlert />
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label>{t("engineConfig.agent")}</Label>
        <Select value={agentId ? String(agentId) : ""} onValueChange={(v) => onAgentChange(Number(v))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("engineConfig.agentPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <AgentPreview agent={selectedAgent} />
    </div>
  )
}

function PathEngineFields({
  providerId,
  modelId,
  temperature,
  maxRetries,
  timeoutSeconds,
  onProviderChange,
  onModelChange,
  onTemperatureChange,
  onMaxRetriesChange,
  onTimeoutSecondsChange,
}: {
  providerId: number
  modelId: number
  temperature: number
  maxRetries: number
  timeoutSeconds: number
  onProviderChange: (id: number) => void
  onModelChange: (id: number) => void
  onTemperatureChange: (v: number) => void
  onMaxRetriesChange: (v: number) => void
  onTimeoutSecondsChange: (v: number) => void
}) {
  const { t } = useTranslation("itsm")
  const navigate = useNavigate()

  const { data: providers = [] } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: fetchProviders,
  })

  const { data: models = [] } = useQuery({
    queryKey: ["ai-models", providerId],
    queryFn: () => fetchModels(providerId),
    enabled: providerId > 0,
  })

  if (providers.length === 0) {
    return (
      <Alert>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>{t("engineConfig.noProviders")}</span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate("/ai/providers")}>
            {t("engineConfig.goToProviders")}
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(190px,230px)_minmax(220px,280px)_minmax(220px,1fr)_minmax(120px,150px)_minmax(150px,190px)] xl:items-start">
      <div className="space-y-1.5">
        <Label>{t("engineConfig.provider")}</Label>
        <Select
          value={providerId ? String(providerId) : ""}
          onValueChange={(v) => {
            onProviderChange(Number(v))
            onModelChange(0)
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("engineConfig.providerPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{t("engineConfig.model")}</Label>
        <Select value={modelId ? String(modelId) : ""} onValueChange={(v) => onModelChange(Number(v))} disabled={!providerId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("engineConfig.modelPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>{t("engineConfig.temperature")}</Label>
          <span className="font-mono text-xs text-muted-foreground">{temperature.toFixed(2)}</span>
        </div>
        <Slider min={0} max={1} step={0.05} value={[temperature]} onValueChange={([v]) => onTemperatureChange(v)} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("engineConfig.maxRetries")}</Label>
        <Input type="number" min={0} max={10} value={maxRetries} onChange={(e) => onMaxRetriesChange(Number(e.target.value))} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("engineConfig.timeoutSeconds")}</Label>
        <div className="flex items-center gap-2">
          <Input type="number" min={10} max={300} value={timeoutSeconds} onChange={(e) => onTimeoutSecondsChange(Number(e.target.value))} />
          <span className="text-xs text-muted-foreground">{t("engineConfig.seconds")}</span>
        </div>
      </div>
    </div>
  )
}

function EngineSection({
  icon,
  title,
  description,
  health,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  health: EngineHealthItem | undefined
  children: ReactNode
}) {
  const Icon = icon
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-col gap-3 border-b border-border/45 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/45">
            <Icon className="h-4.5 w-4.5 text-foreground" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="mt-1 text-xs leading-5">{description}</CardDescription>
            {health?.message ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{health.message}</p> : null}
          </div>
        </div>
        <EngineStatus status={statusFromHealth(health)} />
      </div>
      <CardContent className="px-5 py-4">{children}</CardContent>
    </Card>
  )
}

function configFormKey(config: EngineConfig) {
  return [
    config.intake.agentId,
    config.decision.agentId,
    config.decision.mode,
    config.path.providerId,
    config.path.modelId,
    config.path.temperature,
    config.path.maxRetries,
    config.path.timeoutSeconds,
    config.guard.auditLevel,
    config.guard.fallbackAssignee,
  ].join(":")
}

function EngineConfigForm({ config }: { config: EngineConfig }) {
  const { t } = useTranslation(["itsm", "common"])
  const queryClient = useQueryClient()

  const { data: agents = [] } = useQuery({
    queryKey: ["ai-agents-for-smart-ticket-engine"],
    queryFn: fetchAgents,
    select: (list) => list.filter((a) => a.type === "assistant" && a.isActive),
  })

  const { data: fallbackUsers = [] } = useQuery({
    queryKey: ["users-for-engine-fallback"],
    queryFn: () => fetchUsers(),
  })

  const healthByKey = useMemo(() => {
    const map = new Map<string, EngineHealthItem>()
    for (const item of config.health.items) {
      map.set(item.key, item)
    }
    return map
  }, [config.health.items])

  const [intakeAgentId, setIntakeAgentId] = useState(config.intake.agentId)
  const [decisionAgentId, setDecisionAgentId] = useState(config.decision.agentId)
  const [decisionMode, setDecisionMode] = useState(config.decision.mode || "direct_first")
  const [pathProviderId, setPathProviderId] = useState(config.path.providerId)
  const [pathModelId, setPathModelId] = useState(config.path.modelId)
  const [pathTemperature, setPathTemperature] = useState(config.path.temperature)
  const [pathMaxRetries, setPathMaxRetries] = useState(config.path.maxRetries)
  const [pathTimeoutSeconds, setPathTimeoutSeconds] = useState(config.path.timeoutSeconds)
  const [auditLevel, setAuditLevel] = useState(config.guard.auditLevel)
  const [fallbackAssignee, setFallbackAssignee] = useState(config.guard.fallbackAssignee)

  const fallbackUserKnown = fallbackAssignee === 0 || fallbackUsers.some((u) => u.id === fallbackAssignee)

  const saveMut = useMutation({
    mutationFn: (data: EngineConfigUpdate) => updateEngineConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itsm-engine-config"] })
      toast.success(t("itsm:engineConfig.saveSuccess"))
    },
    onError: (err) => toast.error(err.message),
  })

  function handleSave() {
    saveMut.mutate({
      intake: { agentId: intakeAgentId },
      decision: { agentId: decisionAgentId, mode: decisionMode },
      path: {
        modelId: pathModelId,
        temperature: pathTemperature,
        maxRetries: pathMaxRetries,
        timeoutSeconds: pathTimeoutSeconds,
      },
      guard: { auditLevel, fallbackAssignee },
    })
  }

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <div className="min-w-0">
          <h2 className="workspace-page-title">{t("itsm:engineConfig.title")}</h2>
          <p className="workspace-page-description">{t("itsm:engineConfig.pageDesc")}</p>
        </div>
        <Button className="shrink-0" onClick={handleSave} disabled={saveMut.isPending}>
          <Save className="mr-1.5 h-4 w-4" />
          {saveMut.isPending ? t("common:saving") : t("common:save")}
        </Button>
      </div>

      <EngineSection
        icon={Bot}
        title={t("itsm:engineConfig.intakeTitle")}
        description={t("itsm:engineConfig.intakeDesc")}
        health={healthByKey.get("intake")}
      >
        <AgentField agentId={intakeAgentId} agents={agents} onAgentChange={setIntakeAgentId} />
      </EngineSection>

      <EngineSection
        icon={Activity}
        title={t("itsm:engineConfig.decisionTitle")}
        description={t("itsm:engineConfig.decisionDesc")}
        health={healthByKey.get("decision")}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(190px,260px)] lg:items-start">
          <AgentField agentId={decisionAgentId} agents={agents} onAgentChange={setDecisionAgentId} />
          <div className="space-y-1.5">
            <Label>{t("itsm:engineConfig.decisionMode")}</Label>
            <Select value={decisionMode} onValueChange={setDecisionMode}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct_first">{t("itsm:engineConfig.modeDirectFirst")}</SelectItem>
                <SelectItem value="ai_only">{t("itsm:engineConfig.modeAiOnly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </EngineSection>

      <EngineSection
        icon={Route}
        title={t("itsm:engineConfig.pathTitle")}
        description={t("itsm:engineConfig.pathDesc")}
        health={healthByKey.get("path")}
      >
        <PathEngineFields
          providerId={pathProviderId}
          modelId={pathModelId}
          temperature={pathTemperature}
          maxRetries={pathMaxRetries}
          timeoutSeconds={pathTimeoutSeconds}
          onProviderChange={setPathProviderId}
          onModelChange={setPathModelId}
          onTemperatureChange={setPathTemperature}
          onMaxRetriesChange={setPathMaxRetries}
          onTimeoutSecondsChange={setPathTimeoutSeconds}
        />
      </EngineSection>

      <EngineSection
        icon={ShieldCheck}
        title={t("itsm:engineConfig.guardTitle")}
        description={t("itsm:engineConfig.guardDesc")}
        health={healthByKey.get("guard")}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(180px,240px)_minmax(220px,300px)]">
          <div className="space-y-1.5">
            <Label>{t("itsm:engineConfig.auditLevel")}</Label>
            <Select value={auditLevel} onValueChange={setAuditLevel}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">{t("itsm:engineConfig.logFull")}</SelectItem>
                <SelectItem value="summary">{t("itsm:engineConfig.logSummary")}</SelectItem>
                <SelectItem value="off">{t("itsm:engineConfig.logOff")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("itsm:engineConfig.fallbackAssignee")}</Label>
            <Select value={String(fallbackAssignee)} onValueChange={(v) => setFallbackAssignee(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("itsm:engineConfig.fallbackAssigneePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t("itsm:engineConfig.fallbackAssigneeNone")}</SelectItem>
                {!fallbackUserKnown && (
                  <SelectItem value={String(fallbackAssignee)}>
                    {t("itsm:engineConfig.fallbackAssigneeUnknown", { id: fallbackAssignee })}
                  </SelectItem>
                )}
                {fallbackUsers.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </EngineSection>
    </div>
  )
}

export function Component() {
  const { t } = useTranslation("common")

  const { data: config, isLoading } = useQuery({
    queryKey: ["itsm-engine-config"],
    queryFn: fetchEngineConfig,
  })

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-muted-foreground">{t("loading")}</span>
      </div>
    )
  }

  return <EngineConfigForm key={configFormKey(config)} config={config} />
}
