import { useState, useCallback, useEffect, useRef } from "react"

export interface TimeRange {
  start: string
  end: string
  label: string
}

export const PRESETS = [
  { label: "last15m", minutes: 15 },
  { label: "last1h", minutes: 60 },
  { label: "last6h", minutes: 360 },
  { label: "last24h", minutes: 1440 },
  { label: "last7d", minutes: 10080 },
] as const

export type PresetLabel = (typeof PRESETS)[number]["label"]

export const REFRESH_OPTIONS = [
  { label: "off", seconds: 0 },
  { label: "10s", seconds: 10 },
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
] as const

export type RefreshLabel = (typeof REFRESH_OPTIONS)[number]["label"]

function makeRange(minutes: number, label: string): TimeRange {
  const end = new Date()
  const start = new Date(end.getTime() - minutes * 60 * 1000)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label,
  }
}

export interface UseTimeRangeOptions {
  defaultPreset?: string
  initialStart?: string | null
  initialEnd?: string | null
}

export function useTimeRange(opts: UseTimeRangeOptions | string = "last1h") {
  const options = typeof opts === "string" ? { defaultPreset: opts } : opts
  const { defaultPreset = "last1h", initialStart, initialEnd } = options

  const [range, setRange] = useState<TimeRange>(() => {
    if (initialStart && initialEnd) {
      return { start: initialStart, end: initialEnd, label: "custom" }
    }
    const preset = PRESETS.find((p) => p.label === defaultPreset) ?? PRESETS[1]
    return makeRange(preset.minutes, preset.label)
  })

  const [refreshInterval, setRefreshInterval] = useState<RefreshLabel>("off")
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectPreset = useCallback((label: string) => {
    const p = PRESETS.find((p) => p.label === label)
    if (p) {
      setRange(makeRange(p.minutes, p.label))
    }
  }, [])

  const setCustomRange = useCallback((start: string, end: string) => {
    setRange({ start, end, label: "custom" })
  }, [])

  const refresh = useCallback(() => {
    setRange((prev) => {
      if (prev.label === "custom") {
        return prev
      }
      const p = PRESETS.find((p) => p.label === prev.label)
      if (p) {
        return makeRange(p.minutes, p.label)
      }
      return prev
    })
  }, [])

  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    const opt = REFRESH_OPTIONS.find((o) => o.label === refreshInterval)
    if (opt && opt.seconds > 0) {
      refreshTimerRef.current = setInterval(() => {
        refresh()
      }, opt.seconds * 1000)
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [refreshInterval, refresh])

  return {
    range,
    selectPreset,
    setCustomRange,
    refresh,
    presets: PRESETS,
    refreshInterval,
    setRefreshInterval,
    refreshOptions: REFRESH_OPTIONS,
  }
}
