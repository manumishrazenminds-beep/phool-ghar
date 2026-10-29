import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { WEEKDAY_SHORT, addDays, fmtDate, rupees, todayISO, weekdayOf } from '../format'
import { useCustomerMap, useProducts, useSlots } from '../lookups'
import { useApi } from '../mode'
import { useQuery } from '../useQuery'
import type { SubSkip, Subscription } from '../types'
import { Button, ConfirmDialog, Drawer, EmptyState, PageHeader, Panel, StatusBadge, Table, Tabs, TextField, Toolbar, useToast } from '../ui'

type Tab = 'all' | 'active' | 'paused' | 'pending_payment' | 'cancelled' | 'completed'
type View = 'list' | 'calendar'

export default function Subscriptions() {
  const api = useApi()
  const [tab, setTab] = useState<Tab>('active')
  const [view, setView] = useState<View>('list')
  const [open, setOpen] = useState<Subscription | null>(null)
  const cust = useCustomerMap()
  const prods = useProducts()
  const { label } = useSlots()
  const q = useQuery(() => api.select<Subscription>('subscriptions', { order: [{ col: 'created_at', asc: false }], limit: 500 }), [])
  const skips = useQuery(() => api.select<SubSkip>('subscription_skips', { filters: [{ col: 'skip_date', op: 'gte', val: todayISO(-31) }], limit: 3000 }), [])
  const all = q.data ?? []
  const rows = tab === 'all' ? all : all.filter((s) => s.status === tab)
  const count = (st: string) => all.filter((s) => s.status === st).length
  const reload = () => { q.reload(); skips.reload() }

  return (
    <>
      <PageHeader eyebrow="Operate" title="Subscriptions">Pause, resume, skip or cancel on behalf of a customer. The 9 pm cut-off applies to tomorrow, exactly as it does for customers.</PageHeader>
      <Toolbar>
        <Tabs label="Status" value={tab} onChange={setTab} tabs={[
          { id: 'active', label: 'Active', count: count('active') }, { id: 'paused', label: 'Paused', count: count('paused') },
          { id: 'pending_payment', label: 'Awaiting payment', count: count('pending_payment') }, { id: 'cancelled', label: 'Cancelled', count: count('cancelled') },
          { id: 'completed', label: 'Completed', count: count('completed') }, { id: 'all', label: 'All', count: all.length },
        ]} />
        <div className="ml-auto"><Tabs label="View" value={view} onChange={setView} tabs={[{ id: 'list', label: 'List' }, { id: 'calendar', label: 'Calendar' }]} /></div>
      </Toolbar>
      {view === 'list' ? (
        <Table caption="Subscriptions" rows={q.data ? rows : undefined} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(s) => s.id} onRowClick={setOpen}
          empty={<EmptyState title="No subscriptions in this view">Subscriptions appear once a customer pays for a plan.</EmptyState>}
          columns={[
            { key: 'c', header: 'Customer', cell: (s) => <b className="font-medium">{cust.name(s.user_id)}</b> },
            { key: 'p', header: 'Product', cell: (s) => <span>{prods.map.get(s.product_id)?.name ?? '-'}<span className="block text-xs text-ink-soft">{s.variant_key} / {label(s.slot_id)}</span></span> },
            { key: 'd', header: 'Days', hideOnSmall: true, cell: (s) => <span className="text-xs">{s.delivery_days.length === 7 ? 'Every day' : s.delivery_days.map((d) => WEEKDAY_SHORT[d]).join(' ')}</span> },
            { key: 'r', header: 'Runs', cell: (s) => <span className="text-xs">{fmtDate(s.start_date, { day: 'numeric', month: 'short' })} to {fmtDate(s.end_date, { day: 'numeric', month: 'short' })}</span> },
            { key: 's', header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
            { key: 't', header: 'Plan', align: 'right', cell: (s) => <span>{s.plan_days}d<span className="block text-xs text-ink-soft">{rupees(s.total_paise)}</span></span> },
          ]} />
      ) : <CalendarView subs={all} skips={skips.data ?? []} name={(s) => cust.name(s.user_id)} loading={q.loading} onOpen={setOpen} />}
      <SubDrawer sub={open} name={open ? cust.name(open.user_id) : ''} product={open ? prods.map.get(open.product_id)?.name ?? '' : ''} skips={skips.data ?? []} onClose={() => setOpen(null)} onChanged={() => { reload(); setOpen(null) }} />
    </>
  )
}

function CalendarView({ subs, skips, name, loading, onOpen }: { subs: Subscription[]; skips: SubSkip[]; name: (s: Subscription) => string; loading: boolean; onOpen: (s: Subscription) => void }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [day, setDay] = useState<string | null>(null)
  const first = month + '-01'
  const lead = weekdayOf(first)
  const daysIn = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const cells = Array.from({ length: lead + daysIn }, (_, i) => (i < lead ? null : `${month}-${String(i - lead + 1).padStart(2, '0')}`))
  const shift = (n: number) => { const d = new Date(first + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); setMonth(d.toISOString().slice(0, 7)); setDay(null) }
  const byId = useMemo(() => new Map(subs.map((s) => [s.id, s])), [subs])
  const info = (d: string) => ({
    skipped: skips.filter((k) => k.skip_date === d).map((k) => byId.get(k.subscription_id)).filter(Boolean) as Subscription[],
    paused: subs.filter((s) => s.status === 'paused' && s.paused_from && s.paused_to && d >= s.paused_from && d <= s.paused_to),
  })
  const sel = day ? info(day) : null
  return (
    <Panel title="Skips and pauses" actions={
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-ink/5 pointer-coarse:h-11 pointer-coarse:w-11"><CaretLeft size={16} /></button>
        <span className="min-w-28 text-center text-sm font-medium">{fmtDate(first, { month: 'long', year: 'numeric' })}</span>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-ink/5 pointer-coarse:h-11 pointer-coarse:w-11"><CaretRight size={16} /></button>
      </div>}>
      {loading && <p className="mb-2 text-xs text-ink-soft" role="status">Loading...</p>}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_SHORT.map((w) => <div key={w} className="py-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const x = info(d)
          const isDay = day === d
          return (
            <button key={d} type="button" onClick={() => setDay(d)} aria-pressed={isDay} aria-label={`${fmtDate(d)}: ${x.skipped.length} skips, ${x.paused.length} paused`}
              className={clsx('min-h-14 rounded-lg border p-1 text-left text-xs transition-colors sm:min-h-16', isDay ? 'border-ink bg-white' : 'border-ink/10 bg-white/60 hover:border-ink/30', d === todayISO() && 'ring-1 ring-marigold')}>
              <span className="block font-medium">{Number(d.slice(8))}</span>
              {x.skipped.length > 0 && <span className="mt-0.5 block rounded bg-saffron/40 px-1 text-[11px] text-marigold-deep">{x.skipped.length} skip</span>}
              {x.paused.length > 0 && <span className="mt-0.5 block rounded bg-sky-100 px-1 text-[11px] text-sky-800">{x.paused.length} paused</span>}
            </button>
          )
        })}
      </div>
      <div className="mt-4 border-t border-ink/10 pt-3">
        {!sel ? <p className="text-sm text-ink-soft">Choose a day to see who is skipping or paused.</p> : sel.skipped.length + sel.paused.length === 0 ? <p className="text-sm text-ink-soft">No skips or pauses on {fmtDate(day)}.</p> : (
          <ul className="space-y-1.5">
            {sel.skipped.map((s) => <li key={'k' + s.id}><button type="button" className="text-sm underline-offset-2 hover:underline" onClick={() => onOpen(s)}>{name(s)}</button> <span className="text-xs text-marigold-deep">skips this day</span></li>)}
            {sel.paused.map((s) => <li key={'p' + s.id}><button type="button" className="text-sm underline-offset-2 hover:underline" onClick={() => onOpen(s)}>{name(s)}</button> <span className="text-xs text-sky-800">paused until {fmtDate(s.paused_to, { day: 'numeric', month: 'short' })}</span></li>)}
          </ul>
        )}
      </div>
    </Panel>
  )
}

function SubDrawer({ sub, name, product, skips, onClose, onChanged }: { sub: Subscription | null; name: string; product: string; skips: SubSkip[]; onClose: () => void; onChanged: () => void }) {
  const api = useApi()
  const { run } = useToast()
  const [mode, setMode] = useState<null | 'cancel' | 'pause'>(null)
  const [from, setFrom] = useState(todayISO(1))
  const [to, setTo] = useState(todayISO(4))
  const [skipDate, setSkipDate] = useState(todayISO(1))
  const [busy, setBusy] = useState(false)
  if (!sub) return null
  const mine = skips.filter((k) => k.subscription_id === sub.id).map((k) => k.skip_date).sort()
  const go = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); const r = await run(async () => { await fn(); return true }, ok); setBusy(false); if (r) { setMode(null); onChanged() } }
  const live = sub.status === 'active' || sub.status === 'paused'
  return (
    <>
      <Drawer open onClose={onClose} eyebrow="Subscription" title={name}
        footer={live ? (<>
          {sub.status === 'paused' ? <Button variant="primary" disabled={busy} onClick={() => void go(() => api.rpc('resume_subscription', { p_sub: sub.id }), 'Subscription resumed')}>Resume</Button> : <Button onClick={() => setMode('pause')}>Pause</Button>}
          <Button variant="danger" onClick={() => setMode('cancel')}>Cancel subscription</Button></>) : undefined}>
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={sub.status} /><span className="text-sm text-ink-soft">{product} / {sub.variant_key}</span></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {[['Plan', `${sub.plan_days} days`], ['Per day', rupees(sub.per_day_paise)], ['Paid', rupees(sub.total_paise)], ['Skipped so far', String(sub.skipped_days)],
            ['Starts', fmtDate(sub.start_date)], ['Ends', fmtDate(sub.end_date)], ['Delivers on', sub.delivery_days.length === 7 ? 'Every day' : sub.delivery_days.map((d) => WEEKDAY_SHORT[d]).join(', ')], ['Paid through', fmtDate(sub.paid_through)]].map(([k, v]) => (
            <div key={k}><dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {sub.status === 'paused' && <p className="mt-3 rounded-lg bg-sky-100 p-2.5 text-sm text-sky-900">Paused {fmtDate(sub.paused_from)} to {fmtDate(sub.paused_to)}</p>}
        {sub.cancel_reason && <p className="mt-3 rounded-lg bg-rose-soft/60 p-2.5 text-sm text-rose">Cancelled: {sub.cancel_reason}</p>}
        <Panel title="Delivery address" className="mt-4"><p className="text-sm">{sub.address.recipient_name}<br /><span className="text-ink-soft">{[sub.address.line1, sub.address.line2, sub.address.landmark, sub.address.city, sub.address.pincode].filter(Boolean).join(', ')}</span></p></Panel>
        <Panel title="Skipped days" className="mt-4">
          {mine.length === 0 ? <p className="text-sm text-ink-soft">None scheduled.</p> : (
            <ul className="space-y-1">{mine.map((d) => (
              <li key={d} className="flex items-center justify-between text-sm">{fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}
                {live && d > todayISO() && <Button size="sm" variant="quiet" disabled={busy} onClick={() => void go(() => api.rpc('unskip_subscription_day', { p_sub: sub.id, p_date: d }), 'Skip removed')}>Undo</Button>}</li>
            ))}</ul>
          )}
          {live && (
            <div className="mt-3 flex items-end gap-2">
              <TextField label="Skip a day" type="date" min={todayISO(1)} value={skipDate} onChange={(e) => setSkipDate(e.target.value)} wrapperClassName="flex-1" hint="The plan extends by one delivery day." />
              <Button disabled={busy} onClick={() => void go(() => api.rpc('skip_subscription_day', { p_sub: sub.id, p_date: skipDate }), 'Day skipped')}>Skip</Button>
            </div>
          )}
        </Panel>
      </Drawer>
      <ConfirmDialog open={mode === 'cancel'} danger title="Cancel this subscription?" askReason reasonRequired confirmLabel="Cancel subscription" busy={busy} onCancel={() => setMode(null)}
        onConfirm={(r) => void go(() => api.rpc('cancel_subscription', { p_sub: sub.id, p_reason: r }), 'Subscription cancelled')}>The customer is notified. Refunds for unused days are handled separately from the order screen.</ConfirmDialog>
      <ConfirmDialog open={mode === 'pause'} title="Pause deliveries" confirmLabel="Pause" busy={busy} onCancel={() => setMode(null)} onConfirm={() => void go(() => api.rpc('pause_subscription', { p_sub: sub.id, p_from: from, p_to: to }), 'Subscription paused')}>
        <div className="grid grid-cols-2 gap-3"><TextField label="From" type="date" min={todayISO(1)} value={from} onChange={(e) => setFrom(e.target.value)} /><TextField label="To" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <p className="mt-2 text-xs">Paused days extend the plan end date. {addDays(from, 0) <= todayISO() ? 'Pausing from today or earlier will be refused after the cut-off.' : ''}</p>
      </ConfirmDialog>
    </>
  )
}
