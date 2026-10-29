import { DownloadSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { downloadCsv, fmtDate, humanize, rupees, todayISO } from '../format'
import { useCustomerMap, useSlots } from '../lookups'
import { useApi } from '../mode'
import { OrderDrawer } from '../OrderDrawer'
import { useDebounced, useQuery } from '../useQuery'
import type { Filter } from '../api'
import type { Order } from '../types'
import { Button, PageHeader, SearchBox, SelectField, StatusBadge, Table, TextField, Toolbar } from '../ui'

export default function Orders() {
  const api = useApi()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [pay, setPay] = useState('')
  const [kind, setKind] = useState('')
  const [slot, setSlot] = useState('')
  const [from, setFrom] = useState(todayISO(-7))
  const [to, setTo] = useState(todayISO(2))
  const [open, setOpen] = useState<Order | null>(null)
  const term = useDebounced(search)
  const { label, slots } = useSlots()
  const cust = useCustomerMap()

  const q = useQuery(() => {
    const filters: Filter[] = []
    if (status) filters.push({ col: 'status', op: 'eq', val: status })
    if (pay) filters.push({ col: 'payment_status', op: 'eq', val: pay })
    if (kind) filters.push({ col: 'kind', op: 'eq', val: kind })
    if (slot) filters.push({ col: 'slot_id', op: 'eq', val: slot })
    if (from) filters.push({ col: 'delivery_date', op: 'gte', val: from })
    if (to) filters.push({ col: 'delivery_date', op: 'lte', val: to })
    return api.select<Order>('orders', { filters, order: [{ col: 'delivery_date', asc: false }, { col: 'created_at', asc: false }], limit: 500 })
  }, [status, pay, kind, slot, from, to])

  const t = term.trim().toLowerCase()
  const rows = (q.data ?? []).filter((o) => !t || o.order_no.toLowerCase().includes(t) || (o.address.recipient_name ?? '').toLowerCase().includes(t) || (o.address.recipient_phone ?? '').includes(t) || cust.name(o.user_id).toLowerCase().includes(t))

  return (
    <>
      <PageHeader eyebrow="Operate" title="Orders" actions={
        <Button icon={<DownloadSimple size={16} />} disabled={!rows.length} onClick={() => downloadCsv(`orders-${from}-to-${to}.csv`, rows.map((o) => ({ order_no: o.order_no, delivery_date: o.delivery_date, slot: label(o.slot_id), type: o.kind, status: o.status, payment: o.payment_status, customer: cust.name(o.user_id), recipient: o.address.recipient_name, phone: o.address.recipient_phone, total_rupees: o.total_paise / 100 })))}>CSV</Button>}>
        Search by order number, customer or phone. Click a row for the full record.
      </PageHeader>
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="PG-26-001012, name or phone" />
        <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any</option>{['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'failed'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</SelectField>
        <SelectField label="Payment" value={pay} onChange={(e) => setPay(e.target.value)}><option value="">Any</option>{['pending', 'paid', 'failed', 'refunded', 'partially_refunded'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</SelectField>
        <SelectField label="Type" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Any</option><option value="one_time">One-time</option><option value="subscription_delivery">Subscription</option></SelectField>
        <SelectField label="Slot" value={slot} onChange={(e) => setSlot(e.target.value)}><option value="">Any</option>{slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</SelectField>
      </Toolbar>
      <Table caption="Orders" rows={q.data ? rows : undefined} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(o) => o.id} onRowClick={setOpen}
        columns={[
          { key: 'no', header: 'Order', cell: (o) => <span className="font-mono text-xs">{o.order_no}</span> },
          { key: 'date', header: 'Delivery', cell: (o) => <span>{fmtDate(o.delivery_date, { day: 'numeric', month: 'short' })}<span className="block text-xs text-ink-soft">{label(o.slot_id)}</span></span> },
          { key: 'cust', header: 'Customer', cell: (o) => <span>{cust.name(o.user_id)}<span className="block text-xs text-ink-soft">to {o.address.recipient_name}</span></span> },
          { key: 'type', header: 'Type', hideOnSmall: true, cell: (o) => <StatusBadge status={o.kind} /> },
          { key: 'status', header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
          { key: 'pay', header: 'Payment', hideOnSmall: true, cell: (o) => <StatusBadge status={o.payment_status} /> },
          { key: 'total', header: 'Total', align: 'right', cell: (o) => o.kind === 'subscription_delivery' ? <span className="text-ink-soft">Prepaid</span> : rupees(o.total_paise) },
        ]} />
      <OrderDrawer order={open} customerName={open ? cust.name(open.user_id) : undefined} onClose={() => setOpen(null)} onChanged={() => { q.reload() }} />
    </>
  )
}
