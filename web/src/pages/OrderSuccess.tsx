import { CheckCircle, Hourglass } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AddressLine } from '../account/Addresses'
import { RequireAuth } from '../auth/RequireAuth'
import { friendlyError, getOrder, getSubscription, type OrderRow, type SubscriptionRow } from '../lib/api'
import { useCart } from '../lib/cart'
import { WEEKDAYS } from '../data/products'
import { fmtDate } from '../lib/dates'
import { inrP } from '../lib/pricing'
import { Alert, ErrorState, LinkButton, PageShell, SkeletonList } from '../lib/ui'

type Loaded = { kind: 'order'; order: OrderRow } | { kind: 'sub'; sub: SubscriptionRow }

function Body() {
  const [params] = useSearchParams()
  const orderId = params.get('order')
  const subId = params.get('sub')
  const { lines } = useCart()
  const [data, setData] = useState<Loaded | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let alive = true
    const p: Promise<Loaded | null> = orderId ? getOrder(orderId).then((r) => (r ? { kind: 'order', order: r.order } : null)) : subId ? getSubscription(subId).then((s) => (s ? { kind: 'sub', sub: s } : null)) : Promise.resolve(null)
    p.then((d) => alive && setData(d)).catch((e) => alive && setError(friendlyError(e)))
    return () => { alive = false }
  }, [orderId, subId, tries])

  // the webhook may confirm a moment after the popup closes: poll a few times
  const waiting = data?.kind === 'order' ? data.order.payment_status === 'pending' : data?.kind === 'sub' ? data.sub.status === 'pending_payment' : false
  useEffect(() => {
    if (!waiting || tries >= 6) return
    const t = setTimeout(() => setTries((n) => n + 1), 2500)
    return () => clearTimeout(t)
  }, [waiting, tries])

  if (error) return <ErrorState message={error} onRetry={() => { setError(null); setTries((n) => n + 1) }} />
  if (data === undefined) return <SkeletonList rows={2} />

  const heading = waiting ? <>Confirming your <em>payment</em></> : <>Thank you, <em>it is booked</em></>
  const rest = lines.length > 0

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 text-leaf">
        {waiting ? <Hourglass size={28} aria-hidden /> : <CheckCircle size={28} weight="fill" aria-hidden />}
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em]">{waiting ? 'Waiting for the bank' : 'Payment received'}</p>
      </div>
      <h2 className="font-display mt-3 text-5xl">{heading}</h2>
      {!data ? (
        <p className="mt-4 text-ink-soft">We could not load the details, but your payment is safe. Check your orders in a moment, or contact us if you do not see it.</p>
      ) : data.kind === 'order' ? (
        <>
          <p className="mt-4 text-ink-soft">Order <strong className="text-ink">{data.order.order_no}</strong>. We will email you a receipt and keep you posted at every step.</p>
          <dl className="mt-8 grid gap-6 border-y border-ink/10 py-6 text-sm sm:grid-cols-3">
            <div><dt className="text-ink-soft">Delivery</dt><dd className="mt-1 font-medium">{fmtDate(data.order.delivery_date, { weekday: 'long', day: 'numeric', month: 'long' })}</dd></div>
            <div><dt className="text-ink-soft">To</dt><dd className="mt-1 font-medium">{data.order.address.recipient_name}</dd><dd className="text-ink-soft"><AddressLine a={data.order.address} /></dd></div>
            <div><dt className="text-ink-soft">Total</dt><dd className="mt-1 font-medium">{inrP(data.order.total_paise)}</dd></div>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3"><LinkButton to={`/orders/${data.order.id}`}>Track this order</LinkButton><LinkButton to="/shop" variant="ghost">Keep shopping</LinkButton></div>
        </>
      ) : (
        <>
          <p className="mt-4 text-ink-soft">Your daily plan is set. We will remind you the evening before each delivery, and you can skip or pause any day until 9 PM.</p>
          <dl className="mt-8 grid gap-6 border-y border-ink/10 py-6 text-sm sm:grid-cols-3">
            <div><dt className="text-ink-soft">Starts</dt><dd className="mt-1 font-medium">{fmtDate(data.sub.start_date, { weekday: 'long', day: 'numeric', month: 'long' })}</dd></div>
            <div><dt className="text-ink-soft">Days</dt><dd className="mt-1 font-medium">{data.sub.delivery_days.map((d) => WEEKDAYS[d]).join(', ')}</dd></div>
            <div><dt className="text-ink-soft">Paid</dt><dd className="mt-1 font-medium">{inrP(data.sub.total_paise)}</dd></div>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3"><LinkButton to="/account/subscriptions">Manage my plan</LinkButton><LinkButton to="/shop" variant="ghost">Keep shopping</LinkButton></div>
        </>
      )}
      {waiting && tries >= 6 && <div className="mt-6"><Alert tone="info">Still confirming. This can take a few minutes. You will get an email as soon as it is done, and you do not need to pay again.</Alert></div>}
      {rest && <div className="mt-10"><Alert tone="info" title="You still have items in your basket" action={<LinkButton to="/checkout" variant="ghost">Continue</LinkButton>}>One-time orders and daily plans are paid separately.</Alert></div>}
    </div>
  )
}

export default function OrderSuccess() {
  return (
    <RequireAuth what="Your order">
      <PageShell eyebrow="Order" title="Order status"><Body /></PageShell>
    </RequireAuth>
  )
}
