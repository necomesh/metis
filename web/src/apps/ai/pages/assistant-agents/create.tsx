import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { assistantAgentApi } from "@/lib/api"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AgentForm, type AgentFormValues } from "../_shared/agent-form-common"

export function Component() {
  const { t } = useTranslation(["ai", "common"])
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (values: AgentFormValues) => assistantAgentApi.create(values),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["ai-assistant-agents"] })
      toast.success(t("ai:assistantAgents.createSuccess"))
      navigate(`/ai/assistant-agents/${agent.id}`)
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="workspace-page">
      <div className="workspace-page-header gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3">
            <Button variant="ghost" size="sm" className="-ml-2 px-2" onClick={() => navigate("/ai/assistant-agents")}>
              <ArrowLeft className="h-4 w-4" />
              {t("ai:assistantAgents.title")}
            </Button>
          </div>
          <h2 className="workspace-page-title">{t("ai:assistantAgents.create")}</h2>
          <p className="workspace-page-description">{t("ai:agents.agentTypes.assistant")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button variant="outline" onClick={() => navigate("/ai/assistant-agents")}>
            {t("common:cancel")}
          </Button>
          <Button type="submit" form="agent-form" disabled={mutation.isPending}>
            {mutation.isPending ? t("common:saving") : t("common:create")}
          </Button>
        </div>
      </div>

      <AgentForm agentType="assistant" onSubmit={(v) => mutation.mutate(v)} />
    </div>
  )
}
