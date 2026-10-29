import { Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { useApi } from '../mode'
import { usePlans } from '../lookups'
import type { PlanPeriod } from '../types'
import { Button, Drawer, EmptyState, PageHeader, Table, TextField, Toggle, useToast } from '../ui'

export default function Plans() {
  const api = useApi()
  const { run } = useToast()
  const q = usePlans()
  const [edit, setEdit] = useState<{ p: PlanPeriod; isNew: boolean } | null>(null)
  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Subscription plans" actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ p: { days: 0, label: '', discount_pct: 0, active: true }, isNew: true })}>New plan</Button>}>
        Plan lengths customers can choose, with an optional discount. Changes apply to new subscriptions only.
      </PageHeader>
      <Table caption="Plan periods" rows={q.data} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(p) => String(p.days)} onRowClick={(p) => setEdit({ p, isNew: false })}
        empty={<EmptyState title="No plans yet">Add 7, 15 and 30 day plans.</EmptyState>}
        columns={[
          { key: 'd', header: 'Days', cell: (p) => <b className="font-medium">{p.days}</b> }, { key: 'l', header: 'Label', cell: (p) => p.label },
          { key: 'x', header: 'Discount', align: 'right', cell: (p) => `${p.discount_pct}%` },
          { key: 'a', header: 'Active', align: 'center', cell: (p) => <span onClick={(e) => e.stopPropagation()}><Toggle compact label={`${p.label} active`} checked={p.active} onChange={async (v) => { if (await run(async () => { await api.update('plan_periods', { days: p.days }, { active: v }); return true })) q.reload() }} /></span> },
        ]} />
      {edit && <PlanDrawer init={edit.p} isNew={edit.isNew} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload() }} />}
    </>
  )
}
function PlanDrawer({ init, isNew, onClose, onSaved }: { init: PlanPeriod; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const api = useApi()
  const { run } = useToast()
  const [p, setP] = useState(init)
  const [busy, setBusy] = useState(false)
  const bad = !(p.days > 0) || !p.label.trim() || p.discount_pct < 0 || p.discount_pct > 90
  return (
    <Drawer open onClose={onClose} eyebrow={isNew ? 'New plan' : 'Edit plan'} title={p.label || 'Plan'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={bad || busy} onClick={async () => { setBusy(true); const ok = await run(async () => { await api.upsert('plan_periods', p, 'days'); return true }, 'Plan saved'); setBusy(false); if (ok) onSaved() }}>Save</Button></>}>
      <div className="space-y-3">
        <TextField label="Days" type="number" min="1" disabled={!isNew} value={p.days || ''} onChange={(e) => setP({ ...p, days: Number(e.target.value) })} hint={isNew ? undefined : 'The length cannot change; add a new plan instead.'} />
        <TextField label="Label" value={p.label} onChange={(e) => setP({ ...p, label: e.target.value })} placeholder="Monthly" />
        <TextField label="Discount (percent)" type="number" min="0" max="90" step="0.5" value={p.discount_pct} onChange={(e) => setP({ ...p, discount_pct: Number(e.target.value) })} />
        <Toggle label="Active" checked={p.active} onChange={(v) => setP({ ...p, active: v })} />
      </div>
    </Drawer>
  )
}
