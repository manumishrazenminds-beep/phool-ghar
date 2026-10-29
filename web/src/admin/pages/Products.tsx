import { ArrowDown, ArrowUp, Plus, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { rupees } from '../format'
import { ImageInput } from '../ImageInput'
import { newId, slugify, useCategories } from '../lookups'
import { useApi } from '../mode'
import { useQuery } from '../useQuery'
import type { Category, Product, Variant } from '../types'
import { Button, Drawer, EmptyState, ErrorBanner, PageHeader, Panel, SelectField, StatusBadge, Table, TextArea, TextField, Toggle, useToast } from '../ui'

const blank = (sort: number): Product => ({ id: newId(), slug: '', name: '', tagline: '', description: '', category_id: null, image_url: null, gallery: [], price_paise: 0, per_day_paise: null, tag: '', care: '', active: true, track_stock: false, sort })
const DEFAULT_VARIANTS: Omit<Variant, 'id' | 'product_id'>[] = [
  { variant_key: 'small', label: 'Small', note: 'Single altar', multiplier: 0.7 }, { variant_key: 'regular', label: 'Regular', note: 'Family altar', multiplier: 1 }, { variant_key: 'large', label: 'Large', note: 'Shop or office', multiplier: 1.6 },
]

export default function Products() {
  const api = useApi()
  const { run } = useToast()
  const q = useQuery(() => api.select<Product>('products', { order: [{ col: 'sort' }, { col: 'name' }] }), [])
  const cats = useCategories()
  const [edit, setEdit] = useState<{ p: Product; isNew: boolean } | null>(null)
  const list = q.data ?? []
  const catName = (id: string | null) => cats.data?.find((c) => c.id === id)?.name ?? '-'

  const move = async (i: number, dir: -1 | 1) => {
    const a = list[i], b = list[i + dir]
    if (!a || !b) return
    const ok = await run(async () => { await Promise.all([api.update('products', { id: a.id }, { sort: b.sort }), api.update('products', { id: b.id }, { sort: a.sort === b.sort ? a.sort + dir : a.sort })]); return true })
    if (ok) q.reload()
  }
  const flip = async (p: Product, patch: Partial<Product>) => { if (await run(async () => { await api.update('products', { id: p.id }, patch); return true })) q.reload() }

  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Products" actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ p: blank((list.at(-1)?.sort ?? 0) + 1), isNew: true })}>New product</Button>}>
        Prices are the Regular size in rupees. Turn on Subscribable and set a per-day price to offer a daily plan.
      </PageHeader>
      <Table caption="Products" rows={q.data} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(p) => p.id} onRowClick={(p) => setEdit({ p, isNew: false })}
        empty={<EmptyState title="No products yet" action={<Button variant="primary" onClick={() => setEdit({ p: blank(1), isNew: true })}>Add the first product</Button>}>Customers see active products on the shop page.</EmptyState>}
        columns={[
          { key: 'o', header: 'Order', cell: (p) => { const i = list.indexOf(p); return (
            <span className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => void move(i, -1)} className="grid h-8 w-8 place-items-center rounded hover:bg-ink/5 disabled:opacity-30 pointer-coarse:h-11 pointer-coarse:w-11"><ArrowUp size={14} /></button>
              <button type="button" aria-label={`Move ${p.name} down`} disabled={i === list.length - 1} onClick={() => void move(i, 1)} className="grid h-8 w-8 place-items-center rounded hover:bg-ink/5 disabled:opacity-30 pointer-coarse:h-11 pointer-coarse:w-11"><ArrowDown size={14} /></button>
            </span>) } },
          { key: 'n', header: 'Product', cell: (p) => <span className="flex items-center gap-3"><span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-cream-2">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />}</span><span><b className="font-medium">{p.name}</b><span className="block text-xs text-ink-soft">{p.tagline}</span></span></span> },
          { key: 'c', header: 'Category', hideOnSmall: true, cell: (p) => catName(p.category_id) },
          { key: 'pr', header: 'Price', align: 'right', cell: (p) => rupees(p.price_paise) },
          { key: 'pd', header: 'Per day', align: 'right', hideOnSmall: true, cell: (p) => p.per_day_paise != null ? rupees(p.per_day_paise) : <span className="text-ink-soft">Not subscribable</span> },
          { key: 'a', header: 'Active', align: 'center', cell: (p) => <span onClick={(e) => e.stopPropagation()}><Toggle compact label={`${p.name} active`} checked={p.active} onChange={(v) => void flip(p, { active: v })} /></span> },
        ]} />
      {edit && <ProductDrawer key={edit.p.id} init={edit.p} isNew={edit.isNew} cats={cats.data ?? []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload() }} />}
    </>
  )
}

function ProductDrawer({ init, isNew, cats, onClose, onSaved }: { init: Product; isNew: boolean; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const api = useApi()
  const { run } = useToast()
  const [p, setP] = useState(init)
  const [price, setPrice] = useState(String(init.price_paise / 100 || ''))
  const [subscribable, setSub] = useState(init.per_day_paise != null)
  const [perDay, setPerDay] = useState(init.per_day_paise != null ? String(init.per_day_paise / 100) : '')
  const [variants, setVariants] = useState<Omit<Variant, 'id' | 'product_id'>[] | null>(null)
  const [removed, setRemoved] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const vq = useQuery(async () => {
    if (isNew) return DEFAULT_VARIANTS
    const rows = await api.select<Variant>('product_variants', { filters: [{ col: 'product_id', op: 'eq', val: init.id }] })
    return rows.map(({ variant_key, label, note, multiplier }) => ({ variant_key, label, note, multiplier }))
  }, [])
  const vs = variants ?? vq.data ?? []
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }))
  const setV = (i: number, patch: Partial<Omit<Variant, 'id' | 'product_id'>>) => setVariants(vs.map((v, j) => (j === i ? { ...v, ...patch } : v)))

  const save = async () => {
    const e: Record<string, string> = {}
    if (!p.name.trim()) e.name = 'Name is required.'
    const slug = p.slug.trim() || slugify(p.name)
    if (!slug) e.slug = 'Slug is required.'
    const pr = Math.round(Number(price) * 100)
    if (!(pr > 0)) e.price = 'Enter a price above zero.'
    const pd = subscribable ? Math.round(Number(perDay) * 100) : null
    if (subscribable && !(pd! > 0)) e.perDay = 'Enter the per-day price.'
    const keys = vs.map((v) => v.variant_key.trim())
    if (new Set(keys).size !== keys.length || keys.some((k) => !k)) e.variants = 'Each size needs a unique key such as small, regular, large.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const ok = await run(async () => {
      await api.upsert<Product>('products', { ...p, slug, name: p.name.trim(), price_paise: pr, per_day_paise: pd, category_id: p.category_id || null, tag: p.tag || null, updated_at: new Date().toISOString() } as Partial<Product>, 'id')
      if (removed.length) for (const k of removed) await api.remove('product_variants', { product_id: p.id, variant_key: k })
      if (vs.length) await api.upsert('product_variants', vs.map((v) => ({ ...v, variant_key: v.variant_key.trim(), multiplier: Number(v.multiplier) || 1, product_id: p.id })), 'product_id,variant_key')
      return true
    }, isNew ? 'Product created' : 'Product saved')
    setBusy(false)
    if (ok) onSaved()
  }

  return (
    <Drawer open onClose={onClose} wide eyebrow={isNew ? 'New product' : 'Edit product'} title={p.name || 'Untitled'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving...' : 'Save product'}</Button></>}>
      <div className="space-y-4">
        {Object.keys(errors).length > 0 && <ErrorBanner message="Fix the highlighted fields and save again." />}
        <Panel title="Basics">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Name" required value={p.name} error={errors.name} onChange={(e) => setP((x) => ({ ...x, name: e.target.value, slug: isNew && (!x.slug || x.slug === slugify(x.name)) ? slugify(e.target.value) : x.slug }))} />
            <TextField label="Slug (web address)" value={p.slug} error={errors.slug} onChange={(e) => set('slug', slugify(e.target.value))} hint="Used in the product URL." />
            <TextField label="Tagline" value={p.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} wrapperClassName="sm:col-span-2" />
            <SelectField label="Category" value={p.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)}><option value="">None</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectField>
            <TextField label="Badge (optional)" value={p.tag ?? ''} onChange={(e) => set('tag', e.target.value)} placeholder="Best seller" />
            <TextArea label="Description" value={p.description ?? ''} onChange={(e) => set('description', e.target.value)} wrapperClassName="sm:col-span-2" />
            <TextArea label="Care note" value={p.care ?? ''} onChange={(e) => set('care', e.target.value)} wrapperClassName="sm:col-span-2" rows={2} />
          </div>
        </Panel>
        <Panel title="Pricing">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="One-time price, Regular (rupees)" type="number" min="0" step="1" inputMode="decimal" value={price} error={errors.price} onChange={(e) => setPrice(e.target.value)} />
            <div>
              <Toggle label="Subscribable (daily plan)" checked={subscribable} onChange={setSub} />
              {subscribable && <TextField label="Price per day, Regular (rupees)" type="number" min="0" step="1" inputMode="decimal" value={perDay} error={errors.perDay} onChange={(e) => setPerDay(e.target.value)} />}
            </div>
          </div>
        </Panel>
        <Panel title="Sizes and variants">
          {vq.loading && !vq.data ? <p className="text-sm text-ink-soft">Loading sizes...</p> : (
            <div className="space-y-2">
              {errors.variants && <p className="text-sm text-rose" role="alert">{errors.variants}</p>}
              {vs.map((v, i) => (
                <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1.4fr_5rem_auto]">
                  <TextField label="Key" value={v.variant_key} onChange={(e) => setV(i, { variant_key: slugify(e.target.value) })} />
                  <TextField label="Label" value={v.label} onChange={(e) => setV(i, { label: e.target.value })} />
                  <TextField label="Note" value={v.note ?? ''} onChange={(e) => setV(i, { note: e.target.value })} />
                  <TextField label="Price x" type="number" min="0.1" step="0.05" value={v.multiplier} onChange={(e) => setV(i, { multiplier: Number(e.target.value) })} />
                  <Button variant="quiet" aria-label={`Remove ${v.label || 'size'}`} onClick={() => { setRemoved((r) => [...r, v.variant_key]); setVariants(vs.filter((_, j) => j !== i)) }}><X size={16} /></Button>
                </div>
              ))}
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setVariants([...vs, { variant_key: '', label: '', note: '', multiplier: 1 }])}>Add size</Button>
              <p className="text-xs text-ink-soft">Price x multiplies the Regular price, so Large at 1.6 costs 60% more.</p>
            </div>
          )}
        </Panel>
        <Panel title="Images">
          <ImageInput label="Main image" value={p.image_url} onChange={(u) => set('image_url', u)} />
          <div className="mt-4">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">Gallery</span>
            <div className="flex flex-wrap gap-3">
              {p.gallery.map((g, i) => (
                <div key={g + i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-ink/10">
                  <img src={g} alt="" className="h-full w-full object-cover" />
                  <button type="button" aria-label="Remove gallery image" onClick={() => set('gallery', p.gallery.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-ink/80 text-cream"><X size={12} /></button>
                </div>
              ))}
              <GalleryAdd onAdd={(u) => set('gallery', [...p.gallery, u])} />
            </div>
          </div>
        </Panel>
        <Panel title="Visibility and stock">
          <Toggle label="Active (visible in the shop)" checked={p.active} onChange={(v) => set('active', v)} />
          <Toggle label="Track daily stock" hint="When on, customers cannot order more than the quantity set on the Stock page." checked={p.track_stock} onChange={(v) => set('track_stock', v)} />
          {!isNew && <p className="mt-2 text-xs text-ink-soft">Status: <StatusBadge status={p.active ? 'active' : 'paused'} label={p.active ? 'Live' : 'Hidden'} /></p>}
        </Panel>
      </div>
    </Drawer>
  )
}

function GalleryAdd({ onAdd }: { onAdd: (u: string) => void }) {
  const [v, setV] = useState<string | null>(null)
  return <div className="w-48"><ImageInput label="Add image" value={v} onChange={(u) => { if (u) { onAdd(u); setV(null) } }} /></div>
}
