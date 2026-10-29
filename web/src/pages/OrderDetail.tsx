import { ArrowLeft, Check, FileText } from '@phosphor-icons/react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AddressLine } from '../account/Addresses'
import { ORDER_STEPS, StatusPill } from '../account/status'
import { RequireAuth } from '../auth/RequireAuth'
import { cancelOrder, friendlyError, getOrder, openInvoice, requestRedelivery, type OrderEvent, type OrderItem, type OrderRow } from '../lib/api'
import { useCatalog } from '../lib/catalog'
import { addDays, fmtDate, fmtDateTime, todayIST } from '../lib/dates'
import { inrP } from '../lib/pricing'
import { Alert, Button, EmptyState, ErrorState, Field, LinkButton, Modal, PageShell, Select, SkeletonList, TextArea } from '../lib/ui'

type Data = { order: OrderRow; items: OrderItem[]; events: OrderEvent[] }

function Timeline({ order, events }: { order: OrderRow; events: OrderEvent[] }) {
  const byStatus = new Map(events.map((e) => [e.status, e]))
  const dead = order.status === 'cancelled' || order.status === 'failed'
  const reached = ORDER_STEPS.findIndex((s) => s.key === order.status)
  return (
    <ol className="relative space-y-6 border-l border-ink/15 pl-7">
      {ORDER_STEPS.map((s, i) => {
        const ev = byStatus.get(s.key)
        const done = !!ev || (!dead && i <= reached)
        return (
          <li key={s.key} className="relative">
            <span className={`absolute -left-[2.35rem] grid h-6 w-6 place-items-center rounded-full border ${done ? 'border-leaf bg-leaf text-cream' : 'border-ink/20 bg-cream'}`} aria-hidden>{done && <Check size={12} weight="bold" />}</span>
            <p className={done ? 'font-medium' : 'text-ink-soft'}>{s.label}<span className="sr-only">{done ? ', done' : ', pending'}</span></p>
            {ev && <p className="mt-0.5 text-xs text-ink-soft">{fmtDateTime(ev.created_at)}{ev.note ? `. ${ev.note}` : ''}</p>}
          </li>
        )
      })}
      {dead && (
        <li className="relative">
          <span className="absolute -left-[2.35rem] h-6 w-6 rounded-full border border-rose bg-rose" aria-hidden />
          <p className="font-medium text-rose">{order.status === 'cancelled' ? 'Cancelled' : 'Could not be delivered'}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{byStatus.get(order.status)?.note ?? order.failure_reason ?? ''}</p>
        </li>
      )}
    </ol>
  )
}

function Detail() {
  const { id = '' } = useParams()
  const [data, setData] = useState<Data | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [invErr, setInvErr] = useState<string | null>(null)
  const [invBusy, setInvBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const { catalog } = useCatalog()
  const [redeliver, setRedeliver] = useState(false)
  const [rDate, setRDate] = useState('')
  const [rSlot, setRSlot] = useState('')
  const [rNote, setRNote] = useState('')
  const [rBusy, setRBusy] = useState(false)
  const [rErr, setRErr] = useState<string | null>(null)
  const [rDone, setRDone] = useState(false)
  const [reason, setReason] = useState('')
  const [cBusy, setCBusy] = useState(false)
  const [cErr, setCErr] = useState<string | null>(null)

  const load = useCallback(() => { setError(null); getOrder(id).then(setData).catch((e) => setError(friendlyError(e))) }, [id])
  useEffect(load, [load])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (data === undefined) return <SkeletonList rows={3} />
  if (data === null) return <EmptyState title="We could not find that order" action={<LinkButton to="/account/orders">Back to orders</LinkButton>} />
  const { order, items, events } = data
  const failed = order.status === 'failed'
  const cancellable = ['placed', 'confirmed'].includes(order.status) && order.kind === 'one_time'

  async function doRedeliver() {
    if (rBusy) return
    setRBusy(true); setRErr(null)
    try { await requestRedelivery(order.id, rDate, rSlot, rNote); setRedeliver(false); setRDone(true) } catch (e) { setRErr(friendlyError(e)) } finally { setRBusy(false) }
  }
  async function doCancel() {
    if (cBusy) return
    setCBusy(true); setCErr(null)
    try { await cancelOrder(order.id, reason.trim() || 'Cancelled by customer'); setCancelling(false); load() } catch (e) { setCErr(friendlyError(e)) } finally { setCBusy(false) }
  }
  async function invoice() {
    if (invBusy) return
    setInvBusy(true); setInvErr(null)
    try { await openInvoice(order.id) } catch (e) { setInvErr(friendlyError(e)) } finally { setInvBusy(false) }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <div>
        <div className="flex flex-wrap items-center gap-3"><StatusPill status={order.status} /><StatusPill status={order.payment_status} /></div>
        <p className="mt-3 text-ink-soft">Delivery on {fmtDate(order.delivery_date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h2 className="font-display mt-10 text-3xl">Progress</h2>
        <div className="mt-6"><Timeline order={order} events={events} /></div>
        {order.failure_reason && order.status !== 'cancelled' && <div className="mt-6"><Alert tone="warn" title="A note on this order">{order.failure_reason}</Alert></div>}
      </div>
      <aside className="space-y-6 lg:border-l lg:border-ink/10 lg:pl-8">
        <div>
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Items</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.name_snapshot}{i.variant_key ? ` (${i.variant_key})` : ''} x {i.qty}</span><span>{inrP(i.line_total_paise)}</span></li>)}
          </ul>
          {order.kind === 'one_time' ? (
            <dl className="mt-4 space-y-1 border-t border-ink/10 pt-4 text-sm">
              <div className="flex justify-between text-ink-soft"><dt>Subtotal</dt><dd>{inrP(order.subtotal_paise)}</dd></div>
              {order.discount_paise > 0 && <div className="flex justify-between text-leaf"><dt>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</dt><dd>-{inrP(order.discount_paise)}</dd></div>}
              <div className="flex justify-between text-ink-soft"><dt>Delivery</dt><dd>{order.delivery_fee_paise ? inrP(order.delivery_fee_paise) : 'Free'}</dd></div>
              {order.tax_paise > 0 && <div className="flex justify-between text-ink-soft"><dt>GST included</dt><dd>{inrP(order.tax_paise)}</dd></div>}
              <div className="flex justify-between pt-2 text-base font-medium"><dt>Total</dt><dd>{inrP(order.total_paise)}</dd></div>
            </dl>
          ) : <p className="mt-4 border-t border-ink/10 pt-4 text-sm text-ink-soft">Part of your daily plan, already paid.</p>}
        </div>
        <div>
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Delivering to</h2>
          <p className="mt-3 text-sm font-medium">{order.address.recipient_name}</p>
          <p className="text-sm text-ink-soft"><AddressLine a={order.address} /></p>
          {order.gift_note && <p className="mt-3 rounded-2xl bg-cream-2 p-3 text-sm italic">"{order.gift_note}"</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          {order.kind === 'one_time' && order.payment_status !== 'pending' && <Button variant="ghost" loading={invBusy} onClick={invoice}><FileText size={16} aria-hidden />Invoice</Button>}
          {failed && !rDone && <Button onClick={() => { setRDate(addDays(todayIST(), 2)); setRSlot(catalog.slots[0]?.id ?? 'early'); setRedeliver(true) }}>Try delivering again</Button>}
          {cancellable && <Button variant="danger" onClick={() => setCancelling(true)}>Cancel order</Button>}
          <LinkButton to="/account/support" variant="ghost">Need help?</LinkButton>
        </div>
        {invErr && <Alert>{invErr}</Alert>}
        {rDone && <Alert tone="ok">Thanks. We have your redelivery request and will confirm it on WhatsApp or email.</Alert>}
      </aside>
      <Modal open={redeliver} onClose={() => setRedeliver(false)} title="Deliver this order again">
        <p className="mb-4 text-sm text-ink-soft">Tell us when someone will be home. Requests before 9 PM can be re-attempted from tomorrow.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New date" type="date" min={addDays(todayIST(), 1)} value={rDate} onChange={(e) => setRDate(e.target.value)} />
          <Select label="Time slot" value={rSlot} onChange={(e) => setRSlot(e.target.value)}>{catalog.slots.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>
        </div>
        <div className="mt-4"><TextArea label="Anything we should know? (optional)" value={rNote} onChange={(e) => setRNote(e.target.value)} /></div>
        {rErr && <div className="mt-4"><Alert>{rErr}</Alert></div>}
        <div className="mt-6 flex gap-3"><Button loading={rBusy} disabled={!rDate || !rSlot} onClick={doRedeliver}>Request redelivery</Button><Button variant="ghost" onClick={() => setRedeliver(false)}>Never mind</Button></div>
      </Modal>
      <Modal open={cancelling} onClose={() => setCancelling(false)} title="Cancel this order?">
        <p className="mb-4 text-sm text-ink-soft">Orders can be cancelled until we start preparing them. Paid orders are refunded to the original payment method.</p>
        <TextArea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        {cErr && <div className="mt-4"><Alert>{cErr}</Alert></div>}
        <div className="mt-6 flex gap-3"><Button variant="danger" loading={cBusy} onClick={doCancel}>Cancel order</Button><Button variant="ghost" onClick={() => setCancelling(false)}>Keep it</Button></div>
      </Modal>
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  return (
    <RequireAuth what="Your orders">
      <PageShell eyebrow="Order" title={<>Your <em>order</em></>}>
        <Link to="/account/orders" className="-mt-6 mb-8 inline-flex min-h-11 items-center gap-2 text-sm text-ink-soft hover:text-ink"><ArrowLeft size={16} aria-hidden />All orders</Link>
        <Detail key={id} />
      </PageShell>
    </RequireAuth>
  )
}
