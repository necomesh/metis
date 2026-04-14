import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { Network } from "lucide-react"

import { fetchTopology } from "../../api"
import { useTimeRange } from "../../hooks/use-time-range"
import { TimeRangePicker } from "../../components/time-range-picker"
import { ServiceMap } from "../../components/service-map"

function TopologyPage() {
  const { t } = useTranslation("apm")
  const { range, selectPreset, setCustomRange, refresh, presets, refreshInterval, setRefreshInterval } = useTimeRange("last1h")

  const { data, isLoading } = useQuery({
    queryKey: ["apm-topology", range.start, range.end],
    queryFn: () => fetchTopology(range.start, range.end),
  })

  const hasData = data && data.nodes && data.nodes.length > 0

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("topology.title")}</h1>
          {hasData && (
            <span className="ml-1 text-xs text-muted-foreground font-mono">
              {data.nodes.length} services · {data.edges.length} edges
            </span>
          )}
        </div>
        <TimeRangePicker value={range.label} presets={presets} onSelect={selectPreset} onRefresh={refresh} onCustomRange={setCustomRange} refreshInterval={refreshInterval} onRefreshIntervalChange={setRefreshInterval} />
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">{t("loading")}</div>
      ) : !hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Network className="h-12 w-12 text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">{t("topology.noData")}</p>
          <p className="mt-1 text-sm text-muted-foreground/60">{t("topology.noDataHint")}</p>
        </div>
      ) : (
        <div className="flex-1 rounded-xl border bg-card overflow-hidden">
          <ServiceMap graph={data} timeStart={range.start} timeEnd={range.end} />
        </div>
      )}
    </div>
  )
}

export function Component() {
  return <TopologyPage />
}
