import { DownloadSimple } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { downloadCsv, fmtDate, humanize, rupees, todayISO } from '../format'
import { useApi } from '../mode'
import { useQuery } from '../useQuery'
import type { Order, OrderItem, Payment, Subscription } from '../types'
import { Button, EmptyState, ErrorBanner, PageHeader, Panel, Skeleton, StatCard, Table, TextField, Toolbar } from '../ui'

const istDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso))

export default function Reports() {
  const api = useApi()
  const [from, setFrom] = useState(todayISO(-13))
  const [to, setTo] = useState(todayISO())
  const q = useQuery(async () => {
    const [orders, payments, subs] = await Promise.all([
      api.select<Order>('orders', { filters: [{ col: 'delivery_date', op: 'gte', val: from }, { col: 'delivery_date', op: 'lte', val: to }], limit: 5000 }),
      api.select<Payment>('payments', { filters: [{ col: 'created_at', op: 'gte', val: from + 'T00:00:00+05:30' }, { col: 'created_at', op: 'lte', val: to + 'T23:59:59+05:30' }, { col: 'status', op: 'in', val: ['captured', 'refunded'] }], limit: 5000 }),
      api.select<Subscription>('subscriptions', { limit: 5000 }),
    ])
    const items: OrderItem[] = []
    const ids = orders.filter((o) => o.status !== 'cancelled' && o.kind === 'one_time').map((o) => o.id)
    for (let i = 0; i < ids.length; i += 100) items.push(...await api.select<OrderItem>('order_items', { filters: [{ col: 'order_id', op: 'in', val: ids.slice(i, i + 100) }], limit: 5000 }))
    return { orders, payments, subs, items }
  }, [from, to])

  const r = useMemo(() => {
    if (!q.data) return null
    const { orders, payments, subs, items } = q.data
    const days = new Map<string, { date: string; orders: number; collected: number; refunded: number }>()
    const day = (d: string) => { if (!days.has(d)) days.set(d, { date: d, orders: 0, collected: 0, refunded: 0 }); return days.get(d)! }
    for (const o of orders) if (o.status !== 'cancelled') day(o.delivery_date).orders++
    for (const p of payments) { const x = day(istDate(p.created_at)); if (p.status === 'captured') x.collected += p.amount_paise; else x.refunded += p.amount_paise }
    const byStatus = new Map<string, number>()
    for (const o of orders) byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1)
    const top = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const i of items) { const t = top.get(i.product_id) ?? { name: i.name_snapshot, qty: 0, revenue: 0 }; t.qty += i.qty; t.revenue += i.line_total_paise; top.set(i.product_id, t) }
    const subCount = new Map<string, number>()
    for (const s of subs) subCount.set(s.status, (subCount.get(s.status) ?? 0) + 1)
    const daily = [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
    return {
      daily, byStatus: [...byStatus.entries()].sort((a, b) => b[1] - a[1]), top: [...top.values()].sort((a, b) => b.revenue - a.revenue || b.qty - a.qty).slice(0, 10),
      subCount: [...subCount.entries()], collected: daily.reduce((s, d) => s + d.collected, 0), refunded: daily.reduce((s, d) => s + d.refunded, 0), orders: daily.reduce((s, d) => s + d.orders, 0),
    }
  }, [q.data])
  const maxDay = Math.max(1, ...(r?.daily.map((d) => d.collected) ?? [1]))
  const maxStatus = Math.max(1, ...(r?.byStatus.map((s) => s[1]) ?? [1]))

  return (
    <>
      <PageHeader eyebrow="Store" title="Reports">Money is counted when the payment is captured, so a 30-day subscription counts on the day it was bought. Orders are counted on their delivery date.</PageHeader>
      <Toolbar>
        <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button onClick={() => { setFrom(todayISO(-6)); setTo(todayISO()) }}>Last 7 days</Button>
        <Button onClick={() => { setFrom(todayISO(-29)); setTo(todayISO()) }}>Last 30 days</Button>
      </Toolbar>
      {q.error && <ErrorBanner message={q.error} onRetry={q.reload} />}
      {q.loading && !r && <Skeleton rows={6} />}
      {r && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Collected" value={rupees(r.collected)} /><StatCard label="Refunded" value={rupees(r.refunded)} tone={r.refunded ? 'alert' : 'default'} />
            <StatCard label="Net" value={rupees(r.collected - r.refunded)} tone="good" /><StatCard label="Deliveries" value={r.orders} hint="Excludes cancelled" />
          </div>
          <Panel title="Daily sales" pad={false} actions={<Button size="sm" icon={<DownloadSimple size={14} />} onClick={() => downloadCsv(`daily-sales-${from}-${to}.csv`, r.daily.map((d) => ({ date: d.date, deliveries: d.orders, collected_rupees: d.collected / 100, refunded_rupees: d.refunded / 100 })))}>CSV</Button>}>
            {r.daily.length === 0 ? <EmptyState title="No sales in this range" /> : (
              <Table caption="Daily sales" rows={r.daily} rowKey={(d) => d.date} dense columns={[
                { key: 'd', header: 'Date', cell: (d) => fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }) },
                { key: 'b', header: '', hideOnSmall: true, className: 'w-1/3', cell: (d) => <div className="h-2 rounded-full bg-ink/5"><div className="h-full rounded-full bg-leaf" style={{ width: `${(d.collected / maxDay) * 100}%` }} /></div> },
                { key: 'o', header: 'Deliveries', align: 'right', cell: (d) => d.orders }, { key: 'c', header: 'Collected', align: 'right', cell: (d) => rupees(d.collected) }, { key: 'r', header: 'Refunded', align: 'right', cell: (d) => d.refunded ? rupees(d.refunded) : '-' },
              ]} />
            )}
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Orders by status" actions={<Button size="sm" icon={<DownloadSimple size={14} />} onClick={() => downloadCsv(`orders-by-status-${from}-${to}.csv`, r.byStatus.map(([status, count]) => ({ status, count })))}>CSV</Button>}>
              <ul className="space-y-2.5">{r.byStatus.map(([s, n]) => (<li key={s}><div className="flex justify-between text-sm"><span>{humanize(s)}</span><b>{n}</b></div><div className="mt-1 h-2 rounded-full bg-ink/5"><div className={`h-full rounded-full ${s === 'failed' || s === 'cancelled' ? 'bg-rose' : 'bg-marigold'}`} style={{ width: `${(n / maxStatus) * 100}%` }} /></div></li>))}</ul>
              {r.byStatus.length === 0 && <p className="text-sm text-ink-soft">No orders in range.</p>}
            </Panel>
            <Panel title="Subscriptions now" actions={<Button size="sm" icon={<DownloadSimple size={14} />} onClick={() => downloadCsv('subscriptions-by-status.csv', r.subCount.map(([status, count]) => ({ status, count })))}>CSV</Button>}>
              <ul className="divide-y divide-ink/5">{r.subCount.map(([s, n]) => <li key={s} className="flex justify-between py-2 text-sm"><span>{humanize(s)}</span><b>{n}</b></li>)}</ul>
              {r.subCount.length === 0 && <p className="text-sm text-ink-soft">No subscriptions yet.</p>}
            </Panel>
          </div>
          <Panel title="Top products (one-time sales)" pad={false} actions={<Button size="sm" icon={<DownloadSimple size={14} />} onClick={() => downloadCsv(`top-products-${from}-${to}.csv`, r.top.map((t) => ({ product: t.name, units: t.qty, revenue_rupees: t.revenue / 100 })))}>CSV</Button>}>
            {r.top.length === 0 ? <EmptyState title="No product sales in this range" /> : (
              <Table caption="Top products" rows={r.top} rowKey={(t) => t.name} dense columns={[
                { key: 'n', header: 'Product', cell: (t) => t.name }, { key: 'q', header: 'Units', align: 'right', cell: (t) => t.qty }, { key: 'r', header: 'Revenue', align: 'right', cell: (t) => rupees(t.revenue) },
              ]} />
            )}
          </Panel>
        </div>
      )}
    </>
  )
}
