import { CaretRight } from '@phosphor-icons/react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { friendlyError, listOrders, type OrderRow } from '../lib/api'
import { fmtDate } from '../lib/dates'
import { inrP } from '../lib/pricing'
import { EmptyState, ErrorState, LinkButton, SkeletonList } from '../lib/ui'
import { StatusPill } from './status'

export function Orders() {
  const [items, setItems] = useState<OrderRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => { setError(null); listOrders().then(setItems).catch((e) => setError(friendlyError(e))) }, [])
  useEffect(load, [load])
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!items) return <SkeletonList />
  return (
    <div>
      <h2 className="font-display text-3xl">Your orders</h2>
      {items.length === 0 ? (
        <div className="mt-6"><EmptyState title="No orders yet" body="Your first bunch of flowers will show up here." action={<LinkButton to="/shop">Browse the shop</LinkButton>} /></div>
      ) : (
        <ul className="mt-6 divide-y divide-ink/10 rounded-3xl border border-ink/10 bg-white">
          {items.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="flex min-h-16 items-center gap-4 px-5 py-4 transition hover:bg-cream-2/60">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.order_no}{o.kind === 'subscription_delivery' && <span className="ml-2 text-xs font-normal text-ink-soft">Daily plan delivery</span>}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{fmtDate(o.delivery_date)}</p>
                </div>
                <div className="hidden sm:block"><StatusPill status={o.status} /></div>
                <p className="w-20 text-right text-sm font-medium">{o.kind === 'subscription_delivery' ? 'Included' : inrP(o.total_paise)}</p>
                <CaretRight size={16} className="text-ink-soft" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
