import { useParams, useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Copy, Check, Info } from "lucide-react"
import { useState, useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { fetchTrace, fetchTraceLogs } from "../../../api"
import type { Span, TraceLog } from "../../../api"
import { WaterfallChart } from "../../../components/waterfall-chart"
import { FlameChart } from "../../../components/flame-chart"
import { SpanDetailPanel } from "../../../components/span-detail-panel"

function TraceDetailPage() {
  const { t } = useTranslation("apm")
  const { traceId } = useParams<{ traceId: string }>()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null)
  const [viewTab, setViewTab] = useState<string>("waterfall")

  const { data, isLoading } = useQuery({
    queryKey: ["apm-trace", traceId],
    queryFn: () => fetchTrace(traceId!),
    enabled: !!traceId,
  })

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["apm-trace-logs", traceId],
    queryFn: () => fetchTraceLogs(traceId!),
    enabled: !!traceId,
  })

  const spans = data?.spans ?? []
  const logs = useMemo(() => logsData?.logs ?? [], [logsData?.logs])
  const logsAvailable = logsData?.logsAvailable ?? false

  const rootSpan = spans.find((s) => !s.parentSpanId)
  const totalDurationMs = rootSpan ? rootSpan.duration / 1e6 : 0
  const services = [...new Set(spans.map((s) => s.serviceName))]

  const severities = useMemo(() => {
    const set = new Set(logs.map((l: TraceLog) => l.severityText))
    return [...set].sort()
  }, [logs])

  const filteredLogs = useMemo(() => {
    if (severityFilter === "all") return logs
    return logs.filter((l: TraceLog) => l.severityText === severityFilter)
  }, [logs, severityFilter])

  const handleCopy = () => {
    navigator.clipboard.writeText(traceId ?? "")
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const severityColor = (severity: string) => {
    const s = severity.toUpperCase()
    if (s === "ERROR" || s === "FATAL") return "destructive"
    if (s === "WARN" || s === "WARNING") return "outline"
    return "secondary"
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate("/apm/traces")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{t("traceDetail")}</h1>
            <span className="font-mono text-sm text-muted-foreground">{traceId?.slice(0, 16)}...</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          {rootSpan && (
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="text-xs font-normal">{rootSpan.serviceName}</Badge>
              <span className="font-mono text-xs">{rootSpan.spanName}</span>
              <span className="font-mono text-xs">{totalDurationMs.toFixed(1)}ms</span>
              <span className="text-xs">{spans.length} spans</span>
              <span className="text-xs">{services.length} services</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">{t("loading")}</div>
      ) : spans.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">{t("detail.noSpans")}</div>
      ) : (
        <div className="flex gap-4" style={{ height: "calc(100vh - 200px)" }}>
          {/* Left panel: view tabs */}
          <div className="flex-1 min-w-0 overflow-hidden rounded-lg border">
            <Tabs value={viewTab} onValueChange={setViewTab}>
              <div className="border-b px-4 pt-2">
                <TabsList>
                  <TabsTrigger value="waterfall">{t("detail.waterfall")}</TabsTrigger>
                  <TabsTrigger value="flamegraph">{t("detail.flameGraph", "Flame Graph")}</TabsTrigger>
                  <TabsTrigger value="logs">
                    {t("logs.tab")}
                    {logs.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                        {logs.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="waterfall" className="mt-0 p-4 overflow-auto" style={{ height: "calc(100% - 48px)" }}>
                <WaterfallChart
                  spans={spans}
                  selectedSpanId={selectedSpan?.spanId}
                  onSelectSpan={setSelectedSpan}
                />
              </TabsContent>

              <TabsContent value="flamegraph" className="mt-0 p-4 overflow-auto" style={{ height: "calc(100% - 48px)" }}>
                <FlameChart
                  spans={spans}
                  selectedSpanId={selectedSpan?.spanId}
                  onSelectSpan={setSelectedSpan}
                />
              </TabsContent>

              <TabsContent value="logs" className="mt-0 p-4 overflow-auto" style={{ height: "calc(100% - 48px)" }}>
                {logsLoading ? (
                  <div className="py-12 text-center text-muted-foreground">{t("loading")}</div>
                ) : !logsAvailable ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Info className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">{t("logs.notAvailable")}</p>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">{t("logs.noLogs")}</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Select value={severityFilter} onValueChange={setSeverityFilter}>
                        <SelectTrigger className="w-[160px] h-8 text-xs">
                          <SelectValue placeholder={t("logs.allSeverities")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("logs.allSeverities")}</SelectItem>
                          {severities.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">
                        {filteredLogs.length} / {logs.length}
                      </span>
                    </div>
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">{t("logs.timestamp")}</TableHead>
                            <TableHead className="w-[80px]">{t("logs.severity")}</TableHead>
                            <TableHead className="w-[120px]">{t("logs.service")}</TableHead>
                            <TableHead>{t("logs.body")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLogs.map((log: TraceLog, i: number) => (
                            <TableRow key={`${log.spanId}-${i}`}>
                              <TableCell className="font-mono text-xs whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleTimeString(undefined, {
                                  hour12: false,
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                  fractionalSecondDigits: 3,
                                })}
                              </TableCell>
                              <TableCell>
                                <Badge variant={severityColor(log.severityText)} className="text-[10px] px-1.5">
                                  {log.severityText || "UNSET"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{log.serviceName}</TableCell>
                              <TableCell className="font-mono text-xs max-w-md truncate" title={log.body}>
                                {log.body}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right panel: span detail */}
          <div className="w-[380px] shrink-0 rounded-lg border overflow-hidden">
            <SpanDetailPanel span={selectedSpan} />
          </div>
        </div>
      )}
    </div>
  )
}

export function Component() {
  return <TraceDetailPage />
}
