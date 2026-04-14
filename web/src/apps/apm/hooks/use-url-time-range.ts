import { useCallback, useEffect, useRef } from "react"
import { useSearchParams } from "react-router"
import { useTimeRange, type UseTimeRangeOptions } from "./use-time-range"

/**
 * Wraps useTimeRange with bidirectional URL searchParams sync.
 * Reads start/end/label from URL on mount; writes them back on change.
 */
export function useUrlTimeRange(defaults?: Omit<UseTimeRangeOptions, "initialStart" | "initialEnd">) {
  const [searchParams, setSearchParams] = useSearchParams()
  const isInitialMount = useRef(true)

  const urlStart = searchParams.get("start")
  const urlEnd = searchParams.get("end")

  const tr = useTimeRange({
    ...defaults,
    initialStart: urlStart,
    initialEnd: urlEnd,
  })

  // Sync range changes back to URL
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("start", tr.range.start)
      next.set("end", tr.range.end)
      if (tr.range.label !== "custom") {
        next.set("label", tr.range.label)
      } else {
        next.delete("label")
      }
      return next
    }, { replace: true })
  }, [tr.range.start, tr.range.end, tr.range.label, setSearchParams])

  const setUrlParam = useCallback((key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  return { ...tr, searchParams, setUrlParam }
}
