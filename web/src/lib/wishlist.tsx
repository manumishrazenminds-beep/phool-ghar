import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { backendConfigured } from './env'
import { supabase } from './supabase'

const STORAGE = 'phoolghar.wishlist.v1'

interface Ctx {
  slugs: string[]
  has: (slug: string) => boolean
  toggle: (slug: string) => void
}
const WishlistCtx = createContext<Ctx | null>(null)

function readLocal(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? '[]')
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Favourites live in this browser for guests and sync to the account (public.wishlist) once signed in. */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [slugs, setSlugs] = useState<string[]>(readLocal)
  const ids = useRef(new Map<string, string>()) // slug -> product uuid, filled lazily

  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(slugs)) } catch { /* storage unavailable */ }
  }, [slugs])

  const idFor = useCallback(async (slug: string) => {
    const hit = ids.current.get(slug)
    if (hit) return hit
    const { data } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle()
    if (data?.id) ids.current.set(slug, data.id as string)
    return (data?.id as string | undefined) ?? null
  }, [])

  // on sign-in: merge the account's favourites with this browser's
  useEffect(() => {
    if (!backendConfigured || !user) return
    let live = true
    ;(async () => {
      const { data, error } = await supabase.from('wishlist').select('product_id, products(slug)')
      if (error || !live) return
      const remote = ((data ?? []) as unknown as { product_id: string; products: { slug: string } | null }[])
      for (const r of remote) if (r.products?.slug) ids.current.set(r.products.slug, r.product_id)
      const remoteSlugs = remote.map((r) => r.products?.slug).filter((s): s is string => !!s)
      const local = readLocal()
      const merged = [...new Set([...remoteSlugs, ...local])]
      setSlugs(merged)
      for (const s of local.filter((x) => !remoteSlugs.includes(x))) {
        const pid = await idFor(s)
        if (pid) await supabase.from('wishlist').insert({ user_id: user.id, product_id: pid })
      }
    })().catch(() => { /* the local list still works */ })
    return () => { live = false }
  }, [user, idFor])

  const toggle = useCallback((slug: string) => {
    const on = slugs.includes(slug)
    setSlugs((p) => (on ? p.filter((x) => x !== slug) : [...p, slug]))
    if (!backendConfigured || !user) return
    ;(async () => {
      const pid = await idFor(slug)
      if (!pid) return
      if (on) await supabase.from('wishlist').delete().eq('user_id', user.id).eq('product_id', pid)
      else await supabase.from('wishlist').insert({ user_id: user.id, product_id: pid })
    })().catch(() => { /* retried on next sign-in merge */ })
  }, [slugs, user, idFor])

  const value = useMemo<Ctx>(() => ({ slugs, has: (s) => slugs.includes(s), toggle }), [slugs, toggle])
  return <WishlistCtx.Provider value={value}>{children}</WishlistCtx.Provider>
}

export function useWishlist(): Ctx {
  const c = useContext(WishlistCtx)
  if (!c) throw new Error('useWishlist must be used inside <WishlistProvider>')
  return c
}
