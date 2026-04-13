import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams, Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { integrations } from "../../data/integrations"
import { observeApi } from "../../api"

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation("observe")

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative rounded-lg border border-border bg-muted/40 font-mono text-xs">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" />
            {t("detail.copied")}
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            {t("detail.copy")}
          </>
        )}
      </button>
      <pre className="overflow-x-auto p-4 pr-20 text-foreground whitespace-pre-wrap break-all">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function fillSnippet(snippet: string, token: string, endpoint: string) {
  return snippet
    .replace(/\{\{TOKEN\}\}/g, token || "YOUR_TOKEN")
    .replace(/\{\{ENDPOINT\}\}/g, endpoint || "https://otel.your-domain.com")
}

export function Component() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation("observe")
  const navigate = useNavigate()
  const [selectedTokenId, setSelectedTokenId] = useState<string>("")

  const integration = integrations.find((i) => i.slug === slug)

  const { data: tokens = [] } = useQuery({
    queryKey: ["observe-tokens"],
    queryFn: observeApi.listTokens,
  })

  const { data: settings } = useQuery({
    queryKey: ["observe-settings"],
    queryFn: observeApi.getSettings,
  })

  const endpoint = settings?.otelEndpoint ?? ""
  const selectedToken = tokens.find((t) => String(t.id) === selectedTokenId)
  // For snippets we use a placeholder when not selected
  const snippetToken = selectedTokenId
    ? `${selectedToken?.prefix ?? ""}••••••••••••••••`
    : "{{TOKEN}}"

  if (!integration) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted-foreground">Integration not found.</p>
        <Button variant="outline" onClick={() => navigate("/observe/integrations")}>
          {t("detail.back")}
        </Button>
      </div>
    )
  }

  const filledDocker = fillSnippet(integration.dockerSnippet, snippetToken, endpoint)
  const filledBinary = fillSnippet(integration.binarySnippet, snippetToken, endpoint)
  const filledSdk = integration.sdkSnippet
    ? fillSnippet(integration.sdkSnippet, snippetToken, endpoint)
    : undefined

  const verifyCmd = `curl -I -H "Authorization: Bearer ${snippetToken}" \\
  ${endpoint || "https://otel.your-domain.com"}/v1/metrics`

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/observe/integrations")}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detail.back")}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{integration.icon}</span>
          <div>
            <h2 className="text-xl font-semibold">{integration.name}</h2>
            <p className="text-sm text-muted-foreground">{integration.description}</p>
          </div>
          <Badge className="ml-auto" variant="secondary">
            {integration.dataType}
          </Badge>
        </div>
      </div>

      {/* Step 1 — Select Token */}
      <section className="rounded-lg border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            1
          </span>
          <h3 className="font-semibold">{t("detail.step1")}</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("detail.selectToken")}
            </label>
            {tokens.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("detail.noToken")}
                <Link to="/observe/tokens" className="text-primary hover:underline">
                  {t("detail.createToken")}
                </Link>
              </p>
            ) : (
              <Select value={selectedTokenId} onValueChange={setSelectedTokenId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("detail.selectTokenPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {tokens.map((tok) => (
                    <SelectItem key={tok.id} value={String(tok.id)}>
                      {tok.name} — {tok.prefix}••••
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("detail.endpoint")}
            </label>
            {endpoint ? (
              <code className="block rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-mono break-all">
                {endpoint}
              </code>
            ) : (
              <p className="text-sm text-muted-foreground italic">{t("detail.endpointEmpty")}</p>
            )}
          </div>
        </div>
      </section>

      {/* Step 2 — Setup */}
      <section className="rounded-lg border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            2
          </span>
          <h3 className="font-semibold">{t("detail.step2")}</h3>
        </div>

        <Tabs defaultValue="docker">
          <TabsList>
            <TabsTrigger value="docker">{t("detail.dockerTab")}</TabsTrigger>
            <TabsTrigger value="binary">{t("detail.binaryTab")}</TabsTrigger>
            {filledSdk && <TabsTrigger value="sdk">SDK</TabsTrigger>}
          </TabsList>

          <TabsContent value="docker" className="mt-3">
            <CodeBlock code={filledDocker} />
          </TabsContent>

          <TabsContent value="binary" className="mt-3">
            <CodeBlock code={filledBinary} />
          </TabsContent>

          {filledSdk && (
            <TabsContent value="sdk" className="mt-3">
              <CodeBlock code={filledSdk} />
            </TabsContent>
          )}
        </Tabs>
      </section>

      {/* Step 3 — Verify */}
      <section className="rounded-lg border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            3
          </span>
          <h3 className="font-semibold">{t("detail.step3")}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t("detail.verifyDesc")}</p>
        <CodeBlock code={verifyCmd} />
      </section>
    </div>
  )
}
