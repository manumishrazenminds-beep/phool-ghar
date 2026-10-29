import { DownloadSimple, Printer, ChatCircleText, Phone, MapPin } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { addressLine, downloadCsv, fmtDate, mapsLink, telLink, todayISO, waLink } from '../format'
import { useDeliveryStaff, useSlots } from '../lookups'
import { useApi } from '../mode'
import { useQuery } from '../useQuery'
import type { DeliveryRow } from '../types'
import { Button, EmptyState, ErrorBanner, PageHeader, Panel, SelectField, Skeleton, StatusBadge, TextField, Toolbar, useToast } from '../ui'

/** todays_delivery_list's column set is owned by the DB builder; accept flat columns or an embedded address object. */
function normaliseRow(raw: Record<string, unknown>): DeliveryRow {
  const a = (raw.address ?? {}) as Record<string, string>
  const s = (k: string) => String(raw[k] ?? a[k] ?? '')
  return {
    order_id: String(raw.order_id ?? raw.id ?? ''), order_no: s('order_no'), kind: (raw.kind as DeliveryRow['kind']) ?? 'one_time', slot_id: s('slot_id'),
    status: (raw.status as DeliveryRow['status']) ?? 'placed', payment_status: (raw.payment_status as DeliveryRow['payment_status']) ?? null,
    assigned_to: (raw.assigned_to as string | null) ?? null, assigned_name: (raw.assigned_name as string | null) ?? null,
    recipient_name: s('recipient_name'), recipient_phone: s('recipient_phone'), line1: s('line1'), line2: s('line2'), landmark: s('landmark'), city: s('city'),
    area: s('area') || s('line2') || s('pincode') || 'Other', pincode: s('pincode'), instructions: s('instructions'), gift_note: s('gift_note'),
    items_summary: s('items_summary') || s('items'), total_paise: Number(raw.total_paise ?? 0),
  }
}

export default function Today() {
  const api = useApi()
  const { run } = useToast()
  const [date, setDate] = useState(todayISO())
  const [slotF, setSlotF] = useState('')
  const [assignF, setAssignF] = useState('')
  const [statusF, setStatusF] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [bulkStaff, setBulkStaff] = useState('')
  const { slots, label } = useSlots()
  const { staff } = useDeliveryStaff()
  const q = useQuery(async () => {
    const raw = await api.rpc<Record<string, unknown>[] | null>('todays_delivery_list', { p_date: date })
    return (raw ?? []).map(normaliseRow)
  }, [date])
  const rows = useMemo(() => (q.data ?? []).filter((r) =>
    (!slotF || r.slot_id === slotF) && (!statusF || r.status === statusF) &&
    (!assignF || (assignF === 'none' ? !r.assigned_to : r.assigned_to === assignF))), [q.data, slotF, statusF, assignF])

  const grouped = useMemo(() => {
    const m = new Map<string, Map<string, DeliveryRow[]>>()
    for (const r of rows) {
      const sl = m.get(r.slot_id) ?? new Map<string, DeliveryRow[]>()
      sl.set(r.area, [...(sl.get(r.area) ?? []), r])
      m.set(r.slot_id, sl)
    }
    const order = slots.map((s) => s.id)
    return [...m.entries()].sort((a, b) => (order.indexOf(a[0]) + 99) % 99 - (order.indexOf(b[0]) + 99) % 99)
  }, [rows, slots])

  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? (id ? 'Assigned' : 'Unassigned')
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const assign = async (orderId: string, staffId: string) => { if (await run(() => api.rpc('assign_order', { p_order: orderId, p_staff: staffId || null }))) q.reload() }
  const assignSelected = async () => {
    if (!bulkStaff || !sel.size) return
    const ok = await run(async () => { for (const id of sel) await api.rpc('assign_order', { p_order: id, p_staff: bulkStaff }); return true }, `Assigned ${sel.size} orders`)
    if (ok) { setSel(new Set()); q.reload() }
  }
  const assignSlot = async (slot: string) => {
    if (!bulkStaff) return
    const n = await run(() => api.rpc<number>('bulk_assign_orders', { p_date: date, p_slot: slot, p_staff: bulkStaff }), `Assigned the ${label(slot)} slot`)
    if (n !== undefined) q.reload()
  }
  const exportCsv = () => downloadCsv(`deliveries-${date}.csv`, rows.map((r) => ({
    slot: label(r.slot_id), area: r.area, order_no: r.order_no, type: r.kind, status: r.status, recipient: r.recipient_name, phone: r.recipient_phone,
    address: addressLine(r), instructions: r.instructions, gift_note: r.gift_note, items: r.items_summary, assigned_to: r.assigned_name ?? staffName(r.assigned_to),
  })))

  return (
    <>
      <PageHeader eyebrow={fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} title="Delivery list"
        actions={<><Button onClick={exportCsv} icon={<DownloadSimple size={16} />} disabled={!rows.length}>CSV</Button><Button onClick={() => window.print()} icon={<Printer size={16} />} disabled={!rows.length}>Print</Button></>}>
        One-time orders and subscription deliveries together, grouped by slot and area.
      </PageHeader>
      <Toolbar>
        <TextField label="Date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setSel(new Set()) }} />
        <SelectField label="Slot" value={slotF} onChange={(e) => setSlotF(e.target.value)}><option value="">All slots</option>{slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</SelectField>
        <SelectField label="Delivery person" value={assignF} onChange={(e) => setAssignF(e.target.value)}><option value="">Everyone</option><option value="none">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</SelectField>
        <SelectField label="Status" value={statusF} onChange={(e) => setStatusF(e.target.value)}><option value="">Any</option>{['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'failed'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</SelectField>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <SelectField label="Assign to" value={bulkStaff} onChange={(e) => setBulkStaff(e.target.value)}><option value="">Pick a person</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</SelectField>
          <Button variant="primary" disabled={!bulkStaff || !sel.size} onClick={() => void assignSelected()}>Assign {sel.size || ''} selected</Button>
        </div>
      </Toolbar>

      {q.error && <ErrorBanner message={q.error} onRetry={q.reload} />}
      {q.loading && !q.data && <Skeleton rows={6} />}
      {q.data && rows.length === 0 && <Panel><EmptyState title="No deliveries match">Nothing is scheduled for this date and filter. Subscription deliveries are created at 9 pm the evening before.</EmptyState></Panel>}

      <div className="space-y-5">
        {grouped.map(([slot, areas]) => {
          const count = [...areas.values()].reduce((s, l) => s + l.length, 0)
          return (
            <Panel key={slot} pad={false} title={`${label(slot)} / ${count} stop${count > 1 ? 's' : ''}`}
              actions={<Button size="sm" className="print:hidden" disabled={!bulkStaff} onClick={() => void assignSlot(slot)} title={bulkStaff ? '' : 'Pick a person in "Assign to" first'}>Assign whole slot</Button>}>
              {[...areas.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([area, list]) => (
                <div key={area}>
                  <p className="border-y border-ink/5 bg-cream-2/50 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft first:border-t-0">{area} / {list.length}</p>
                  <ul className="divide-y divide-ink/5">
                    {list.map((r) => <Stop key={r.order_id} r={r} checked={sel.has(r.order_id)} onToggle={() => toggle(r.order_id)} staff={staff} staffName={staffName} onAssign={(id) => void assign(r.order_id, id)} />)}
                  </ul>
                </div>
              ))}
            </Panel>
          )
        })}
      </div>
    </>
  )
}

function Stop({ r, checked, onToggle, staff, staffName, onAssign }: { r: DeliveryRow; checked: boolean; onToggle: () => void; staff: { id: string; full_name: string | null }[]; staffName: (id: string | null) => string; onAssign: (id: string) => void }) {
  const locked = r.status === 'delivered' || r.status === 'failed'
  const link = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink/15 hover:bg-cream-2/60 pointer-coarse:h-11 pointer-coarse:w-11'
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[auto_1fr_auto_auto] md:items-center">
      <input type="checkbox" aria-label={`Select ${r.order_no}`} checked={checked} onChange={onToggle} className="mt-1 h-4 w-4 accent-[#1f3d2b] print:hidden" />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm"><span className="font-mono text-xs">{r.order_no}</span><b>{r.recipient_name}</b><StatusBadge status={r.kind} /><StatusBadge status={r.status} /></p>
        <p className="mt-0.5 text-sm text-ink-soft">{addressLine(r)}</p>
        {r.items_summary && <p className="text-sm">{r.items_summary}</p>}
        {r.instructions && <p className="text-xs italic text-ink-soft">Note: {r.instructions}</p>}
        {r.gift_note && <p className="text-xs italic text-ink-soft">Gift message: {r.gift_note}</p>}
      </div>
      <div className="col-span-2 flex items-center gap-2 md:col-span-1 print:hidden">
        <select aria-label={`Delivery person for ${r.order_no}`} value={r.assigned_to ?? ''} disabled={locked} onChange={(e) => onAssign(e.target.value)} className="min-h-9 min-w-36 rounded-lg border border-ink/15 bg-white px-2 text-sm pointer-coarse:min-h-11">
          <option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>
      <p className="hidden text-sm print:block">Rider: {staffName(r.assigned_to)}</p>
      <div className="col-span-2 flex gap-1.5 md:col-span-1 print:hidden">
        {r.recipient_phone && <a className={link} href={telLink(r.recipient_phone)} aria-label={`Call ${r.recipient_name}`}><Phone size={16} /></a>}
        {r.recipient_phone && <a className={link} href={waLink(r.recipient_phone, `Hello from Phool Ghar about order ${r.order_no}.`)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${r.recipient_name}`}><ChatCircleText size={16} /></a>}
        <a className={link} href={mapsLink(r)} target="_blank" rel="noreferrer" aria-label={`Map for ${r.order_no}`}><MapPin size={16} /></a>
      </div>
    </li>
  )
}
