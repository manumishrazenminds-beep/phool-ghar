import { useCallback, useEffect, useRef, useState } from 'react'
import { readableError } from './format'
import { useAdminMode } from './mode'

export interface QueryState<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  reload: () => void
}

/** Runs `fn` on mount and whenever `deps` or the demo/live mode change. Ignores stale responses. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const { demo } = useAdminMode()
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: string | null }>({ data: undefined, loading: true, error: null })
  const [tick, setTick] = useState(0)
  const seq = useRef(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    const my = ++seq.current
    setState((s) => ({ ...s, loading: true, error: null }))
    fnRef.current().then(
      (data) => { if (my === seq.current) setState({ data, loading: false, error: null }) },
      (e) => { if (my === seq.current) setState((s) => ({ data: s.data, loading: false, error: readableError(e) })) },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, tick, ...deps])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}

/** Small debounce for search boxes. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
