import { Plus } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { rupees } from '../format'
import { useSlots, useZones } from '../lookups'
import { useApi } from '../mode'
import { useSettings } from '../settings'
import type { Slot, Zone } from '../types'
import { Button, ConfirmDialog, Drawer, EmptyState, ErrorBanner, PageHeader, Panel, StatusBadge, Table, TextField, Toggle, useToast } from '../ui'

export default function DeliverySettings() {
  return (
    <>
      <PageHeader eyebrow="Store" title="Delivery settings">Where you deliver, when, how many per slot, and when ordering closes.</PageHeader>
      <div className="space-y-6">
        <Rules />
        <Slots />
        <Zones />
      </div>
    </>
  )
}

function Rules() {
  const { run } = useToast()
  const s = useSettings()
  const [cutoff, setCutoff] = useState('21:00')
  const [free, setFree] = useState(true)
  const [min, setMin] = useState('')
  useEffect(() => {
    if (!s.data) return
    setCutoff(String(s.values.cutoff_time ?? '21:00')); setFree(s.values.free_delivery_for_subscription !== false); setMin(s.values.min_order_paise != null ? String(Number(s.values.min_order_paise) / 100) : '')
  }, [s.data]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Panel title="Ordering rules" actions={<Button variant="primary" size="sm" onClick={() => void run(() => s.save({ cutoff_time: cutoff, free_delivery_for_subscription: free, min_order_paise: Math.round(Number(min || 0) * 100) }), 'Rules saved')}>Save rules</Button>}>
      {s.error && <ErrorBanner message={s.error} onRetry={s.reload} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Cut-off time (India time)" type="time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} hint="Skips, pauses and changes for tomorrow must be made before this." />
        <TextField label="Minimum order (rupees)" type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)} />
        <Toggle label="Free delivery for subscriptions" checked={free} onChange={setFree} />
      </div>
    </Panel>
  )
}

function Slots() {
  const slots = useSlots()
  const [edit, setEdit] = useState<{ s: Slot; isNew: boolean } | null>(null)
  return (
    <section>
      <div className="mb-2 flex items-center justify-between"><h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">Delivery slots</h2>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit({ isNew: true, s: { id: '', label: '', start_time: '06:00', end_time: '08:00', capacity: 30, subscription_ok: true, active: true, sort: slots.slots.length + 1 } })}>Add slot</Button></div>
      <Table caption="Delivery slots" rows={slots.data} loading={slots.loading} error={slots.error} onRetry={slots.reload} rowKey={(s) => s.id} onRowClick={(s) => setEdit({ s, isNew: false })}
        empty={<EmptyState title="No slots">Add at least one slot or customers cannot check out.</EmptyState>}
        columns={[
          { key: 'l', header: 'Slot', cell: (s) => <span><b className="font-medium">{s.label}</b><span className="block font-mono text-xs text-ink-soft">{s.id}</span></span> },
          { key: 't', header: 'Time', cell: (s) => `${s.start_time.slice(0, 5)} to ${s.end_time.slice(0, 5)}` },
          { key: 'c', header: 'Capacity / day', align: 'right', cell: (s) => s.capacity },
          { key: 'u', header: 'Subscriptions', hideOnSmall: true, cell: (s) => s.subscription_ok ? 'Allowed' : 'One-time only' },
          { key: 'a', header: 'Status', cell: (s) => <StatusBadge status={s.active ? 'active' : 'paused'} label={s.active ? 'Active' : 'Off'} /> },
        ]} />
      {edit && <SlotDrawer init={edit.s} isNew={edit.isNew} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); slots.reload() }} />}
    </section>
  )
}
function SlotDrawer({ init, isNew, onClose, onSaved }: { init: Slot; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const api = useApi()
  const { run } = useToast()
  const [s, setS] = useState(init)
  const bad = !/^[a-z0-9_]+$/.test(s.id) || !s.label.trim() || !(s.capacity >= 0)
  return (
    <Drawer open onClose={onClose} eyebrow={isNew ? 'New slot' : 'Edit slot'} title={s.label || 'Slot'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={bad} onClick={async () => { if (await run(async () => { await api.upsert('delivery_slots', s, 'id'); return true }, 'Slot saved')) onSaved() }}>Save</Button></>}>
      <div className="space-y-3">
        <TextField label="Id (lowercase, no spaces)" disabled={!isNew} value={s.id} onChange={(e) => setS({ ...s, id: e.target.value.toLowerCase() })} hint={isNew ? 'For example early, morning, evening. Cannot change later.' : undefined} />
        <TextField label="Label shown to customers" value={s.label} onChange={(e) => setS({ ...s, label: e.target.value })} placeholder="6:30 to 8:00 AM" />
        <div className="grid grid-cols-2 gap-3"><TextField label="Starts" type="time" value={s.start_time.slice(0, 5)} onChange={(e) => setS({ ...s, start_time: e.target.value })} /><TextField label="Ends" type="time" value={s.end_time.slice(0, 5)} onChange={(e) => setS({ ...s, end_time: e.target.value })} /></div>
        <TextField label="Capacity per day (orders)" type="number" min="0" value={s.capacity} onChange={(e) => setS({ ...s, capacity: Number(e.target.value) })} />
        <TextField label="Sort order" type="number" value={s.sort} onChange={(e) => setS({ ...s, sort: Number(e.target.value) })} />
        <Toggle label="Allow subscriptions in this slot" checked={s.subscription_ok} onChange={(v) => setS({ ...s, subscription_ok: v })} />
        <Toggle label="Active" checked={s.active} onChange={(v) => setS({ ...s, active: v })} />
      </div>
    </Drawer>
  )
}

function Zones() {
  const api = useApi()
  const { run } = useToast()
  const zones = useZones()
  const [edit, setEdit] = useState<{ z: Zone; isNew: boolean } | null>(null)
  const [del, setDel] = useState<Zone | null>(null)
  return (
    <section>
      <div className="mb-2 flex items-center justify-between"><h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">Delivery zones by pincode</h2>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit({ isNew: true, z: { pincode: '', city: '', area: '', fee_paise: 0, active: true } })}>Add pincode</Button></div>
      <Table caption="Delivery zones" rows={zones.data} loading={zones.loading} error={zones.error} onRetry={zones.reload} rowKey={(z) => z.pincode} onRowClick={(z) => setEdit({ z, isNew: false })}
        empty={<EmptyState title="No zones yet">Customers can only order to pincodes listed here.</EmptyState>}
        columns={[
          { key: 'p', header: 'Pincode', cell: (z) => <span className="font-mono">{z.pincode}</span> }, { key: 'a', header: 'Area', cell: (z) => z.area ?? '-' }, { key: 'c', header: 'City', hideOnSmall: true, cell: (z) => z.city ?? '-' },
          { key: 'f', header: 'Delivery fee', align: 'right', cell: (z) => z.fee_paise ? rupees(z.fee_paise) : 'Free' },
          { key: 's', header: 'Status', cell: (z) => <StatusBadge status={z.active ? 'active' : 'paused'} label={z.active ? 'Active' : 'Off'} /> },
        ]} />
      {edit && (
        <Drawer open onClose={() => setEdit(null)} eyebrow={edit.isNew ? 'New zone' : 'Edit zone'} title={edit.z.pincode || 'Pincode'}
          footer={<>{!edit.isNew && <Button variant="danger" className="mr-auto" onClick={() => setDel(edit.z)}>Delete</Button>}<Button onClick={() => setEdit(null)}>Cancel</Button>
            <Button variant="primary" disabled={!/^\d{6}$/.test(edit.z.pincode)} onClick={async () => { if (await run(async () => { await api.upsert('delivery_zones', edit.z, 'pincode'); return true }, 'Zone saved')) { setEdit(null); zones.reload() } }}>Save</Button></>}>
          <div className="space-y-3">
            <TextField label="Pincode (6 digits)" inputMode="numeric" maxLength={6} disabled={!edit.isNew} value={edit.z.pincode} onChange={(e) => setEdit({ ...edit, z: { ...edit.z, pincode: e.target.value.replace(/\D/g, '') } })} />
            <TextField label="Area" value={edit.z.area ?? ''} onChange={(e) => setEdit({ ...edit, z: { ...edit.z, area: e.target.value } })} />
            <TextField label="City" value={edit.z.city ?? ''} onChange={(e) => setEdit({ ...edit, z: { ...edit.z, city: e.target.value } })} />
            <TextField label="Delivery fee (rupees, 0 = free)" type="number" min="0" step="1" value={edit.z.fee_paise / 100} onChange={(e) => setEdit({ ...edit, z: { ...edit.z, fee_paise: Math.round(Number(e.target.value) * 100) } })} />
            <Toggle label="Active" checked={edit.z.active} onChange={(v) => setEdit({ ...edit, z: { ...edit.z, active: v } })} />
          </div>
        </Drawer>
      )}
      <ConfirmDialog open={!!del} danger title={`Delete ${del?.pincode}?`} confirmLabel="Delete" onCancel={() => setDel(null)}
        onConfirm={async () => { if (del && await run(async () => { await api.remove('delivery_zones', { pincode: del.pincode }); return true }, 'Zone deleted')) { setDel(null); setEdit(null); zones.reload() } }}>
        Customers will no longer be able to order to this pincode. Existing orders are not affected. Turn the zone off instead if you may want it back.
      </ConfirmDialog>
    </section>
  )
}
