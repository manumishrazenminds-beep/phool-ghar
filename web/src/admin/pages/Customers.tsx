import { useState } from 'react'
import { addressLine, fmtDate, humanize, rupees, telLink, waLink } from '../format'
import { useApi } from '../mode'
import { OrderDrawer } from '../OrderDrawer'
import { useDebounced, useQuery } from '../useQuery'
import type { Address, Order, Profile, Subscription } from '../types'
import { Drawer, EmptyState, PageHeader, Panel, SearchBox, Skeleton, StatusBadge, Table, Toolbar, ErrorBanner } from '../ui'

export default function Customers() {
  const api = useApi()
  const [search, setSearch] = useState('')
  const term = useDebounced(search)
  const [open, setOpen] = useState<Profile | null>(null)
  const q = useQuery(() => api.select<Profile>('profiles', { filters: [{ col: 'role', op: 'eq', val: 'customer' }], or: { cols: ['full_name', 'phone', 'email'], term }, order: [{ col: 'created_at', asc: false }], limit: 300 }), [term])
  return (
    <>
      <PageHeader eyebrow="Operate" title="Customers">Find a customer to see addresses, orders and subscriptions, or to help them with a delivery.</PageHeader>
      <Toolbar><SearchBox value={search} onChange={setSearch} placeholder="Name, phone or email" /></Toolbar>
      <Table caption="Customers" rows={q.data} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(p) => p.id} onRowClick={setOpen}
        empty={<EmptyState title="No customers found">Try a different name, phone or email.</EmptyState>}
        columns={[
          { key: 'n', header: 'Name', cell: (p) => <b className="font-medium">{p.full_name ?? 'Unnamed'}</b> },
          { key: 'p', header: 'Phone', cell: (p) => p.phone ?? '-' },
          { key: 'e', header: 'Email', hideOnSmall: true, cell: (p) => p.email ?? '-' },
          { key: 'j', header: 'Joined', hideOnSmall: true, cell: (p) => fmtDate(p.created_at) },
        ]} />
      <CustomerDrawer customer={open} onClose={() => setOpen(null)} />
    </>
  )
}

function CustomerDrawer({ customer, onClose }: { customer: Profile | null; onClose: () => void }) {
  const api = useApi()
  const id = customer?.id
  const [order, setOrder] = useState<Order | null>(null)
  const d = useQuery(async () => {
    if (!id) return null
    const [addresses, orders, subs] = await Promise.all([
      api.select<Address>('addresses', { filters: [{ col: 'user_id', op: 'eq', val: id }] }),
      api.select<Order>('orders', { filters: [{ col: 'user_id', op: 'eq', val: id }], order: [{ col: 'delivery_date', asc: false }], limit: 60 }),
      api.select<Subscription>('subscriptions', { filters: [{ col: 'user_id', op: 'eq', val: id }], order: [{ col: 'created_at', asc: false }] }),
    ])
    return { addresses, orders, subs }
  }, [id])
  if (!customer) return null
  const spent = (d.data?.orders ?? []).filter((o) => o.payment_status === 'paid' && o.status !== 'cancelled').reduce((s, o) => s + o.total_paise, 0)
  return (
    <>
      <Drawer open onClose={onClose} wide eyebrow="Customer" title={customer.full_name ?? 'Unnamed'}>
        <div className="flex flex-wrap gap-2">
          {customer.phone && <a className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm" href={telLink(customer.phone)}>Call {customer.phone}</a>}
          {customer.phone && <a className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm" href={waLink(customer.phone)} target="_blank" rel="noreferrer">WhatsApp</a>}
          {customer.email && <a className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm" href={`mailto:${customer.email}`}>{customer.email}</a>}
        </div>
        <p className="mt-3 text-sm text-ink-soft">Customer since {fmtDate(customer.created_at)}. Paid orders in the last 60: <b className="text-ink">{rupees(spent)}</b></p>
        {d.error && <div className="mt-3"><ErrorBanner message={d.error} onRetry={d.reload} /></div>}
        <div className="mt-4 space-y-4">
          <Panel title="Addresses">
            {d.loading && !d.data ? <Skeleton rows={2} /> : (d.data?.addresses ?? []).length === 0 ? <p className="text-sm text-ink-soft">No saved addresses.</p> : (
              <ul className="space-y-3">{d.data!.addresses.map((a) => (
                <li key={a.id} className="text-sm"><b>{a.label ?? 'Address'}</b>{a.is_default && <span className="ml-2 text-xs text-ink-soft">default</span>}<br />{a.recipient_name} / {a.recipient_phone}<br /><span className="text-ink-soft">{addressLine(a)}</span>{a.instructions && <><br /><i>{a.instructions}</i></>}</li>
              ))}</ul>
            )}
          </Panel>
          <Panel title="Subscriptions">
            {d.loading && !d.data ? <Skeleton rows={1} /> : (d.data?.subs ?? []).length === 0 ? <p className="text-sm text-ink-soft">No subscriptions.</p> : (
              <ul className="space-y-2">{d.data!.subs.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{s.plan_days}-day plan, {fmtDate(s.start_date, { day: 'numeric', month: 'short' })} to {fmtDate(s.end_date, { day: 'numeric', month: 'short' })}</span><StatusBadge status={s.status} /></li>
              ))}</ul>
            )}
          </Panel>
          <Panel title="Order history" pad={false}>
            {d.loading && !d.data ? <Skeleton rows={3} /> : (d.data?.orders ?? []).length === 0 ? <p className="p-4 text-sm text-ink-soft">No orders yet.</p> : (
              <ul className="divide-y divide-ink/5">{d.data!.orders.map((o) => (
                <li key={o.id}><button type="button" onClick={() => setOrder(o)} className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-cream-2/40">
                  <span><span className="font-mono text-xs">{o.order_no}</span> <span className="text-ink-soft">{fmtDate(o.delivery_date, { day: 'numeric', month: 'short' })} / {humanize(o.kind)}</span></span>
                  <span className="flex items-center gap-2"><StatusBadge status={o.status} />{o.kind === 'one_time' && rupees(o.total_paise)}</span>
                </button></li>
              ))}</ul>
            )}
          </Panel>
        </div>
      </Drawer>
      <OrderDrawer order={order} customerName={customer.full_name ?? undefined} onClose={() => setOrder(null)} onChanged={d.reload} />
    </>
  )
}
