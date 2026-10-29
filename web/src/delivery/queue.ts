import { useCallback, useEffect, useRef, useState } from 'react'
import type { Api } from '../admin/api'
import type { OrderStatus } from '../admin/types'

export interface QueuedUpdate { id: string; orderId: string; status: OrderStatus; note: string | null; ts: number }
const KEY = 'pg_delivery_queue_v1'

function load(): QueuedUpdate[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function save(q: QueuedUpdate[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q)) } catch { /* storage full or blocked: queue lives in memory only */ }
}
const isNetwork = (m: string) => !navigator.onLine || /cannot reach the server|failed to fetch|network|load failed/i.test(m)

/**
 * Offline-tolerant status updates. `enqueue` stores the change in localStorage first, shows it optimistically via
 * `pending`, then flushes in order. Network failures stay queued and retry on reconnect and every 20 s.
 * Server rejections (permission, wrong state) are dropped and reported through `onRejected` so the UI can revert.
 */
export function useStatusQueue(api: Api, onRejected: (u: QueuedUpdate, message: string) => void, onSynced: () => void) {
  const [queue, setQueue] = useState<QueuedUpdate[]>(load)
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const busy = useRef(false)
  const apiRef = useRef(api)
  apiRef.current = api
  const cbs = useRef({ onRejected, onSynced })
  cbs.current = { onRejected, onSynced }

  const persist = useCallback((next: QueuedUpdate[]) => { save(next); setQueue(next) }, [])

  const flush = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setSyncing(true)
    let did = false
    try {
      for (;;) {
        const q = load()
        const head = q[0]
        if (!head) break
        try {
          await apiRef.current.rpc('set_order_status', { p_order: head.orderId, p_status: head.status, p_note: head.note })
          did = true
          persist(load().filter((x) => x.id !== head.id))
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e)
          if (isNetwork(m)) break
          persist(load().filter((x) => x.id !== head.id))
          cbs.current.onRejected(head, m)
        }
      }
    } finally {
      busy.current = false
      setSyncing(false)
    }
    if (did) cbs.current.onSynced()
  }, [persist])

  const enqueue = useCallback((orderId: string, status: OrderStatus, note: string | null = null) => {
    persist([...load(), { id: Math.random().toString(36).slice(2), orderId, status, note, ts: Date.now() }])
    void flush()
  }, [flush, persist])

  useEffect(() => {
    const on = () => { setOnline(true); void flush() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const t = setInterval(() => { if (load().length) void flush() }, 20000)
    void flush()
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(t) }
  }, [flush])

  /** latest queued status per order, for optimistic display */
  const pending = new Map<string, QueuedUpdate>()
  for (const u of queue) pending.set(u.orderId, u)
  return { enqueue, pending, count: queue.length, syncing, online, flush }
}
