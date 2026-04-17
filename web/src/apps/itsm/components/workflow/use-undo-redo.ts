import { useState, useCallback, useRef } from "react"
import type { Node, Edge } from "@xyflow/react"

interface UndoRedoState {
  nodes: Node[]
  edges: Edge[]
}

interface UndoRedoResult {
  undo: () => UndoRedoState | null
  redo: () => UndoRedoState | null
  push: (state: UndoRedoState) => void
  canUndo: boolean
  canRedo: boolean
}

export function useUndoRedo(): UndoRedoResult {
  const [past, setPast] = useState<UndoRedoState[]>([])
  const [future, setFuture] = useState<UndoRedoState[]>([])
  const currentRef = useRef<UndoRedoState | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const push = useCallback((state: UndoRedoState) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      if (currentRef.current) {
        setPast((p) => [...p, currentRef.current!])
      }
      currentRef.current = { nodes: [...state.nodes], edges: [...state.edges] }
      setFuture([])
      debounceRef.current = null
    }, 300)
  }, [])

  const undo = useCallback((): UndoRedoState | null => {
    let result: UndoRedoState | null = null
    setPast((p) => {
      if (p.length === 0) return p
      const prev = p[p.length - 1]
      result = prev
      if (currentRef.current) {
        setFuture((f) => [...f, currentRef.current!])
      }
      currentRef.current = prev
      return p.slice(0, -1)
    })
    return result
  }, [])

  const redo = useCallback((): UndoRedoState | null => {
    let result: UndoRedoState | null = null
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[f.length - 1]
      result = next
      if (currentRef.current) {
        setPast((p) => [...p, currentRef.current!])
      }
      currentRef.current = next
      return f.slice(0, -1)
    })
    return result
  }, [])

  return {
    undo,
    redo,
    push,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
