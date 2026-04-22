import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Save, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  type AgentItem,
  type EngineConfig,
  type EngineConfigUpdate,
  fetchEngineConfig,
  updateEngineConfig,
  fetchProviders,
  fetchModels,
  fetchAgents,
  fetchUsers,
} from "../../api"

type ConfigHealth = "configured" | "unconfigured" | "error"

function ConfigStatus({ status }: { status: ConfigHealth }) {
  const { t } = useTranslation("itsm")
  const styles = {
    configured: "bg-green-500",
    unconfigured: "bg-gray-400",
    error: "bg-red-500",
  }
  const labels = {
    configured: t("engineConfig.statusConfigured"),
    unconfigured: t("engineConfig.statusUnconfigured"),
    error: t("engineConfig.statusError"),
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${styles[status]}`} />
      {labels[status]}
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
    <p className="text-xs text-muted-foreground">
      {t("engineConfig.previewStrategy")}: {strategyLabel} · {t("engineConfig.previewTemperature")}: {agent.temperature.toFixed(2)} · {t("engineConfig.previewMaxTurns")}: {agent.maxTurns}
    </p>
  )
}

function LLMFields({
  providerId,
  modelId,
  temperature,
  onProviderChange,
  onModelChange,
  onTemperatureChange,
}: {
  providerId: number
  modelId: number
  temperature: number
  onProviderChange: (id: number) => void
  onModelChange: (id: number) => void
  onTemperatureChange: (v: number) => void
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
        <AlertDescription className="flex items-center justify-between">
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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="w-full space-y-1.5 lg:w-56 xl:w-60">
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
      <div className="w-full space-y-1.5 lg:w-64 xl:w-72">
        <Label>{t("engineConfig.model")}</Label>
        <Select
          value={modelId ? String(modelId) : ""}
          onValueChange={(v) => onModelChange(Number(v))}
          disabled={!providerId}
        >
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
      <div className="min-w-0 flex-1 space-y-2 lg:min-w-80">
        <div className="flex items-center justify-between gap-3">
          <Label>{t("engineConfig.temperature")}</Label>
          <span className="font-mono text-xs text-muted-foreground">{temperature.toFixed(2)}</span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={[temperature]}
          onValueChange={([v]) => onTemperatureChange(v)}
        />
      </div>
    </div>
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
  const navigate = useNavigate()
  const selectedAgent = agentId ? agents.find((a) => a.id === agentId) : undefined

  if (agents.length === 0) {
    return (
      <Alert>
        <AlertDescription className="flex items-center justify-between">
          <span>{t("engineConfig.noAgents")}</span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate("/ai/agents")}>
            {t("engineConfig.goToAgents")}
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label>{t("engineConfig.agent")}</Label>
        <Select
          value={agentId ? String(agentId) : ""}
          onValueChange={(v) => onAgentChange(Number(v))}
        >
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

function useAgentHealth(agentId: number, agents: AgentItem[]): ConfigHealth {
  if (agentId === 0) return "unconfigured"
  const agent = agents.find((a) => a.id === agentId)
  if (!agent || !agent.isActive) return "error"
  return "configured"
}

function ConfigSectionHeader({
  title,
  description,
  status,
}: {
  title: string
  description: string
  status?: ConfigHealth
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/45 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {status ? <ConfigStatus status={status} /> : null}
    </div>
  )
}

function configFormKey(config: EngineConfig) {
  return [
    config.generator.providerId,
    config.generator.modelId,
    config.generator.temperature,
    config.servicedesk.agentId,
    config.decision.agentId,
    config.decision.decisionMode,
    config.general.maxRetries,
    config.general.timeoutSeconds,
    config.general.reasoningLog,
    config.general.fallbackAssignee,
  ].join(":")
}

function EngineConfigForm({ config }: { config: EngineConfig }) {
  const { t } = useTranslation(["itsm", "common"])
  const queryClient = useQueryClient()

  const { data: agents = [] } = useQuery({
    queryKey: ["ai-agents-for-engine"],
    queryFn: fetchAgents,
    select: (list) => list.filter((a) => a.type === "assistant" && a.isActive),
  })

  const { data: fallbackUsers = [] } = useQuery({
    queryKey: ["users-for-engine-fallback"],
    queryFn: () => fetchUsers(),
  })

  const [genProviderId, setGenProviderId] = useState(config.generator.providerId)
  const [genModelId, setGenModelId] = useState(config.generator.modelId)
  const [genTemp, setGenTemp] = useState(config.generator.temperature)
  const [sdAgentId, setSdAgentId] = useState(config.servicedesk.agentId)
  const [decAgentId, setDecAgentId] = useState(config.decision.agentId)
  const [decisionMode, setDecisionMode] = useState(config.decision.decisionMode || "direct_first")
  const [maxRetries, setMaxRetries] = useState(config.general.maxRetries)
  const [timeoutSeconds, setTimeoutSeconds] = useState(config.general.timeoutSeconds)
  const [reasoningLog, setReasoningLog] = useState(config.general.reasoningLog)
  const [fallbackAssignee, setFallbackAssignee] = useState(config.general.fallbackAssignee)

  const saveMut = useMutation({
    mutationFn: (data: EngineConfigUpdate) => updateEngineConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itsm-engine-config"] })
      toast.success(t("itsm:engineConfig.saveSuccess"))
    },
    onError: (err) => toast.error(err.message),
  })

  const generatorHealth: ConfigHealth = genModelId > 0 ? "configured" : "unconfigured"
  const sdHealth = useAgentHealth(sdAgentId, agents)
  const decHealth = useAgentHealth(decAgentId, agents)
  const fallbackUserKnown = fallbackAssignee === 0 || fallbackUsers.some((u) => u.id === fallbackAssignee)

  function handleSave() {
    saveMut.mutate({
      generator: { modelId: genModelId, temperature: genTemp },
      servicedesk: { agentId: sdAgentId },
      decision: { agentId: decAgentId, decisionMode },
      general: { maxRetries, timeoutSeconds, reasoningLog, fallbackAssignee },
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

      <Card className="gap-0 py-0">
        <ConfigSectionHeader
          title={t("itsm:engineConfig.generatorTitle")}
          description={t("itsm:engineConfig.generatorDesc")}
          status={generatorHealth}
        />
        <CardContent className="px-5 py-4">
          <LLMFields
            providerId={genProviderId}
            modelId={genModelId}
            temperature={genTemp}
            onProviderChange={setGenProviderId}
            onModelChange={setGenModelId}
            onTemperatureChange={setGenTemp}
          />
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <ConfigSectionHeader
          title={t("itsm:engineConfig.agentConfigTitle")}
          description={t("itsm:engineConfig.agentConfigDesc")}
        />
        <CardContent className="grid gap-0 p-0 lg:grid-cols-2 lg:divide-x lg:divide-border/45">
          <section className="space-y-4 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-sm">{t("itsm:engineConfig.servicedeskTitle")}</CardTitle>
                <CardDescription className="mt-1 text-xs leading-5">{t("itsm:engineConfig.servicedeskDesc")}</CardDescription>
              </div>
              <ConfigStatus status={sdHealth} />
            </div>
            <AgentField agentId={sdAgentId} agents={agents} onAgentChange={setSdAgentId} />
          </section>
          <section className="space-y-4 border-t border-border/45 px-5 py-4 lg:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-sm">{t("itsm:engineConfig.decisionTitle")}</CardTitle>
                <CardDescription className="mt-1 text-xs leading-5">{t("itsm:engineConfig.decisionDesc")}</CardDescription>
              </div>
              <ConfigStatus status={decHealth} />
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_minmax(180px,260px)] xl:items-start">
              <AgentField agentId={decAgentId} agents={agents} onAgentChange={setDecAgentId} />
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
          </section>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <ConfigSectionHeader
          title={t("itsm:engineConfig.generalTitle")}
          description={t("itsm:engineConfig.generalDesc")}
          status="configured"
        />
        <CardContent className="px-5 py-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(120px,170px)_minmax(160px,220px)_minmax(180px,240px)_minmax(220px,300px)]">
            <div className="space-y-1.5">
              <Label>{t("itsm:engineConfig.maxRetries")}</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("itsm:engineConfig.timeoutSeconds")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={10}
                  max={300}
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                />
                <span className="text-xs text-muted-foreground">{t("itsm:engineConfig.seconds")}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("itsm:engineConfig.reasoningLog")}</Label>
              <Select value={reasoningLog} onValueChange={setReasoningLog}>
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
        </CardContent>
      </Card>
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
