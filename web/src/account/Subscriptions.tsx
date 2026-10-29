import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PLAN_PERIODS, PRODUCTS, WEEKDAYS } from '../data/products'
import { useCart } from '../lib/cart'
import { useCatalog } from '../lib/catalog'
import {
  cancelSub, friendlyError, getSubscription, listAddresses, listSubscriptions, pauseSub, resumeSub, skipDay, unskipDay, updateSchedule, type Address, type SubscriptionRow,
} from '../lib/api'
import { addDays, diffDays, fmtDate, isLocked, todayIST, weekdayIndex } from '../lib/dates'
import { inrP } from '../lib/pricing'
import { useSettings } from '../lib/settings'
import { Alert, Button, EmptyState, ErrorState, Field, LinkButton, Modal, Select, SkeletonList, TextArea } from '../lib/ui'
import { StatusPill } from './status'

type DayState = 'delivery' | 'skipped' | 'paused'

/** Client-side projection of upcoming deliveries; the server decides what really gets delivered. */
export function projectDays(sub: SubscriptionRow, skips: string[], horizon: string): Map<string, DayState> {
  const out = new Map<string, DayState>()
  if (sub.status === 'cancelled' || sub.status === 'completed' || sub.status === 'pending_payment') return out
  const today = todayIST()
  const start = sub.start_date > today ? sub.start_date : today
  const end = sub.end_date && sub.end_date < horizon ? sub.end_date : horizon
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!sub.delivery_days.includes(weekdayIndex(d))) continue
    if (skips.includes(d)) out.set(d, 'skipped')
    else if (sub.paused_from && sub.paused_to && d >= sub.paused_from && d <= sub.paused_to) out.set(d, 'paused')
    else out.set(d, 'delivery')
  }
  for (const s of skips) if (s >= today && s <= horizon && !out.has(s)) out.set(s, 'skipped')
  return out
}

function Calendar({ days, selected, onSelect, cutoff }: { days: Map<string, DayState>; selected: string | null; onSelect: (d: string) => void; cutoff: number }) {
  const [offset, setOffset] = useState(0)
  const today = todayIST()
  const weekStart = addDays(today, -weekdayIndex(today) + offset * 7)
  const cells = Array.from({ length: 28 }, (_, i) => addDays(weekStart, i))
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink-soft">{fmtDate(cells[0], { day: 'numeric', month: 'short' })} to {fmtDate(cells[27], { day: 'numeric', month: 'short' })}</p>
        <div className="flex gap-1">
          <button aria-label="Earlier weeks" disabled={offset <= 0} onClick={() => setOffset((o) => o - 4)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-ink/5 disabled:opacity-30"><CaretLeft size={16} /></button>
          <button aria-label="Later weeks" onClick={() => setOffset((o) => o + 4)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-ink/5"><CaretRight size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
      <div role="grid" aria-label="Upcoming deliveries" className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const st = days.get(d)
          const past = d < today
          const locked = isLocked(d, cutoff)
          const sel = selected === d
          const base = 'relative grid min-h-11 place-items-center rounded-xl text-sm transition'
          const style = st === 'delivery' ? 'bg-leaf-soft text-leaf font-medium' : st === 'skipped' ? 'bg-rose-soft text-rose line-through' : st === 'paused' ? 'bg-saffron/25 text-ink' : past ? 'text-ink/25' : 'text-ink-soft'
          return st ? (
            <button key={d} role="gridcell" onClick={() => onSelect(d)} aria-pressed={sel}
              aria-label={`${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}, ${st === 'delivery' ? 'delivery' : st === 'skipped' ? 'skipped' : 'paused'}${locked ? ', locked' : ''}`}
              className={`${base} ${style} ${sel ? 'ring-2 ring-ink' : 'hover:ring-1 hover:ring-ink/30'} ${locked ? 'opacity-70' : ''}`}>{Number(d.slice(8))}</button>
          ) : <span key={d} role="gridcell" className={`${base} ${style}`}>{Number(d.slice(8))}</span>
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
        <li><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-leaf-soft ring-1 ring-leaf/40" />Delivery</li>
        <li><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-rose-soft ring-1 ring-rose/40" />Skipped</li>
        <li><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-saffron/25 ring-1 ring-saffron" />Paused</li>
      </ul>
    </div>
  )
}

function SubCard({ sub, skips, reload }: { sub: SubscriptionRow; skips: string[]; reload: () => void }) {
  const { cutoffMinutes } = useSettings()
  const [live, setLive] = useState(sub)
  useEffect(() => setLive(sub), [sub])
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [modal, setModal] = useState<'pause' | 'cancel' | 'schedule' | null>(null)
  const { catalog } = useCatalog()
  const { add } = useCart()
  const navigate = useNavigate()
  const [sDays, setSDays] = useState<number[]>(sub.delivery_days)
  const [sSlot, setSSlot] = useState(sub.slot_id ?? '')
  const [sAddr, setSAddr] = useState('')
  const [addrs, setAddrs] = useState<Address[]>([])
  const [pf, setPf] = useState('')
  const [pt, setPt] = useState('')
  const [reason, setReason] = useState('')
  const active = live.status === 'active' || live.status === 'paused'
  const days = useMemo(() => projectDays(live, skips, addDays(todayIST(), 120)), [live, skips])
  const sel = selected ? days.get(selected) : undefined
  const selLocked = selected ? isLocked(selected, cutoffMinutes) : false
  const upcoming = [...days.entries()].filter(([, s]) => s === 'delivery').slice(0, 1)[0]?.[0]
  const earliest = addDays(todayIST(), 1)

  async function act(label: string, run: () => Promise<unknown>, after?: () => void) {
    if (busy) return
    setBusy(true); setErr(null); setOk(null)
    try {
      await run()
      setOk(label)
      const fresh = await getSubscription(live.id).catch(() => null)
      if (fresh) setLive(fresh)
      after?.()
      reload()
    } catch (e) { setErr(friendlyError(e)) } finally { setBusy(false) }
  }

  const name = live.products?.name ?? 'Daily flowers'
  const daysLeft = live.end_date ? diffDays(todayIST(), live.end_date) : null
  const canRenew = live.status === 'completed' || ((live.status === 'active') && daysLeft !== null && daysLeft <= 7)

  function openSchedule() {
    setSDays(live.delivery_days); setSSlot(live.slot_id ?? ''); setSAddr(''); setErr(null); setModal('schedule')
    listAddresses().then(setAddrs).catch(() => setAddrs([]))
  }
  function toggleDay(i: number) { setSDays((d) => (d.includes(i) ? (d.length > 1 ? d.filter((x) => x !== i) : d) : [...d, i].sort())) }
  const scheduleChanged = sDays.join() !== live.delivery_days.join() || (sSlot && sSlot !== live.slot_id) || !!sAddr
  function saveSchedule() {
    const a = addrs.find((x) => x.id === sAddr)
    const snap = a ? { recipient_name: a.recipient_name, recipient_phone: a.recipient_phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, pincode: a.pincode, instructions: a.instructions } : undefined
    void act('Schedule updated. It applies from the next delivery that is still open for changes.',
      () => updateSchedule(live.id, { days: sDays.join() !== live.delivery_days.join() ? sDays : undefined, slot: sSlot && sSlot !== live.slot_id ? sSlot : undefined, address: snap }), () => setModal(null))
  }
  function renew() {
    const p = PRODUCTS.find((x) => x.slug === live.products?.slug)
    if (!p) { setErr('This product is no longer available. Pick a plan from the shop.'); return }
    const startAfter = live.end_date && live.end_date >= todayIST() ? addDays(live.end_date, 1) : addDays(todayIST(), 1)
    const period = PLAN_PERIODS.some((x) => x.days === live.plan_days) ? live.plan_days : 30
    add({ productId: p.id, variantId: live.variant_key, mode: 'sub', qty: 1, date: startAfter, slot: live.slot_id ?? 'early', period, days: live.delivery_days })
    navigate('/checkout')
  }
  return (
    <article className="rounded-3xl border border-ink/10 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {live.products?.image_url && <img src={live.products.image_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />}
          <div>
            <h3 className="font-display text-2xl">{name}</h3>
            <p className="text-sm text-ink-soft">{live.variant_key} size, {live.plan_days} day plan, {live.delivery_days.map((d) => WEEKDAYS[d]).join(' ')}</p>
          </div>
        </div>
        <StatusPill status={live.status} />
      </div>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-ink-soft">Next delivery</dt><dd className="font-medium">{upcoming ? fmtDate(upcoming) : 'None scheduled'}</dd></div>
        <div><dt className="text-ink-soft">Plan ends</dt><dd className="font-medium">{live.end_date ? fmtDate(live.end_date) : 'Starts after payment'}</dd></div>
        <div><dt className="text-ink-soft">Paid</dt><dd className="font-medium">{inrP(live.total_paise)}{live.skipped_days ? `, ${live.skipped_days} skipped` : ''}</dd></div>
      </dl>
      {live.status === 'paused' && live.paused_from && <div className="mt-5"><Alert tone="warn" title="Paused">{fmtDate(live.paused_from)} to {live.paused_to ? fmtDate(live.paused_to) : 'until you resume'}. Your plan end date moves out to match.</Alert></div>}
      {live.status === 'pending_payment' && <div className="mt-5"><Alert tone="warn" title="Payment not completed">This plan starts once payment is confirmed.</Alert></div>}

      {active && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_16rem]">
          <Calendar days={days} selected={selected} onSelect={(d) => { setSelected(d); setErr(null); setOk(null) }} cutoff={cutoffMinutes} />
          <div className="text-sm" aria-live="polite">
            {selected && sel ? (
              <>
                <p className="font-medium">{fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                {selLocked ? <p className="mt-2 text-ink-soft">This delivery is locked. Changes close at 9 PM the evening before.</p> : sel === 'skipped' ? (
                  <Button className="mt-3" variant="ghost" loading={busy} onClick={() => act('Delivery restored.', () => unskipDay(live.id, selected))}>Restore this delivery</Button>
                ) : sel === 'delivery' ? (
                  <>
                    <Button className="mt-3" variant="ghost" loading={busy} onClick={() => act('Skipped. Your plan end date moves out by one delivery.', () => skipDay(live.id, selected))}>Skip this day</Button>
                    <p className="mt-2 text-xs text-ink-soft">Skipped days are added to the end of your plan.</p>
                  </>
                ) : <p className="mt-2 text-ink-soft">Paused. Resume the plan to receive this delivery.</p>}
              </>
            ) : <p className="text-ink-soft">Select a delivery date to skip it or bring it back.</p>}
            {err && <div className="mt-3"><Alert>{err}</Alert></div>}
            {ok && <div className="mt-3"><Alert tone="ok">{ok}</Alert></div>}
          </div>
        </div>
      )}

      {active && (
        <div className="mt-6 flex flex-wrap gap-3 border-t border-ink/10 pt-5">
          {live.status === 'paused' ? (
            <Button variant="ghost" loading={busy} onClick={() => act('Plan resumed.', () => resumeSub(live.id))}>Resume plan</Button>
          ) : <Button variant="ghost" onClick={() => { setPf(earliest); setPt(addDays(earliest, 6)); setErr(null); setModal('pause') }}>Pause for a few days</Button>}
          <Button variant="ghost" onClick={openSchedule}>Change days, slot or address</Button>
          <Button variant="danger" onClick={() => { setErr(null); setModal('cancel') }}>Cancel plan</Button>
        </div>
      )}
      {canRenew && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl bg-leaf-soft/60 p-4">
          <p className="flex-1 text-sm">{live.status === 'completed' ? 'This plan has ended.' : `Your plan ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`} Keep the flowers coming with the same days and slot.</p>
          <Button onClick={renew}>Renew plan</Button>
        </div>
      )}

      <Modal open={modal === 'pause'} onClose={() => setModal(null)} title="Pause your plan">
        <p className="mb-4 text-sm text-ink-soft">No flowers during these dates, and your plan end date moves out to match. Starting tomorrow needs a request before 9 PM today.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" type="date" min={earliest} value={pf} onChange={(e) => setPf(e.target.value)} />
          <Field label="To" type="date" min={pf || earliest} value={pt} onChange={(e) => setPt(e.target.value)} />
        </div>
        {pf && pt && diffDays(pf, pt) >= 0 && <p className="mt-3 text-xs text-ink-soft">{diffDays(pf, pt) + 1} days paused.</p>}
        {err && <div className="mt-4"><Alert>{err}</Alert></div>}
        <div className="mt-6 flex gap-3">
          <Button loading={busy} disabled={!pf || !pt || pt < pf} onClick={() => act('Plan paused.', () => pauseSub(live.id, pf, pt), () => setModal(null))}>Pause plan</Button>
          <Button variant="ghost" onClick={() => setModal(null)}>Never mind</Button>
        </div>
      </Modal>
      <Modal open={modal === 'schedule'} onClose={() => setModal(null)} title="Change your schedule">
        <p className="mb-4 text-sm text-ink-soft">Changes apply from the next delivery that is still open (requests before 9 PM start tomorrow). Your plan keeps the same number of deliveries, so the end date can move.</p>
        <p className="mb-2 text-sm font-semibold">Delivery days</p>
        <div className="mb-5 flex flex-wrap gap-2">
          {WEEKDAYS.map((d, i) => (
            <button key={d} type="button" onClick={() => toggleDay(i)} aria-pressed={sDays.includes(i)} className={`h-12 w-14 rounded-2xl border text-sm font-medium transition ${sDays.includes(i) ? 'border-leaf bg-leaf text-cream' : 'border-ink/15 hover:border-ink/40'}`}>{d}</button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Time slot" value={sSlot} onChange={(e) => setSSlot(e.target.value)}>
            {catalog.slots.filter((x) => x.subscriptionOk).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </Select>
          <Select label="Delivery address" value={sAddr} onChange={(e) => setSAddr(e.target.value)}>
            <option value="">Keep current ({live.address?.line1 ?? 'address'})</option>
            {addrs.map((a) => <option key={a.id} value={a.id}>{a.label ? a.label + ': ' : ''}{a.line1}, {a.pincode}</option>)}
          </Select>
        </div>
        {err && <div className="mt-4"><Alert>{err}</Alert></div>}
        <div className="mt-6 flex gap-3">
          <Button loading={busy} disabled={!scheduleChanged} onClick={saveSchedule}>Save changes</Button>
          <Button variant="ghost" onClick={() => setModal(null)}>Never mind</Button>
        </div>
      </Modal>
      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel this plan?">
        <p className="mb-4 text-sm text-ink-soft">Deliveries stop. Any refund for unused days follows our refund policy and goes to your original payment method.</p>
        <TextArea label="Why are you leaving? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        {err && <div className="mt-4"><Alert>{err}</Alert></div>}
        <div className="mt-6 flex gap-3">
          <Button variant="danger" loading={busy} onClick={() => act('Plan cancelled.', () => cancelSub(live.id, reason.trim() || 'Cancelled by customer'), () => setModal(null))}>Cancel plan</Button>
          <Button variant="ghost" onClick={() => setModal(null)}>Keep my plan</Button>
        </div>
      </Modal>
    </article>
  )
}

export function Subscriptions() {
  const [data, setData] = useState<Awaited<ReturnType<typeof listSubscriptions>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => { listSubscriptions().then((d) => { setData(d); setError(null) }).catch((e) => setError(friendlyError(e))) }, [])
  useEffect(load, [load])
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return <SkeletonList rows={2} />
  return (
    <div>
      <h2 className="font-display text-3xl">Daily plans</h2>
      {data.subs.length === 0 ? (
        <div className="mt-6"><EmptyState title="No daily plans yet" body="Fresh pooja flowers at your door every morning. Skip or pause any day." action={<LinkButton to="/shop?type=sub">See daily plans</LinkButton>} /></div>
      ) : (
        <div className="mt-6 space-y-6">{data.subs.map((s) => <SubCard key={s.id} sub={s} skips={data.skips[s.id] ?? []} reload={load} />)}</div>
      )}
    </div>
  )
}
