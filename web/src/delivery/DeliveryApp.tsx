import { ArrowClockwise, ChatCircleText, CheckCircle, MapPin, Phone, SignOut, Storefront, Truck, WarningCircle, WifiSlash } from '@phosphor-icons/react'
import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { LogoMark } from '../components/Logo'
import { DemoBar } from '../admin/DemoBar'
import { addressLine, fmtDate, mapsLink, telLink, todayISO, waLink } from '../admin/format'
import { useAdminMode } from '../admin/mode'
import { AdminRoot, Gate } from '../admin/Shell'
import { useQuery } from '../admin/useQuery'
import { StatusBadge, useToast } from '../admin/ui'
import type { Order, OrderItem, OrderStatus, Slot } from '../admin/types'
import type { ProfileState } from '../admin/useProfile'
import { useStatusQueue, type QueuedUpdate } from './queue'

const REASONS = ['Customer not reachable', 'Address not found', 'Nobody at home', 'Customer refused', 'Gate or lift blocked']

export default function DeliveryApp() {
  return <AdminRoot><Gate area="delivery" render={(p) => <Stops profile={p} />} /></AdminRoot>
}

function Stops({ profile }: { profile: ProfileState }) {
  const { api } = useAdminMode()
  const { toast } = useToast()
  const today = todayISO()
  const me = profile.profile!.id
  const [tab, setTab] = useState<'todo' | 'done'>('todo')
  const [failFor, setFailFor] = useState<Order | null>(null)

  const data = useQuery(async () => {
    const orders = await api.select<Order>('orders', { filters: [{ col: 'assigned_to', op: 'eq', val: me }, { col: 'delivery_date', op: 'eq', val: today }], order: [{ col: 'slot_id' }, { col: 'order_no' }] })
    const slots = await api.select<Slot>('delivery_slots', { order: [{ col: 'sort' }] }).catch(() => [] as Slot[])
    let items: OrderItem[] = []
    if (orders.length) items = await api.select<OrderItem>('order_items', { filters: [{ col: 'order_id', op: 'in', val: orders.map((o) => o.id) }] }).catch(() => [])
    return { orders, slots, items }
  }, [me])

  const q = useStatusQueue(api,
    (_u: QueuedUpdate, message) => { toast(`Could not update the order: ${message}`, 'error'); data.reload() },
    () => data.reload())

  const orders = useMemo(() => (data.data?.orders ?? []).map((o) => { const p = q.pending.get(o.id); return p ? { ...o, status: p.status, failure_reason: p.status === 'failed' ? p.note : o.failure_reason } : o }), [data.data, q.pending]) // eslint-disable-line react-hooks/exhaustive-deps
  const isDone = (o: Order) => o.status === 'delivered' || o.status === 'failed' || o.status === 'cancelled'
  const todo = orders.filter((o) => !isDone(o))
  const done = orders.filter(isDone)
  const shown = tab === 'todo' ? todo : done
  const slotLabel = (id: string) => data.data?.slots.find((s) => s.id === id)?.label ?? id
  const slotIds = [...new Set(shown.map((o) => o.slot_id))].sort((a, b) => (data.data?.slots.findIndex((s) => s.id === a) ?? 0) - (data.data?.slots.findIndex((s) => s.id === b) ?? 0))
  const summary = (id: string) => (data.data?.items ?? []).filter((i) => i.order_id === id).map((i) => `${i.qty} x ${i.name_snapshot}`).join(', ')
  const set = (o: Order, s: OrderStatus, note: string | null = null) => q.enqueue(o.id, s, note)
  const pct = orders.length ? Math.round((orders.filter((o) => o.status === 'delivered').length / orders.length) * 100) : 0

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <DemoBar />
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-cream/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <LogoMark size={36} />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-marigold-deep">{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
              <h1 className="font-display text-4xl leading-none">Hello, {(profile.profile!.full_name ?? 'there').split(' ')[0]}</h1>
            </div>
          </div>
          <div className="flex items-center">
            <a href="/" aria-label="View the store" className="grid h-12 w-12 place-items-center rounded-xl text-ink-soft hover:bg-ink/5"><Storefront size={22} /></a>
            <button type="button" onClick={() => void profile.signOut()} aria-label="Sign out" className="grid h-12 w-12 place-items-center rounded-xl text-ink-soft hover:bg-ink/5"><SignOut size={22} /></button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3" aria-label={`${pct} percent delivered`}>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-leaf transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} /></div>
          <span className="font-mono text-xs">{orders.filter((o) => o.status === 'delivered').length}/{orders.length}</span>
        </div>
        {(!q.online || q.count > 0) && (
          <p role="status" className={clsx('mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm', q.online ? 'bg-saffron/30' : 'bg-rose-soft')}>
            {!q.online && <WifiSlash size={18} aria-hidden />}
            {!q.online ? 'You are offline. ' : ''}{q.count > 0 ? `${q.count} update${q.count > 1 ? 's' : ''} waiting to sync.` : ''}
            {q.online && q.count > 0 && <button type="button" onClick={() => void q.flush()} className="ml-auto min-h-9 font-medium underline">{q.syncing ? 'Syncing...' : 'Sync now'}</button>}
          </p>
        )}
      </header>

      <main className="flex-1 space-y-5 px-4 pb-32 pt-4">
        {data.error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose/25 bg-rose-soft/70 p-3 text-sm text-rose"><WarningCircle size={20} className="mt-0.5 shrink-0" /><div className="flex-1"><p>{data.error}</p><button type="button" onClick={data.reload} className="mt-1 min-h-11 font-medium underline">Try again</button></div></div>
        )}
        {data.loading && !data.data && <p className="py-10 text-center font-mono text-xs uppercase tracking-widest text-ink-soft" role="status">Loading your stops...</p>}
        {data.data && shown.length === 0 && (
          <div className="py-14 text-center">
            <Truck size={36} className="mx-auto text-ink-soft/60" aria-hidden />
            <p className="mt-3 font-display text-3xl">{tab === 'todo' ? (orders.length ? 'All done for today' : 'No stops yet') : 'Nothing finished yet'}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">{orders.length ? 'Nice work.' : 'Deliveries assigned to you for today will appear here. Pull the refresh button when the shop assigns more.'}</p>
          </div>
        )}
        {slotIds.map((sid) => (
          <section key={sid} aria-label={slotLabel(sid)}>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">{slotLabel(sid)} / {shown.filter((o) => o.slot_id === sid).length}</h2>
            <ul className="space-y-3">
              {shown.filter((o) => o.slot_id === sid).map((o) => <StopCard key={o.id} o={o} items={summary(o.id)} queued={q.pending.has(o.id)} onOut={() => set(o, 'out_for_delivery')} onDelivered={() => set(o, 'delivered')} onFailed={() => setFailFor(o)} />)}
            </ul>
          </section>
        ))}
      </main>

      <nav aria-label="Delivery actions" className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-xl items-stretch gap-2 border-t border-ink/10 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div role="tablist" aria-label="Show" className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-ink/5 p-1">
          {([['todo', `To do ${todo.length}`], ['done', `Done ${done.length}`]] as const).map(([id, label]) => (
            <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} className={clsx('min-h-12 rounded-lg text-sm font-medium', tab === id ? 'bg-white shadow-sm' : 'text-ink-soft')}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={() => { data.reload(); void q.flush() }} aria-label="Refresh stops" className="grid min-h-12 w-14 place-items-center rounded-xl bg-ink text-cream active:scale-95 motion-reduce:active:scale-100">
          <ArrowClockwise size={22} className={clsx(data.loading && 'animate-spin motion-reduce:animate-none')} />
        </button>
      </nav>

      {failFor && <FailSheet order={failFor} onClose={() => setFailFor(null)} onConfirm={(reason) => { set(failFor, 'failed', reason); setFailFor(null) }} />}
    </div>
  )
}

function StopCard({ o, items, queued, onOut, onDelivered, onFailed }: { o: Order; items: string; queued: boolean; onOut: () => void; onDelivered: () => void; onFailed: () => void }) {
  const a = o.address
  const big = 'flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-base font-medium active:scale-[0.98] motion-reduce:active:scale-100'
  const link = 'grid min-h-12 flex-1 place-items-center rounded-xl border border-ink/15 bg-white text-sm font-medium'
  const finished = o.status === 'delivered' || o.status === 'failed'
  return (
    <li className={clsx('rounded-2xl border bg-white p-4', finished ? 'border-ink/10 opacity-80' : 'border-ink/15')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-ink-soft">{o.order_no}</p>
          <h3 className="font-display text-3xl leading-tight">{a.recipient_name}</h3>
        </div>
        <div className="flex flex-col items-end gap-1"><StatusBadge status={o.status} />{queued && <span className="font-mono text-[11px] uppercase text-marigold-deep">Syncing</span>}</div>
      </div>
      <p className="mt-2 text-base">{addressLine(a, false)}</p>
      {a.landmark && <p className="mt-1 text-sm text-ink-soft">Landmark: {a.landmark}</p>}
      {a.instructions && <p className="mt-2 rounded-lg bg-saffron/25 px-3 py-2 text-sm">{a.instructions}</p>}
      {items && <p className="mt-2 text-sm"><span className="text-ink-soft">Carry: </span>{items}</p>}
      {o.gift_note && <p className="mt-1 text-sm italic text-ink-soft">Gift message: "{o.gift_note}"</p>}
      {o.failure_reason && o.status === 'failed' && <p className="mt-2 text-sm text-rose">Reason: {o.failure_reason}</p>}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <a className={link} href={telLink(a.recipient_phone)} aria-label={`Call ${a.recipient_name}`}><span className="flex items-center gap-1.5"><Phone size={18} />Call</span></a>
        <a className={link} href={waLink(a.recipient_phone, `Hello, this is your Phool Ghar delivery for order ${o.order_no}.`)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${a.recipient_name}`}><span className="flex items-center gap-1.5"><ChatCircleText size={18} />Chat</span></a>
        <a className={link} href={mapsLink(a)} target="_blank" rel="noreferrer" aria-label="Open in maps"><span className="flex items-center gap-1.5"><MapPin size={18} />Map</span></a>
      </div>
      {!finished && o.status !== 'cancelled' && (
        <div className="mt-3 flex gap-2">
          {o.status !== 'out_for_delivery' ? (
            <button type="button" onClick={onOut} className={clsx(big, 'border-ink bg-ink text-cream')}><Truck size={20} />Out for delivery</button>
          ) : (
            <>
              <button type="button" onClick={onFailed} className={clsx(big, 'border-rose/40 bg-white text-rose')}><WarningCircle size={20} />Failed</button>
              <button type="button" onClick={onDelivered} className={clsx(big, 'flex-[1.6] border-leaf bg-leaf text-cream')}><CheckCircle size={20} weight="fill" />Delivered</button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function FailSheet({ order, onClose, onConfirm }: { order: Order; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const [other, setOther] = useState('')
  const final = reason === 'Other' ? other.trim() : reason
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Why could it not be delivered?">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-xl rounded-t-3xl bg-cream p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <h2 className="font-display text-3xl">Could not deliver {order.order_no}</h2>
        <p className="text-sm text-ink-soft">Pick a reason. The shop and the customer are told.</p>
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">Reason</legend>
          {[...REASONS, 'Other'].map((r) => (
            <label key={r} className={clsx('flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3', reason === r ? 'border-ink bg-white' : 'border-ink/15 bg-white/60')}>
              <input type="radio" name="reason" className="h-5 w-5 accent-[#1f3d2b]" checked={reason === r} onChange={() => setReason(r)} />{r}
            </label>
          ))}
        </fieldset>
        {reason === 'Other' && (
          <div className="mt-2"><label htmlFor="other-reason" className="mb-1 block text-sm">Describe what happened</label><input id="other-reason" autoFocus value={other} onChange={(e) => setOther(e.target.value)} className="min-h-12 w-full rounded-xl border border-ink/20 bg-white px-3" /></div>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-xl border border-ink/20 bg-white font-medium">Back</button>
          <button type="button" disabled={!final} onClick={() => onConfirm(final)} className="min-h-12 flex-[1.4] rounded-xl bg-rose font-medium text-white disabled:opacity-40">Mark as failed</button>
        </div>
      </div>
    </div>
  )
}
