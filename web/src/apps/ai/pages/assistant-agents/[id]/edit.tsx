import { useNavigate, useParams } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { assistantAgentApi } from "@/lib/api"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AgentForm, type AgentFormValues } from "../../_shared/agent-form-common"

export function Component() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation(["ai", "common"])
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: agent, isLoading } = useQuery({
    queryKey: ["ai-assistant-agent", id],
    queryFn: () => assistantAgentApi.get(Number(id)),
    enabled: !!id,
  })

  const mutation = useMutation({
    mutationFn: (values: AgentFormValues) => assistantAgentApi.update(Number(id), values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-assistant-agent", id] })
      queryClient.invalidateQueries({ queryKey: ["ai-assistant-agents"] })
      toast.success(t("ai:assistantAgents.updateSuccess"))
      navigate(`/ai/assistant-agents/${id}`)
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading || !agent) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="workspace-page">
      <div className="workspace-page-header gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3">
            <Button variant="ghost" size="sm" className="-ml-2 px-2" onClick={() => navigate(`/ai/assistant-agents/${id}`)}>
              <ArrowLeft className="h-4 w-4" />
              {agent.name}
            </Button>
          </div>
          <h2 className="workspace-page-title">{t("ai:assistantAgents.edit")}</h2>
          <p className="workspace-page-description">{t("ai:agents.agentTypes.assistant")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button variant="outline" onClick={() => navigate(`/ai/assistant-agents/${id}`)}>
            {t("common:cancel")}
          </Button>
          <Button type="submit" form="agent-form" disabled={mutation.isPending}>
            {mutation.isPending ? t("common:saving") : t("common:save")}
          </Button>
        </div>
      </div>

      <AgentForm agentType="assistant" agent={agent} onSubmit={(v) => mutation.mutate(v)} />
    </div>
  )
}
