import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Bot, BrainCircuit, Code2, MessageSquare } from "lucide-react"
import { agentApi, sessionApi, type AgentInfo } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

const TYPE_ICON: Record<string, typeof Bot> = {
  assistant: BrainCircuit,
  coding: Code2,
}

export function Component() {
  const { t } = useTranslation(["ai"])
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ["ai-agents-for-chat"],
    queryFn: () => agentApi.list({ pageSize: 50 }),
  })
  const agents = (data?.items ?? []).filter((a: AgentInfo) => a.isActive)

  const createSessionMutation = useMutation({
    mutationFn: (agentId: number) => sessionApi.create(agentId),
    onSuccess: (session) => {
      navigate(`/ai/chat/${session.id}`)
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h2 className="text-lg font-semibold">{t("ai:chat.selectAgent")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("ai:chat.selectAgentHint")}</p>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12">
          <Bot className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t("ai:agents.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent: AgentInfo) => {
            const Icon = TYPE_ICON[agent.type] ?? Bot
            return (
              <Card key={agent.id} className="flex flex-col">
                <CardHeader className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="text-xs">
                      {t(`ai:agents.agentTypes.${agent.type}`)}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{agent.name}</CardTitle>
                  {agent.description && (
                    <CardDescription className="line-clamp-2">{agent.description}</CardDescription>
                  )}
                </CardHeader>
                <CardFooter>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={createSessionMutation.isPending}
                    onClick={() => createSessionMutation.mutate(agent.id)}
                  >
                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                    {t("ai:chat.startChat")}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
