import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { integrations, type Integration, type IntegrationCategory } from "../../data/integrations"

const CATEGORIES: Array<{ key: "all" | IntegrationCategory; labelKey: string }> = [
  { key: "all", labelKey: "catalog.all" },
  { key: "apm", labelKey: "catalog.apm" },
  { key: "metrics", labelKey: "catalog.metrics" },
  { key: "logs", labelKey: "catalog.logs" },
]

const dataTypeBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  Traces: "default",
  Metrics: "secondary",
  Logs: "outline",
}

function IntegrationCard({ integration, onClick }: { integration: Integration; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-3xl leading-none">{integration.icon}</span>
        <Badge variant={dataTypeBadgeVariant[integration.dataType]} className="text-xs">
          {integration.dataType}
        </Badge>
      </div>
      <div>
        <p className="font-semibold text-sm text-foreground">{integration.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{integration.description}</p>
      </div>
    </button>
  )
}

export function Component() {
  const { t } = useTranslation("observe")
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<"all" | IntegrationCategory>("all")

  const filtered = useMemo(() => {
    return integrations.filter((i) => {
      const matchesCategory = activeCategory === "all" || i.category === activeCategory
      const matchesSearch =
        !search ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [search, activeCategory])

  const grouped = useMemo(() => {
    const groups: Record<IntegrationCategory, Integration[]> = { apm: [], metrics: [], logs: [] }
    for (const i of filtered) {
      groups[i.category].push(i)
    }
    return groups
  }, [filtered])

  const groupOrder: Array<{ key: IntegrationCategory; label: string }> = [
    { key: "apm", label: t("catalog.apm") },
    { key: "metrics", label: t("catalog.metrics") },
    { key: "logs", label: t("catalog.logs") },
  ]

  const hasResults = filtered.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">{t("catalog.title")}</h2>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("catalog.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeCategory === cat.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t(cat.labelKey)}
          </button>
        ))}
      </div>

      {/* Grid grouped by category */}
      {!hasResults ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("catalog.empty")}</p>
      ) : (
        <div className="space-y-8">
          {groupOrder.map(({ key, label }) => {
            const items = grouped[key]
            if (items.length === 0) return null
            return (
              <section key={key}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {items.map((integration) => (
                    <IntegrationCard
                      key={integration.slug}
                      integration={integration}
                      onClick={() => navigate(`/observe/integrations/${integration.slug}`)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
