import { PRODUCTS } from '../data/products'
import type { Breakdown } from '../lib/pricing'
import { inrP, linePaise, planLabel } from '../lib/pricing'
import { Skeleton } from '../lib/ui'
import type { PayGroup } from './types'

export function Summary({ group, b, couponCode, pending, feeKnown }: { group: PayGroup; b: Breakdown; couponCode?: string; pending?: boolean; feeKnown: boolean }) {
  return (
    <div className="rounded-3xl border border-ink/10 bg-cream-2/70 p-6">
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Order summary</h2>
      <ul className="mt-4 space-y-4">
        {group.lines.map((r) => {
          const img = r.product.image || PRODUCTS.find((p) => p.slug === r.product.slug)?.image
          return (
            <li key={r.line.key} className="flex gap-3">
              {img && <img src={img} alt="" className="h-16 w-14 shrink-0 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg leading-tight">{r.product.name}</p>
                <p className="text-xs text-ink-soft">{r.variant.label} x {r.line.qty}{r.line.mode === 'sub' ? `, ${planLabel(r)}` : ''}</p>
              </div>
              <p className="text-sm font-medium">{inrP(linePaise(r))}</p>
            </li>
          )
        })}
      </ul>
      <dl className="mt-5 space-y-2 border-t border-ink/10 pt-4 text-sm" aria-busy={pending}>
        <div className="flex justify-between text-ink-soft"><dt>Subtotal</dt><dd>{inrP(b.subtotal)}</dd></div>
        {b.discount > 0 && <div className="flex justify-between text-leaf"><dt>Discount{couponCode ? ` (${couponCode})` : ''}</dt><dd>-{inrP(b.discount)}</dd></div>}
        <div className="flex justify-between text-ink-soft"><dt>Delivery</dt><dd>{!feeKnown ? 'Added after address' : b.delivery ? inrP(b.delivery) : 'Free'}</dd></div>
        {b.tax > 0 && <div className="flex justify-between text-ink-soft"><dt>GST included</dt><dd>{inrP(b.tax)}</dd></div>}
        <div className="flex justify-between pt-2 text-lg font-medium"><dt>Total</dt><dd>{pending ? <Skeleton className="h-6 w-20" /> : inrP(b.total)}</dd></div>
      </dl>
    </div>
  )
}
