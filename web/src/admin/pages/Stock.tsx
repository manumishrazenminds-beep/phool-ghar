import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { WEEKDAY_SHORT, addDays, fmtDate, todayISO, weekdayOf } from '../format'
import { useProducts } from '../lookups'
import { useApi } from '../mode'
import { useQuery } from '../useQuery'
import type { StockRow } from '../types'
import { Button, EmptyState, ErrorBanner, PageHeader, Skeleton, TextField, Toggle, Toolbar, useToast } from '../ui'

type Cell = { qty: number; unlimited: boolean }

export default function Stock() {
  const api = useApi()
  const { run } = useToast()
  const [start, setStart] = useState(todayISO())
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start])
  const prods = useProducts()
  const stock = useQuery(() => api.select<StockRow>('product_stock', { filters: [{ col: 'stock_date', op: 'gte', val: dates[0] }, { col: 'stock_date', op: 'lte', val: dates[6] }], limit: 2000 }), [start])
  const [edits, setEdits] = useState<Record<string, Cell>>({})
  const [busy, setBusy] = useState(false)
  const key = (p: string, d: string) => p + '|' + d
  const base = useMemo(() => new Map((stock.data ?? []).map((r) => [key(r.product_id, r.stock_date), { qty: r.qty, unlimited: r.unlimited }])), [stock.data])
  const get = (p: string, d: string): Cell | undefined => edits[key(p, d)] ?? base.get(key(p, d))
  const put = (p: string, d: string, patch: Partial<Cell>) => setEdits((e) => ({ ...e, [key(p, d)]: { qty: 0, unlimited: false, ...get(p, d), ...patch } }))
  const dirty = Object.keys(edits).length

  const save = async () => {
    setBusy(true)
    const rows = Object.entries(edits).map(([k, c]) => { const [product_id, stock_date] = k.split('|'); return { product_id, stock_date, qty: Math.max(0, Math.floor(c.qty || 0)), unlimited: c.unlimited } })
    const ok = await run(async () => { await api.upsert('product_stock', rows, 'product_id,stock_date'); return true }, `Saved ${rows.length} cell${rows.length > 1 ? 's' : ''}`)
    setBusy(false)
    if (ok) { setEdits({}); stock.reload() }
  }
  const setTrack = async (id: string, v: boolean) => { if (await run(async () => { await api.update('products', { id }, { track_stock: v }); return true })) prods.reload() }
  const copyFirst = (pid: string) => { const f = get(pid, dates[0]); if (f) dates.slice(1).forEach((d) => put(pid, d, f)) }

  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Daily stock" actions={<Button variant="primary" disabled={!dirty || busy} onClick={() => void save()}>{busy ? 'Saving...' : dirty ? `Save ${dirty} change${dirty > 1 ? 's' : ''}` : 'Saved'}</Button>}>
        Set how many of each product can be sold per day. Products that do not track stock are always available.
      </PageHeader>
      <Toolbar>
        <TextField label="Week starting" type="date" value={start} onChange={(e) => { if (!dirty || window.confirm('Discard unsaved changes?')) { setEdits({}); setStart(e.target.value) } }} />
        <Button onClick={() => setStart(addDays(start, -7))}>Previous week</Button>
        <Button onClick={() => setStart(addDays(start, 7))}>Next week</Button>
      </Toolbar>
      {(stock.error || prods.error) && <ErrorBanner message={(stock.error || prods.error)!} onRetry={() => { stock.reload(); prods.reload() }} />}
      {prods.loading && !prods.data ? <Skeleton rows={6} /> : prods.products.length === 0 ? <EmptyState title="No products">Add products first.</EmptyState> : (
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <caption className="sr-only">Daily stock quantities by product and date</caption>
            <thead><tr className="border-b border-ink/10 bg-cream-2/40">
              <th scope="col" className="sticky left-0 z-10 bg-cream-2 px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">Product</th>
              <th scope="col" className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">Track</th>
              {dates.map((d) => <th key={d} scope="col" className="px-2 py-2 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{WEEKDAY_SHORT[weekdayOf(d)]}<span className="block normal-case tracking-normal">{fmtDate(d, { day: 'numeric', month: 'short' })}</span></th>)}
              <th scope="col" className="px-2" />
            </tr></thead>
            <tbody>
              {prods.products.map((p) => (
                <tr key={p.id} className={clsx('border-b border-ink/5 last:border-0', !p.active && 'opacity-60')}>
                  <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium">{p.name}{!p.active && <span className="block text-xs font-normal text-ink-soft">Hidden</span>}</th>
                  <td className="px-3"><Toggle compact label={`Track stock for ${p.name}`} checked={p.track_stock} onChange={(v) => void setTrack(p.id, v)} /></td>
                  {dates.map((d) => {
                    const c = get(p.id, d)
                    return (
                      <td key={d} className="px-1.5 py-1.5 text-center">
                        <input aria-label={`${p.name} quantity on ${d}`} type="number" min="0" inputMode="numeric" disabled={!p.track_stock || c?.unlimited}
                          value={c?.unlimited ? '' : c?.qty ?? ''} placeholder={c?.unlimited ? 'any' : p.track_stock ? '0' : '-'}
                          onChange={(e) => put(p.id, d, { qty: Number(e.target.value), unlimited: false })}
                          className={clsx('h-9 w-16 rounded-md border bg-white px-1.5 text-center pointer-coarse:h-11', edits[key(p.id, d)] ? 'border-marigold' : 'border-ink/15', !p.track_stock && 'bg-ink/5')} />
                        <label className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-ink-soft">
                          <input type="checkbox" disabled={!p.track_stock} checked={!!c?.unlimited} onChange={(e) => put(p.id, d, { unlimited: e.target.checked })} className="h-3.5 w-3.5 accent-[#1f3d2b]" />
                          <span>Unlimited</span>
                        </label>
                      </td>
                    )
                  })}
                  <td className="px-2"><Button size="sm" variant="quiet" disabled={!p.track_stock || !get(p.id, dates[0])} onClick={() => copyFirst(p.id)} title="Copy the first day across the week">Copy day 1</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
