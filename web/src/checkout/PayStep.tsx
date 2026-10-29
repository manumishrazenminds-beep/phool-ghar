import { Lock, X } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { applyCouponPreview, friendlyError } from '../lib/api'
import { fmtDate } from '../lib/dates'
import { inrP } from '../lib/pricing'
import { Alert, Button, Field } from '../lib/ui'
import type { PayPhase, PayNotice } from './usePayment'
import type { AddressValue, AppliedCoupon, PayGroup, Schedule } from './types'
import type { SlotInfo } from '../lib/catalog'

export function PayStep({ group, address, schedule, slot, coupon, setCoupon, subtotal, total, phase, notice, onPay, onVerify, onEdit, blocker }: {
  group: PayGroup; address: AddressValue; schedule: Schedule; slot?: SlotInfo
  coupon: AppliedCoupon | null; setCoupon: (c: AppliedCoupon | null) => void; subtotal: number; total: number
  phase: PayPhase; notice: PayNotice | null; onPay: () => void; onVerify: () => void; onEdit: (step: 1 | 2) => void; blocker?: string | null
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const working = phase !== 'idle'

  async function apply(e: FormEvent) {
    e.preventDefault()
    if (busy || !code.trim()) return
    setBusy(true); setErr(null)
    try {
      const r = await applyCouponPreview(code, subtotal, group.kind === 'sub' ? 'subscription' : 'one_time')
      if (!r.valid || !r.discount_paise) setErr(r.message ?? 'That code is not valid for this order.')
      else { setCoupon({ code: (r.code ?? code).toUpperCase(), discountPaise: r.discount_paise }); setCode('') }
    } catch (x) { setErr(friendlyError(x)) } finally { setBusy(false) }
  }

  const label = phase === 'creating' ? 'Preparing your order' : phase === 'paying' ? 'Waiting for payment' : phase === 'verifying' ? 'Confirming payment' : `Pay ${inrP(total)}`

  return (
    <div className="space-y-8">
      <dl className="divide-y divide-ink/10 rounded-3xl border border-ink/10 bg-white text-sm">
        <div className="flex items-start justify-between gap-4 p-5">
          <div><dt className="text-ink-soft">Deliver to</dt><dd className="mt-1 font-medium">{address.snapshot.recipient_name}</dd>
            <dd className="text-ink-soft">{[address.snapshot.line1, address.snapshot.city].filter(Boolean).join(', ')} {address.pincode}</dd></div>
          <button className="min-h-11 px-2 text-ink-soft underline underline-offset-4 hover:text-ink" onClick={() => onEdit(1)} disabled={working}>Change</button>
        </div>
        <div className="flex items-start justify-between gap-4 p-5">
          <div><dt className="text-ink-soft">{group.kind === 'sub' ? 'Starts' : 'Delivery'}</dt><dd className="mt-1 font-medium">{fmtDate(schedule.date, { weekday: 'long', day: 'numeric', month: 'long' })}</dd>
            <dd className="text-ink-soft">{slot?.label ?? schedule.slot}</dd>
            {schedule.giftNote && <dd className="mt-2 italic text-ink-soft">"{schedule.giftNote}"</dd>}</div>
          <button className="min-h-11 px-2 text-ink-soft underline underline-offset-4 hover:text-ink" onClick={() => onEdit(2)} disabled={working}>Change</button>
        </div>
      </dl>

      <div>
        {coupon ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-leaf-soft px-4 py-3 text-sm text-leaf">
            <span><strong>{coupon.code}</strong> applied, you save {inrP(coupon.discountPaise)}</span>
            <button aria-label="Remove coupon" onClick={() => setCoupon(null)} disabled={working} className="grid h-11 w-11 place-items-center rounded-full hover:bg-leaf/10"><X size={16} /></button>
          </div>
        ) : (
          <form onSubmit={apply} className="flex items-end gap-3">
            <div className="flex-1"><Field label="Coupon code" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} error={err} disabled={working} /></div>
            <Button type="submit" variant="ghost" loading={busy} disabled={!code.trim() || working}>Apply</Button>
          </form>
        )}
      </div>

      {notice && (
        <Alert tone={notice.tone} title={notice.title}
          action={notice.action === 'verify' ? <Button variant="ghost" onClick={onVerify} loading={phase === 'verifying'}>Check status</Button> : undefined}>
          {notice.body}
        </Alert>
      )}
      {blocker && <Alert tone="warn">{blocker}</Alert>}

      <div>
        <Button className="w-full !py-4 text-base" onClick={onPay} loading={working} disabled={!!blocker}>
          {!working && <Lock size={16} aria-hidden />}{label}
        </Button>
        <p className="mt-3 text-center text-xs text-ink-soft" aria-live="polite">
          {working ? 'Please keep this page open.' : 'Secure payment by Razorpay: UPI, cards and net banking.'}
        </p>
      </div>
    </div>
  )
}
