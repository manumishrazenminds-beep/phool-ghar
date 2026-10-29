import { useEffect, useState } from 'react'
import { PLAN_PERIODS, PRODUCTS, SLOTS, VARIANTS, type Category, type Product, type Variant } from '../data/products'
import type { CartLine } from './cart'
import { backendConfigured } from './env'
import { supabase } from './supabase'

export interface SlotInfo { id: string; label: string; note: string; capacity: number | null; subscriptionOk: boolean }
export interface PlanInfo { days: number; label: string; discount: number; blurb: string }
export interface Catalog {
  products: Product[]
  variants: Variant[]
  plans: PlanInfo[]
  slots: SlotInfo[]
  source: 'supabase' | 'static'
}

export const STATIC_CATALOG: Catalog = {
  products: PRODUCTS,
  variants: VARIANTS,
  plans: PLAN_PERIODS,
  slots: SLOTS.map((s) => ({ id: s.id, label: s.label, note: s.note, capacity: null, subscriptionOk: s.id !== 'evening' })),
  source: 'static',
}

const CATS: Category[] = ['pooja', 'bouquets', 'cut', 'addon']
const asCat = (slug: string | undefined): Category => (slug === 'addons' ? 'addon' : CATS.includes(slug as Category) ? (slug as Category) : 'pooja')

interface DbProduct {
  id: string; slug: string; name: string; tagline: string | null; description: string | null; image_url: string | null
  gallery: string[] | null; price_paise: number; per_day_paise: number | null; tag: string | null; care: string | null
  categories: { slug: string } | null
}

export function mapProduct(p: DbProduct): Product {
  const fallback = PRODUCTS.find((x) => x.slug === p.slug)
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline ?? fallback?.tagline ?? '',
    description: p.description ?? fallback?.description ?? '',
    category: asCat(p.categories?.slug ?? fallback?.category),
    image: p.image_url ?? fallback?.image ?? '',
    gallery: p.gallery?.length ? p.gallery : fallback?.gallery ?? [],
    price: p.price_paise / 100,
    perDay: p.per_day_paise == null ? null : p.per_day_paise / 100,
    tag: p.tag ?? undefined,
    care: p.care ?? fallback?.care ?? '',
  }
}

/** Fetches the live catalog; any failure falls back to the static data so the storefront never breaks. */
export async function fetchCatalog(): Promise<Catalog> {
  if (!backendConfigured) return STATIC_CATALOG
  try {
    const [p, v, pl, sl] = await Promise.all([
      supabase.from('products').select('id, slug, name, tagline, description, image_url, gallery, price_paise, per_day_paise, tag, care, categories(slug)').eq('active', true).order('sort'),
      supabase.from('product_variants').select('variant_key, label, note, multiplier'),
      supabase.from('plan_periods').select('days, label, discount_pct').eq('active', true).order('days'),
      supabase.from('delivery_slots').select('id, label, capacity, subscription_ok').eq('active', true).order('sort'),
    ])
    if (p.error || !p.data?.length) return STATIC_CATALOG
    const seen = new Set<string>()
    const variants: Variant[] = []
    for (const r of (v.data ?? []) as { variant_key: string; label: string; note: string | null; multiplier: number }[]) {
      if (seen.has(r.variant_key)) continue
      seen.add(r.variant_key)
      variants.push({ id: r.variant_key, label: r.label, note: r.note ?? '', multiplier: Number(r.multiplier) })
    }
    const plans: PlanInfo[] = ((pl.data ?? []) as { days: number; label: string; discount_pct: number }[]).map((r) => {
      const d = Number(r.discount_pct) / 100
      return { days: r.days, label: r.label, discount: d, blurb: d ? `Save ${Math.round(d * 100)}%` : '' }
    })
    const slots: SlotInfo[] = ((sl.data ?? []) as { id: string; label: string; capacity: number | null; subscription_ok: boolean }[]).map((r) => ({
      id: r.id, label: r.label, note: STATIC_CATALOG.slots.find((s) => s.id === r.id)?.note ?? '', capacity: r.capacity, subscriptionOk: r.subscription_ok,
    }))
    return {
      products: (p.data as unknown as DbProduct[]).map(mapProduct),
      variants: variants.length ? variants : VARIANTS,
      plans: plans.length ? plans : PLAN_PERIODS,
      slots: slots.length ? slots : STATIC_CATALOG.slots,
      source: 'supabase',
    }
  } catch {
    return STATIC_CATALOG
  }
}

let cache: Promise<Catalog> | null = null
export const loadCatalog = () => (cache ??= fetchCatalog())

/** Live catalog with the static data as the initial value and fallback. */
export function useCatalog(): { catalog: Catalog; loading: boolean } {
  const [catalog, setCatalog] = useState<Catalog>(STATIC_CATALOG)
  const [loading, setLoading] = useState(backendConfigured)
  useEffect(() => {
    if (!backendConfigured) return
    let alive = true
    loadCatalog().then((c) => { if (alive) { setCatalog(c); setLoading(false) } })
    return () => { alive = false }
  }, [])
  return { catalog, loading }
}

export interface ResolvedLine { line: CartLine; product: Product; variant: Variant; plan?: PlanInfo }

/** Cart lines carry the static product id; resolve to the live product through the slug. */
export function resolveLine(line: CartLine, catalog: Catalog): ResolvedLine | null {
  const stat = PRODUCTS.find((p) => p.id === line.productId)
  const product = catalog.products.find((p) => p.slug === stat?.slug || p.id === line.productId) ?? stat
  const variant = catalog.variants.find((v) => v.id === line.variantId) ?? VARIANTS.find((v) => v.id === line.variantId)
  if (!product || !variant) return null
  const plan = line.mode === 'sub' ? catalog.plans.find((p) => p.days === line.period) ?? catalog.plans[catalog.plans.length - 1] : undefined
  return { line, product, variant, plan }
}
