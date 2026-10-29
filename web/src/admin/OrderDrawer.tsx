import { Receipt } from '@phosphor-icons/react'
import { useState } from 'react'
import { addressLine, fmtDate, fmtDateTime, humanize, mapsLink, rupees, telLink, waLink } from './format'
import { useDeliveryStaff } from './lookups'
import { useApi } from './mode'
import { useQuery } from './useQuery'
import { Button, ConfirmDialog, Drawer, ErrorBanner, Panel, SelectField, Skeleton, StatusBadge, TextField, useToast } from './ui'
import type { Order, OrderEvent, OrderItem, OrderStatus, Payment, Profile, Refund } from './types'

const FLOW: OrderStatus[] = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered']
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { placed: 'confirmed', confirmed: 'preparing', preparing: 'out_for_delivery', out_for_delivery: 'delivered' }

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-1 text-sm"><dt className="text-ink-soft">{k}</dt><dd className="text-right">{children}</dd></div>
}

/** Full order detail: items, address, payments, timeline, status changes, cancel and refund. */
export function OrderDrawer({ order, customerName, onClose, onChanged }: { order: Order | null; customerName?: string; onClose: () => void; onChanged: () => void }) {
  const api = useApi()
  const { run } = useToast()
  const { staff } = useDeliveryStaff()
  const id = order?.id
  const detail = useQuery(async () => {
    if (!id) return null
    const [items, events, payments, refunds] = await Promise.all([
      api.select<OrderItem>('order_items', { filters: [{ col: 'order_id', op: 'eq', val: id }] }),
      api.select<OrderEvent>('order_events', { filters: [{ col: 'order_id', op: 'eq', val: id }], order: [{ col: 'created_at' }] }),
      api.select<Payment>('payments', { filters: [{ col: 'order_id', op: 'eq', val: id }] }),
      api.select<Refund>('refunds', { filters: [{ col: 'order_id', op: 'eq', val: id }] }),
    ])
    return { items, events, payments, refunds }
  }, [id])
  const actors = useQuery(() => api.select<Profile>('profiles', { filters: [{ col: 'role', op: 'in', val: ['admin', 'staff', 'delivery'] }] }), [])
  const [cancelOpen, setCancelOpen] = useState(false)
  const [failOpen, setFailOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmt, setRefundAmt] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [status, setStatus] = useState<OrderStatus | ''>('')

  if (!order) return null
  const o = order
  const actorName = (aid: string | null) => (aid ? actors.data?.find((a) => a.id === aid)?.full_name ?? (aid === o.user_id ? 'Customer' : 'Staff') : 'System')
  const d = detail.data
  const payment = d?.payments.find((p) => p.status === 'captured' || p.status === 'refunded') ?? d?.payments[0]
  const refunded = (d?.refunds ?? []).filter((r) => r.status !== 'failed').reduce((s, r) => s + r.amount_paise, 0)
  const refundable = Math.max(0, (payment?.amount_paise ?? o.total_paise) - refunded)
  const done = o.status === 'delivered' || o.status === 'cancelled'
  const next = NEXT[o.status]

  const act = async (fn: () => Promise<unknown>, ok: string, closeAfter = false) => {
    setBusy(true); setErr(null)
    const r = await run(async () => { await fn(); return true }, ok)
    setBusy(false)
    if (r) { onChanged(); detail.reload(); setCancelOpen(false); setFailOpen(false); setRefundOpen(false); if (closeAfter) onClose() }
    else setErr('The action failed; see the message shown.')
  }
  const setSt = (s: OrderStatus, note: string | null = null) => act(() => api.rpc('set_order_status', { p_order: o.id, p_status: s, p_note: note }), `Marked ${humanize(s).toLowerCase()}`)

  const openInvoice = () => run(async () => {
    const html = await api.invoice(o.id)
    const w = window.open('', '_blank')
    if (!w) throw new Error('The browser blocked the invoice window. Allow pop-ups for this site.')
    w.document.write(html); w.document.close()
  })

  return (
    <>
      <Drawer open onClose={onClose} wide eyebrow={`${fmtDate(o.delivery_date)} / ${o.kind === 'one_time' ? 'One-time' : 'Subscription delivery'}`} title={o.order_no}
        footer={
          <>
            <Button size="sm" onClick={openInvoice} icon={<Receipt size={16} />}>Invoice</Button>
            {!done && o.status !== 'failed' && <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>Cancel order</Button>}
            {o.kind === 'one_time' && o.payment_status !== 'refunded' && refundable > 0 && o.payment_status !== 'pending' && o.payment_status !== 'failed' && (
              <Button size="sm" variant="danger" onClick={() => { setRefundAmt(String(refundable / 100)); setRefundOpen(true) }}>Refund</Button>
            )}
            {!done && o.status !== 'failed' && o.status === 'out_for_delivery' && <Button size="sm" onClick={() => setFailOpen(true)}>Mark failed</Button>}
            {next && o.status !== 'failed' && <Button size="sm" variant="primary" disabled={busy} onClick={() => void setSt(next)}>Mark {humanize(next).toLowerCase()}</Button>}
          </>
        }>
        {err && <ErrorBanner message={err} />}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={o.status} /><StatusBadge status={o.payment_status} label={`Payment ${humanize(o.payment_status).toLowerCase()}`} />
          {o.coupon_code && <StatusBadge status="coupon" label={`Coupon ${o.coupon_code}`} />}
        </div>
        {o.failure_reason && <p className="mt-3 rounded-lg bg-rose-soft/60 p-2.5 text-sm text-rose">Failure reason: {o.failure_reason}</p>}

        <div className="mt-4 space-y-4">
          <Panel title="Delivery">
            <p className="font-medium">{o.address.recipient_name}</p>
            <p className="text-sm text-ink-soft">{addressLine(o.address)}</p>
            {o.address.instructions && <p className="mt-1 text-sm italic">Note: {o.address.instructions}</p>}
            {o.gift_note && <p className="mt-1 text-sm">Gift message: "{o.gift_note}"</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {o.address.recipient_phone && <a className="rounded-lg border border-ink/15 px-3 py-2 text-sm hover:bg-cream-2/50" href={telLink(o.address.recipient_phone)}>Call</a>}
              {o.address.recipient_phone && <a className="rounded-lg border border-ink/15 px-3 py-2 text-sm hover:bg-cream-2/50" href={waLink(o.address.recipient_phone, `Hello from Phool Ghar, about order ${o.order_no}.`)} target="_blank" rel="noreferrer">WhatsApp</a>}
              <a className="rounded-lg border border-ink/15 px-3 py-2 text-sm hover:bg-cream-2/50" href={mapsLink(o.address)} target="_blank" rel="noreferrer">Map</a>
            </div>
            <dl className="mt-3 border-t border-ink/10 pt-2">
              <Row k="Customer">{customerName ?? '-'}</Row>
              <Row k="Assigned to">
                <select aria-label="Assign delivery staff" className="min-h-9 rounded-lg border border-ink/15 bg-white px-2 text-sm pointer-coarse:min-h-11" value={o.assigned_to ?? ''} disabled={done}
                  onChange={(e) => void act(() => api.rpc('assign_order', { p_order: o.id, p_staff: e.target.value || null }), 'Assignment saved')}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </Row>
            </dl>
          </Panel>

          <Panel title="Items" pad={false}>
            {detail.loading && !d ? <Skeleton rows={2} /> : (
              <ul className="divide-y divide-ink/5">
                {(d?.items ?? []).map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                    <span>{i.qty} x {i.name_snapshot} <span className="text-ink-soft">({i.variant_key})</span></span>
                    <span>{o.kind === 'subscription_delivery' ? 'Prepaid' : rupees(i.line_total_paise)}</span>
                  </li>
                ))}
              </ul>
            )}
            {o.kind === 'one_time' && <dl className="border-t border-ink/10 px-4 py-2">
              <Row k="Subtotal">{rupees(o.subtotal_paise)}</Row>
              {o.discount_paise > 0 && <Row k="Discount">-{rupees(o.discount_paise)}</Row>}
              <Row k="Delivery">{rupees(o.delivery_fee_paise)}</Row>
              <Row k="GST included">{rupees(o.tax_paise)}</Row>
              <Row k="Total"><b>{rupees(o.total_paise)}</b></Row>
            </dl>}
          </Panel>

          <Panel title="Payment">
            {detail.loading && !d ? <Skeleton rows={1} /> : (d?.payments.length ?? 0) === 0 ? <p className="text-sm text-ink-soft">{o.kind === 'subscription_delivery' ? 'Paid up front with the subscription.' : 'No payment attempt recorded.'}</p> : (
              <ul className="space-y-2 text-sm">
                {d!.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span><StatusBadge status={p.status} /> <span className="ml-1 text-ink-soft">{p.method ?? ''} {p.provider_payment_id ?? p.provider_order_id}</span></span>
                    <span>{rupees(p.amount_paise)}</span>
                    {p.error_desc && <span className="w-full text-xs text-rose">{p.error_desc}</span>}
                  </li>
                ))}
                {(d?.refunds ?? []).map((r) => <li key={r.id} className="flex justify-between text-ink-soft"><span><StatusBadge status={r.status} label={`Refund ${r.status}`} /> {r.reason}</span><span>-{rupees(r.amount_paise)}</span></li>)}
              </ul>
            )}
          </Panel>

          <Panel title="Timeline">
            <div className="mb-3 flex items-center gap-2">
              <SelectField label="Set status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} wrapperClassName="flex-1">
                <option value="">Choose...</option>
                {[...FLOW, 'cancelled', 'failed'].filter((s) => s !== o.status).map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </SelectField>
              <Button className="mt-5" disabled={!status || busy} onClick={() => { if (status === 'failed') setFailOpen(true); else if (status === 'cancelled') setCancelOpen(true); else if (status) void setSt(status).then(() => setStatus('')) }}>Apply</Button>
            </div>
            {detail.loading && !d ? <Skeleton rows={3} /> : (
              <ol className="relative ml-2 border-l border-ink/15 pl-4">
                {(d?.events ?? []).map((e) => (
                  <li key={e.id} className="relative pb-3 last:pb-0">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-marigold" aria-hidden />
                    <p className="text-sm font-medium">{humanize(e.status)}</p>
                    <p className="text-xs text-ink-soft">{fmtDateTime(e.created_at)} by {actorName(e.actor_id)}{e.note ? ` / ${e.note}` : ''}</p>
                  </li>
                ))}
                {d && d.events.length === 0 && <li className="text-sm text-ink-soft">No events yet.</li>}
              </ol>
            )}
          </Panel>
        </div>
      </Drawer>

      <ConfirmDialog open={cancelOpen} danger title={`Cancel ${o.order_no}?`} askReason reasonRequired confirmLabel="Cancel order" busy={busy}
        onCancel={() => setCancelOpen(false)} onConfirm={(reason) => void act(() => api.rpc('cancel_order', { p_order: o.id, p_reason: reason }), 'Order cancelled')}>
        The customer is notified. Cancelling does not move money by itself: use Refund afterwards if the order was paid.
      </ConfirmDialog>
      <ConfirmDialog open={failOpen} danger title="Mark delivery as failed" askReason reasonRequired reasonLabel="What went wrong" confirmLabel="Mark failed" busy={busy}
        onCancel={() => setFailOpen(false)} onConfirm={(reason) => void setSt('failed', reason)}>The customer is notified and the order shows in Needs attention on the dashboard.</ConfirmDialog>
      <RefundDialog open={refundOpen} amount={refundAmt} setAmount={setRefundAmt} max={refundable} busy={busy} onCancel={() => setRefundOpen(false)}
        onConfirm={(reason) => {
          const paise = Math.round(Number(refundAmt) * 100)
          if (!payment) { setErr('There is no captured payment to refund.'); return }
          void act(() => api.fn('refund-create', { payment_id: payment.id, amount_paise: paise, reason: reason || 'Refund requested by staff', idempotency_key: crypto.randomUUID() }), 'Refund requested')
        }} />
    </>
  )
}

function RefundDialog({ open, amount, setAmount, max, busy, onCancel, onConfirm }: { open: boolean; amount: string; setAmount: (v: string) => void; max: number; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const n = Number(amount)
  const bad = !(n > 0) || Math.round(n * 100) > max
  return (
    <ConfirmDialog open={open} title="Refund to customer" askReason reasonLabel="Reason" confirmLabel="Send refund" danger busy={busy || bad} onCancel={onCancel} onConfirm={onConfirm}>
      <div className="mb-1">
        <TextField label={`Amount in rupees (up to ${rupees(max)})`} type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} error={bad && amount ? 'Enter an amount within the refundable balance.' : undefined} />
        <p className="mt-2 text-xs">This calls Razorpay through the refund function. It cannot be undone.</p>
      </div>
    </ConfirmDialog>
  )
}
