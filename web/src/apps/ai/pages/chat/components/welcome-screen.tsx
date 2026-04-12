import { useTranslation } from "react-i18next"
import { BrainCircuit, Code2, Bot, Sparkles } from "lucide-react"

interface WelcomeScreenProps {
  agentName?: string
  agentDescription?: string
  agentType?: string
  suggestedPrompts?: string[]
  onPromptClick: (prompt: string) => void
}

const TYPE_ICONS: Record<string, typeof Bot> = {
  assistant: BrainCircuit,
  coding: Code2,
}

export function WelcomeScreen({
  agentName,
  agentDescription,
  agentType,
  suggestedPrompts,
  onPromptClick,
}: WelcomeScreenProps) {
  const { t } = useTranslation(["ai"])
  const Icon = TYPE_ICONS[agentType ?? ""] ?? Bot

  // Use provided prompts or fall back to defaults by agent type
  const prompts = suggestedPrompts?.length
    ? suggestedPrompts.slice(0, 4)
    : (t(`ai:chat.defaultPrompts.${agentType ?? "assistant"}`, { returnObjects: true }) as string[])?.slice?.(0, 4) ?? []

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 pb-24">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-4">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        {agentName && (
          <h2 className="text-xl font-semibold mb-2">{agentName}</h2>
        )}
        {agentDescription && (
          <p className="text-sm text-muted-foreground mb-2">{agentDescription}</p>
        )}
        <p className="text-sm text-muted-foreground">{t("ai:chat.welcome")}</p>
      </div>

      {prompts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-lg">
          {prompts.map((prompt, i) => (
            <button
              key={i}
              type="button"
              className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm hover:bg-accent transition-colors"
              onClick={() => onPromptClick(prompt)}
            >
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span className="line-clamp-2">{prompt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
