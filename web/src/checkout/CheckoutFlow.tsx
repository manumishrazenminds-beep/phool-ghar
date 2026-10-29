import { Check } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { previewPricing, type CheckoutBody, type PricingResult } from '../lib/api'
import { useCart } from '../lib/cart'
import { resolveLine, useCatalog, type ResolvedLine } from '../lib/catalog'
import { earliestDate, todayIST } from '../lib/dates'
import { breakdown, inrP, toCheckoutLines } from '../lib/pricing'
import { useSettings } from '../lib/settings'
import { Eyebrow, LinkButton, EmptyState } from '../lib/ui'
import { AddressStep } from './AddressStep'
import { buildGroups } from './groups'
import { PayStep } from './PayStep'
import { ScheduleStep } from './ScheduleStep'
import { Summary } from './Summary'
import type { AddressValue, AppliedCoupon, Schedule } from './types'
import { usePayment, type PaidRef } from './usePayment'

const STEPS = ['Address', 'Schedule', 'Review and pay']

export function CheckoutFlow() {
  const cart = useCart()
  const nav = useNavigate()
  const { user, profile } = useAuth()
  const { catalog } = useCatalog()
  const settings = useSettings()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [address, setAddress] = useState<AddressValue | null>(null)
  const [schedule, setSchedule] = useState<Schedule>({ date: earliestDate(settings.cutoffMinutes), slot: '', giftNote: '', instructions: '' })
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [preview, setPreview] = useState<PricingResult | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const resolved = useMemo(() => cart.lines.map((l) => resolveLine(l, catalog)).filter((x): x is ResolvedLine => !!x), [cart.lines, catalog])
  const groups = useMemo(() => buildGroups(resolved), [resolved])
  const group = groups.find((g) => g.id === groupId) ?? groups[0]

  // keep the date valid once settings (cut-off) load, and pick the first usable slot
  const slots = catalog.slots
  const usable = group?.kind === 'sub' ? slots.filter((s) => s.subscriptionOk) : slots
  useEffect(() => {
    setSchedule((s) => {
      const min = earliestDate(settings.cutoffMinutes)
      const wanted = group?.kind === 'sub' ? group.lines[0].line.date : group?.lines[0]?.line.date
      const date = s.date < min ? (wanted && wanted >= min ? wanted : min) : s.date
      const slot = usable.some((u) => u.id === s.slot) ? s.slot : (group?.lines[0]?.line.slot && usable.some((u) => u.id === group.lines[0].line.slot) ? group.lines[0].line.slot : usable[0]?.id ?? '')
      return date === s.date && slot === s.slot ? s : { ...s, date, slot }
    })
  }, [settings.cutoffMinutes, group, usable])

  // the coupon belongs to one group; drop it when the group changes
  useEffect(() => { setCoupon(null) }, [group?.id])

  const feeKnown = !!address
  const local = useMemo(() => breakdown({
    lines: group?.lines ?? [], discount: coupon?.discountPaise, feePaise: address?.feePaise, freeDeliveryForSub: settings.freeDeliveryForSubscription, serverTax: preview?.tax_paise,
  }), [group, coupon, address, settings.freeDeliveryForSubscription, preview?.tax_paise])
  // server numbers win when available; the local maths is only a fallback for display
  const b = preview && address ? { ...local, subtotal: preview.subtotal_paise, discount: preview.discount_paise, delivery: preview.delivery_fee_paise, tax: preview.tax_paise ?? 0, total: preview.total_paise } : local

  const lineKey = group?.lines.map((l) => l.line.key).join(',') ?? ''
  useEffect(() => {
    if (!group || !address || step < 2 || !schedule.slot) { setPreview(null); return }
    let alive = true
    setPreviewing(true)
    const t = setTimeout(() => {
      previewPricing({ lines: toCheckoutLines(group.lines), pincode: address.pincode, slot_id: schedule.slot, date: schedule.date, coupon_code: coupon?.code })
        .then((r) => alive && setPreview(r && typeof r.total_paise === 'number' ? r : null))
        .catch(() => alive && setPreview(null))
        .finally(() => alive && setPreviewing(false))
    }, 350)
    return () => { alive = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineKey, address?.pincode, schedule.slot, schedule.date, coupon?.code, step])

  const remaining = useMemo(() => Object.fromEntries((preview?.slots ?? []).map((s) => [s.id, s.available === false ? 0 : s.remaining])), [preview])

  const onPaid = useCallback((r: PaidRef) => {
    group?.lines.forEach((l) => cart.remove(l.line.key))
    const q = r.order_id ? `order=${r.order_id}` : `sub=${r.subscription_id ?? ''}`
    nav(`/order/success?${q}`, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, nav])
  const pay = usePayment(onPaid)

  if (!group) return <EmptyState title="Your basket is empty" body="Add a few flowers and come back to check out." action={<LinkButton to="/shop">Browse the shop</LinkButton>} />

  function buildBody(): Omit<CheckoutBody, 'idempotency_key'> {
    const a = address!
    const first = group.lines[0].line
    return {
      lines: toCheckoutLines(group.lines),
      ...(a.id ? { address_id: a.id } : { address: a.snapshot }),
      recipient: { name: a.snapshot.recipient_name ?? profile?.full_name ?? '', phone: a.snapshot.recipient_phone ?? profile?.phone ?? '' },
      date: schedule.date,
      slot_id: schedule.slot,
      gift_note: schedule.giftNote.trim() || undefined,
      instructions: schedule.instructions.trim() || undefined,
      coupon_code: coupon?.code,
      subscription: group.kind === 'sub' ? { plan_days: first.period ?? 30, delivery_days: first.days ?? [], start_date: schedule.date } : undefined,
    }
  }

  const minOrder = settings.minOrderPaise
  const blocker = group.kind === 'once' && minOrder > 0 && b.subtotal < minOrder ? `The minimum order is ${inrP(minOrder)}. Add a little more to continue.` : !user ? 'Please sign in to pay.' : schedule.date < todayIST() ? 'Pick a delivery date.' : null

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_24rem] lg:gap-16">
      <div>
        <ol className="mb-10 flex flex-wrap gap-x-8 gap-y-2" aria-label="Checkout steps">
          {STEPS.map((s, i) => {
            const n = (i + 1) as 1 | 2 | 3
            const done = n < step
            return (
              <li key={s} aria-current={n === step ? 'step' : undefined}>
                <button disabled={!done || pay.busy} onClick={() => setStep(n)} className={`flex min-h-11 items-center gap-2 text-sm ${n === step ? 'font-medium text-ink' : done ? 'text-ink-soft hover:text-ink' : 'text-ink/40'}`}>
                  <span className={`grid h-6 w-6 place-items-center rounded-full border text-xs ${n === step ? 'border-ink bg-ink text-cream' : done ? 'border-leaf bg-leaf text-cream' : 'border-ink/25'}`}>{done ? <Check size={12} weight="bold" /> : n}</span>
                  {s}
                </button>
              </li>
            )
          })}
        </ol>

        {groups.length > 1 && (
          <div className="mb-10 rounded-3xl border border-ink/10 bg-cream-2/70 p-5">
            <Eyebrow>{groups.length} separate payments</Eyebrow>
            <p className="mt-2 text-sm text-ink-soft">One-time orders and daily plans are paid separately. Choose which to pay first; the rest stay in your basket.</p>
            <div role="radiogroup" aria-label="Pay for" className="mt-3 flex flex-wrap gap-2">
              {groups.map((g) => (
                <button key={g.id} role="radio" aria-checked={g.id === group.id} disabled={pay.busy} onClick={() => { setGroupId(g.id); setStep(address ? 2 : 1) }}
                  className={`min-h-11 rounded-full border px-4 text-sm ${g.id === group.id ? 'border-ink bg-ink text-cream' : 'border-ink/20 bg-white hover:border-ink/50'}`}>{g.title}</button>
              ))}
            </div>
          </div>
        )}

        <h2 className="font-display text-4xl">{step === 1 ? <>Where should we <em>deliver</em>?</> : step === 2 ? <>When would you like it?</> : <>Review and <em>pay</em></>}</h2>
        <div className="mt-8">
          {step === 1 && <AddressStep value={address} onDone={(v) => { setAddress(v); setStep(2) }} />}
          {step === 2 && address && <ScheduleStep group={group} value={schedule} onChange={setSchedule} slots={slots} remaining={remaining} onNext={() => setStep(3)} />}
          {step === 3 && address && (
            <PayStep group={group} address={address} schedule={schedule} slot={slots.find((s) => s.id === schedule.slot)} coupon={coupon} setCoupon={setCoupon}
              subtotal={b.subtotal} total={b.total} phase={pay.phase} notice={pay.notice} blocker={blocker}
              onPay={() => void pay.run(buildBody())} onVerify={() => void pay.retryVerify()} onEdit={(s) => setStep(s)} />
          )}
        </div>
      </div>
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <Summary group={group} b={b} couponCode={coupon?.code} pending={previewing && step === 3} feeKnown={feeKnown} />
      </aside>
    </div>
  )
}
