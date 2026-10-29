import { MagnifyingGlass, SlidersHorizontal } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { SplitWords } from '../components/Motion'
import { CATEGORIES, SHOP_PRODUCTS, inr, type Category } from '../data/products'
import { backendConfigured } from '../lib/env'
import { useSeo } from '../lib/seo'
import { supabase } from '../lib/supabase'

type Sort = 'featured' | 'low' | 'high'

const PRICE_BANDS = [
  { id: 'any', label: 'Any price', min: 0, max: Infinity },
  { id: 'u200', label: 'Under ' + inr(200), min: 0, max: 200 },
  { id: '200-500', label: inr(200) + ' to ' + inr(500), min: 200, max: 500 },
  { id: '500-1200', label: inr(500) + ' to ' + inr(1200), min: 500, max: 1200 },
  { id: 'o1200', label: inr(1200) + ' and above', min: 1200, max: Infinity },
]

/** Slugs that cannot be delivered tomorrow: stock-tracked products with no stock row left for that date. */
function useSoldOut(): Set<string> {
  const [out, setOut] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!backendConfigured) return
    const d = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    Promise.all([
      supabase.from('products').select('id, slug, track_stock').eq('active', true),
      supabase.from('product_stock').select('product_id, qty, unlimited').eq('stock_date', d),
    ]).then(([p, st]) => {
      const stock = new Map(((st.data ?? []) as { product_id: string; qty: number; unlimited: boolean }[]).map((r) => [r.product_id, r]))
      const gone = ((p.data ?? []) as { id: string; slug: string; track_stock: boolean }[])
        .filter((x) => x.track_stock && !(stock.get(x.id)?.unlimited || (stock.get(x.id)?.qty ?? 0) > 0)).map((x) => x.slug)
      setOut(new Set(gone))
    }).catch(() => { /* availability is a nicety; show everything on failure */ })
  }, [])
  return out
}

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const cat = (params.get('c') as Category | null) ?? null
  const subOnly = params.get('type') === 'sub'
  const [q, setQ] = useState(params.get('q') ?? '')
  const [sort, setSort] = useState<Sort>('featured')
  const [band, setBand] = useState('any')
  const [inStock, setInStock] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const soldOut = useSoldOut()
  const catInfo = CATEGORIES.find((c) => c.id === cat)
  useSeo(subOnly
    ? { title: 'Daily flower subscription in Pune and Mumbai', path: '/shop?type=sub', description: 'Subscribe to fresh pooja flowers every morning. Choose your days, skip or pause any day, and save up to 10% on monthly plans.' }
    : catInfo
      ? { title: `${catInfo.label} online`, path: `/shop?c=${catInfo.id}`, description: `${catInfo.blurb} Fresh, hand-picked and delivered to your door.` }
      : { title: 'Shop fresh flowers online', path: '/shop', description: 'Pooja flowers, bouquets and cut flowers, fresh every day. Buy once or subscribe for daily delivery.' })

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const items = useMemo(() => {
    const b = PRICE_BANDS.find((x) => x.id === band)!
    let list = SHOP_PRODUCTS.filter((p) => (!cat || p.category === cat) && (!subOnly || p.perDay) && p.name.toLowerCase().includes(q.toLowerCase())
      && p.price >= b.min && p.price < b.max && !(inStock && soldOut.has(p.slug)))
    if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price)
    if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price)
    return list
  }, [cat, subOnly, q, sort, band, inStock, soldOut])

  const chip = (active: boolean) => `rounded-full border px-5 py-2.5 text-sm font-medium transition ${active ? 'border-ink bg-ink text-cream' : 'border-ink/15 hover:border-ink/40'}`

  return (
    <div className="mx-auto max-w-7xl px-6 pb-28 pt-36">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-marigold">{subOnly ? 'Daily plans' : 'The shop'}</p>
      <h1 className="font-display mt-3 text-5xl sm:text-7xl"><SplitWords text={subOnly ? 'Subscribe to freshness' : 'Every bloom, fresh daily'} /></h1>

      <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6">
          <button className={chip(!cat && !subOnly)} onClick={() => setParams({}, { replace: true })}>All</button>
          {CATEGORIES.map((c) => <button key={c.id} className={chip(cat === c.id)} onClick={() => set('c', cat === c.id ? null : c.id)}>{c.label}</button>)}
          <button className={chip(subOnly)} onClick={() => set('type', subOnly ? null : 'sub')}>Subscribable</button>
        </div>
        <div className="flex gap-3">
          <label className="flex flex-1 items-center gap-2 rounded-full border border-ink/15 bg-white px-4 focus-within:border-marigold lg:w-64">
            <MagnifyingGlass size={18} className="text-ink-soft" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search flowers" aria-label="Search" className="w-full bg-transparent py-2.5 text-sm outline-none" />
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="rounded-full border border-ink/15 bg-white px-4 text-sm outline-none">
            <option value="featured">Featured</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <button onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15 px-5 text-sm font-medium hover:border-ink/40">
          <SlidersHorizontal size={16} /> Filters{(band !== 'any' || inStock) && <span className="h-2 w-2 rounded-full bg-marigold" />}
        </button>
        {filtersOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-3xl bg-cream-2 p-5">
            <label className="flex items-center gap-3 text-sm">
              <span className="font-semibold">Price</span>
              <select value={band} onChange={(e) => setBand(e.target.value)} className="rounded-full border border-ink/15 bg-white px-4 py-2.5 outline-none">
                {PRICE_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="h-5 w-5 accent-[var(--color-leaf)]" />
              <span><span className="font-semibold">Available tomorrow</span><span className="block text-xs text-ink-soft">Hide items that are sold out for the next delivery day</span></span>
            </label>
            {(band !== 'any' || inStock) && <button onClick={() => { setBand('any'); setInStock(false) }} className="text-sm underline">Clear filters</button>}
          </div>
        )}
      </div>

      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
        <AnimatePresence mode="popLayout">
          {items.map((p, i) => (
            <motion.div layout key={p.id} className="h-full" exit={{ opacity: 0, scale: 0.95 }}>
              <ProductCard product={p} index={i} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {items.length === 0 && <p className="py-24 text-center text-ink-soft">No flowers match those filters. Try another name or clear the filters.</p>}
    </div>
  )
}
