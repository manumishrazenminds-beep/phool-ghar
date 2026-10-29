import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { friendlyError, type NotificationRow } from '../lib/api'
import { backendConfigured } from '../lib/env'
import { supabase } from '../lib/supabase'
import { demoCustomerActive, demoNotifications } from '../lib/demoCustomer'

interface NCtx {
  items: NotificationRow[]
  unread: number
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const empty: NCtx = { items: [], unread: 0, loading: false, error: null, reload: async () => {}, markRead: async () => {}, markAllRead: async () => {} }
const Ctx = createContext<NCtx>(empty)

/** Safe outside the provider: returns an empty inbox. The Navbar can use `unread` for a badge. */
// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(Ctx)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.id
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (demoCustomerActive() && uid) { setItems((p) => (p.length ? p : demoNotifications)); return }
    if (!backendConfigured || !uid) { setItems([]); return }
    setLoading(true); setError(null)
    const { data, error: e } = await supabase.from('notifications').select('id, type, title, body, data, read_at, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50)
    if (e) setError(friendlyError(e)); else setItems((data ?? []) as NotificationRow[])
    setLoading(false)
  }, [uid])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (!backendConfigured || !uid) return
    const ch = supabase.channel(`notifications:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (p) => setItems((prev) => (prev.some((x) => x.id === (p.new as NotificationRow).id) ? prev : [p.new as NotificationRow, ...prev])))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (p) => setItems((prev) => prev.map((x) => (x.id === (p.new as NotificationRow).id ? (p.new as NotificationRow) : x))))
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [uid])

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString()
    setItems((p) => p.map((x) => (x.id === id && !x.read_at ? { ...x, read_at: now } : x)))
    if (demoCustomerActive()) return
    const { error: e } = await supabase.from('notifications').update({ read_at: now }).eq('id', id)
    if (e) void reload()
  }, [reload])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    setItems((p) => p.map((x) => (x.read_at ? x : { ...x, read_at: now })))
    if (demoCustomerActive()) return
    const { error: e } = await supabase.from('notifications').update({ read_at: now }).is('read_at', null)
    if (e) void reload()
  }, [reload])

  const value = useMemo<NCtx>(() => ({ items, unread: items.filter((i) => !i.read_at).length, loading, error, reload, markRead, markAllRead }), [items, loading, error, reload, markRead, markAllRead])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
