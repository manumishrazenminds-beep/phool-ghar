import { CalendarCheck, Repeat, Truck, CurrencyInr, CreditCard, WarningOctagon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtDate, humanize, rupees, todayISO } from '../format'
import { useSlots } from '../lookups'
import { useApi } from '../mode'
import { OrderDrawer } from '../OrderDrawer'
import { useQuery } from '../useQuery'
import type { DashboardData, Order, Payment } from '../types'
import { EmptyState, ErrorBanner, PageHeader, Panel, Skeleton, StatCard, StatusBadge } from '../ui'

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : Array.isArray(v) ? v.length : 0)

/** admin_dashboard returns jsonb whose exact keys are owned by the database builder, so read it defensively. */
function normalise(raw: unknown): DashboardData {
  const r = (raw ?? {}) as Record<string, unknown>
  const pick = (...keys: string[]) => { for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k]; return 0 }
  let slots: { slot_id: string; count: number }[] = []
  const ds = r.deliveries_by_slot ?? r.deliveries_due_by_slot ?? r.slots
  if (Array.isArray(ds)) slots = ds.map((x) => ({ slot_id: String((x as Record<string, unknown>).slot_id ?? (x as Record<string, unknown>).slot ?? ''), count: num((x as Record<string, unknown>).count ?? (x as Record<string, unknown>).n) }))
  else if (ds && typeof ds === 'object') slots = Object.entries(ds).map(([slot_id, v]) => ({ slot_id, count: num(v) }))
  return {
    orders_today: num(pick('orders_today', 'today_orders')), orders_tomorrow: num(pick('orders_tomorrow', 'tomorrow_orders')),
    revenue_paise: num(pick('revenue_paise', 'revenue')), active_subscriptions: num(pick('active_subscriptions', 'active_subs')),
    paused_subscriptions: num(pick('paused_subscriptions', 'paused_subs')), deliveries_by_slot: slots,
  }
}

export default function Dashboard() {
  const api = useApi()
  const today = todayISO()
  const { slots, label } = useSlots()
  const dash = useQuery(async () => normalise(await api.rpc('admin_dashboard', { p_from: todayISO(-6), p_to: today })), [])
  const failedPay = useQuery(() => api.select<Payment>('payments', { filters: [{ col: 'status', op: 'eq', val: 'failed' }, { col: 'created_at', op: 'gte', val: todayISO(-5) }], order: [{ col: 'created_at', asc: false }], limit: 8 }), [])
  const failedDel = useQuery(() => api.select<Order>('orders', { filters: [{ col: 'status', op: 'eq', val: 'failed' }, { col: 'delivery_date', op: 'gte', val: todayISO(-5) }], order: [{ col: 'delivery_date', asc: false }], limit: 8 }), [])
  const unassigned = useQuery(() => api.select<Order>('orders', { filters: [{ col: 'delivery_date', op: 'eq', val: today }, { col: 'assigned_to', op: 'is', val: null }, { col: 'status', op: 'in', val: ['placed', 'confirmed', 'preparing'] }] }), [])
  const [open, setOpen] = useState<Order | null>(null)
  const d = dash.data
  const slotTotal = d?.deliveries_by_slot.reduce((s, x) => s + x.count, 0) ?? 0
  const failedCount = (failedPay.data?.length ?? 0) + (failedDel.data?.length ?? 0)

  return (
    <>
      <PageHeader eyebrow={fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })} title="Today at Phool Ghar">What is due, what is stuck, and what needs a person.</PageHeader>
      {dash.error && <ErrorBanner message={dash.error} onRetry={dash.reload} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Orders today" value={dash.loading && !d ? '...' : d?.orders_today ?? 0} hint={`${d?.orders_tomorrow ?? 0} due tomorrow`} icon={<CalendarCheck size={18} />} to="/admin/today" />
        <StatCard label="Revenue, 7 days" value={dash.loading && !d ? '...' : rupees(d?.revenue_paise)} hint="Paid, not cancelled" icon={<CurrencyInr size={18} />} to="/admin/reports" />
        <StatCard label="Active subscriptions" value={dash.loading && !d ? '...' : d?.active_subscriptions ?? 0} hint={`${d?.paused_subscriptions ?? 0} paused`} icon={<Repeat size={18} />} to="/admin/subscriptions" />
        <StatCard label="Needs action" value={failedCount} tone={failedCount ? 'alert' : 'good'} hint={failedCount ? 'Failed payments or deliveries' : 'Nothing is stuck'} icon={<WarningOctagon size={18} />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Deliveries due today, by slot" actions={<Link to="/admin/today" className="text-xs text-marigold-deep underline-offset-2 hover:underline">Open list</Link>}>
          {dash.loading && !d ? <Skeleton rows={3} /> : slotTotal === 0 ? <EmptyState title="No deliveries today">Orders placed for today will show here.</EmptyState> : (
            <ul className="space-y-3">
              {(slots.length ? slots.map((s) => s.id) : d!.deliveries_by_slot.map((x) => x.slot_id)).map((sid) => {
                const n = d!.deliveries_by_slot.find((x) => x.slot_id === sid)?.count ?? 0
                return (
                  <li key={sid}>
                    <div className="flex justify-between text-sm"><span>{label(sid)}</span><span className="font-medium">{n}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/5"><div className="h-full rounded-full bg-marigold" style={{ width: `${slotTotal ? (n / slotTotal) * 100 : 0}%` }} /></div>
                  </li>
                )
              })}
            </ul>
          )}
          {(unassigned.data?.length ?? 0) > 0 && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-saffron/25 p-2.5 text-sm"><Truck size={18} />{unassigned.data!.length} order{unassigned.data!.length > 1 ? 's' : ''} today still have no delivery person. <Link to="/admin/today" className="font-medium underline">Assign</Link></p>
          )}
        </Panel>

        <Panel title="Failed deliveries" pad={false}>
          {failedDel.error && <div className="p-4"><ErrorBanner message={failedDel.error} onRetry={failedDel.reload} /></div>}
          {failedDel.loading && !failedDel.data ? <Skeleton rows={2} /> : (failedDel.data ?? []).length === 0 ? <EmptyState title="No failed deliveries">Last five days are clean.</EmptyState> : (
            <ul className="divide-y divide-ink/5">
              {failedDel.data!.map((o) => (
                <li key={o.id}><button type="button" onClick={() => setOpen(o)} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-cream-2/40">
                  <span className="min-w-0"><span className="block text-sm font-medium">{o.order_no} / {o.address.recipient_name}</span><span className="block truncate text-xs text-rose">{o.failure_reason ?? 'No reason recorded'}</span></span>
                  <span className="shrink-0 text-xs text-ink-soft">{fmtDate(o.delivery_date, { day: 'numeric', month: 'short' })}</span>
                </button></li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Failed payments" pad={false} className="lg:col-span-2">
          {failedPay.error && <div className="p-4"><ErrorBanner message={failedPay.error} onRetry={failedPay.reload} /></div>}
          {failedPay.loading && !failedPay.data ? <Skeleton rows={2} /> : (failedPay.data ?? []).length === 0 ? <EmptyState title="No failed payments" icon={<CreditCard size={28} />}>Declined or abandoned payments from the last five days appear here.</EmptyState> : (
            <ul className="divide-y divide-ink/5">
              {failedPay.data!.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span><StatusBadge status="failed" /> <span className="ml-1">{rupees(p.amount_paise)}</span> <span className="text-ink-soft">{p.method ? humanize(p.method) : ''}</span></span>
                  <span className="text-xs text-ink-soft">{p.error_desc ?? p.error_code ?? 'Unknown error'}</span>
                  <span className="text-xs text-ink-soft">{fmtDate(p.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <OrderDrawer order={open} onClose={() => setOpen(null)} onChanged={() => { failedDel.reload(); dash.reload() }} />
    </>
  )
}
