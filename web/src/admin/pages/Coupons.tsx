import { Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { fmtDate, rupees } from '../format'
import { useApi } from '../mode'
import { useQuery } from '../useQuery'
import type { Coupon } from '../types'
import { Button, Drawer, EmptyState, PageHeader, SelectField, StatusBadge, Table, TextField, Toggle, useToast } from '../ui'

const blank = (): Coupon => ({ code: '', kind: 'percent', value: 10, min_order_paise: 0, max_uses: null, used_count: 0, per_user_limit: 1, valid_from: null, valid_to: null, applies_to: 'all', active: true })
const describe = (c: Coupon) => (c.kind === 'percent' ? `${c.value}% off` : `${rupees(c.value)} off`)

export default function Coupons() {
  const api = useApi()
  const { run } = useToast()
  const q = useQuery(() => api.select<Coupon>('coupons', { order: [{ col: 'created_at', asc: false }] }), [])
  const [edit, setEdit] = useState<{ c: Coupon; isNew: boolean } | null>(null)
  return (
    <>
      <PageHeader eyebrow="Store" title="Coupons" actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ c: blank(), isNew: true })}>New coupon</Button>}>Codes are upper-case. Usage counts update when a payment succeeds.</PageHeader>
      <Table caption="Coupons" rows={q.data} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(c) => c.code} onRowClick={(c) => setEdit({ c, isNew: false })}
        empty={<EmptyState title="No coupons yet">Create a welcome offer or a festival code.</EmptyState>}
        columns={[
          { key: 'c', header: 'Code', cell: (c) => <span className="font-mono text-xs font-semibold">{c.code}</span> },
          { key: 'd', header: 'Discount', cell: (c) => <span>{describe(c)}{c.min_order_paise > 0 && <span className="block text-xs text-ink-soft">min {rupees(c.min_order_paise)}</span>}</span> },
          { key: 'a', header: 'Applies to', hideOnSmall: true, cell: (c) => ({ all: 'Everything', one_time: 'One-time orders', subscription: 'Subscriptions' })[c.applies_to] },
          { key: 'u', header: 'Used', align: 'right', cell: (c) => <span>{c.used_count}{c.max_uses != null ? ` / ${c.max_uses}` : ''}</span> },
          { key: 'v', header: 'Valid', hideOnSmall: true, cell: (c) => <span className="text-xs">{c.valid_from ? fmtDate(c.valid_from, { day: 'numeric', month: 'short' }) : 'Now'} to {c.valid_to ? fmtDate(c.valid_to, { day: 'numeric', month: 'short' }) : 'no end'}</span> },
          { key: 's', header: 'Status', cell: (c) => { const expired = !!c.valid_to && c.valid_to < new Date().toISOString().slice(0, 10); const used = c.max_uses != null && c.used_count >= c.max_uses; return <StatusBadge status={!c.active ? 'paused' : expired || used ? 'cancelled' : 'active'} label={!c.active ? 'Off' : expired ? 'Expired' : used ? 'Used up' : 'Live'} /> } },
          { key: 't', header: 'On', align: 'center', cell: (c) => <span onClick={(e) => e.stopPropagation()}><Toggle compact label={`${c.code} active`} checked={c.active} onChange={async (v) => { if (await run(async () => { await api.update('coupons', { code: c.code }, { active: v }); return true })) q.reload() }} /></span> },
        ]} />
      {edit && <CouponDrawer init={edit.c} isNew={edit.isNew} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload() }} />}
    </>
  )
}

function CouponDrawer({ init, isNew, onClose, onSaved }: { init: Coupon; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const api = useApi()
  const { run } = useToast()
  const [c, setC] = useState(init)
  const [val, setVal] = useState(String(init.kind === 'flat' ? init.value / 100 : init.value))
  const [busy, setBusy] = useState(false)
  const code = c.code.trim().toUpperCase()
  const n = Number(val)
  const err = !/^[A-Z0-9_-]{3,24}$/.test(code) ? 'Use 3 to 24 letters, numbers, - or _.' : !(n > 0) ? 'Enter a discount above zero.' : c.kind === 'percent' && n > 100 ? 'A percentage cannot exceed 100.' : c.valid_from && c.valid_to && c.valid_to < c.valid_from ? 'The end date is before the start date.' : null
  const save = async () => {
    setBusy(true)
    const ok = await run(async () => { await api.upsert('coupons', { ...c, code, value: c.kind === 'flat' ? Math.round(n * 100) : Math.round(n) }, 'code'); return true }, 'Coupon saved')
    setBusy(false)
    if (ok) onSaved()
  }
  return (
    <Drawer open onClose={onClose} eyebrow={isNew ? 'New coupon' : 'Edit coupon'} title={code || 'Coupon'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!err || busy} onClick={() => void save()}>Save coupon</Button></>}>
      <div className="space-y-3">
        <TextField label="Code" disabled={!isNew} value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} error={isNew && c.code && err?.startsWith('Use') ? err : undefined} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Type" value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value as Coupon['kind'] })}><option value="percent">Percent off</option><option value="flat">Flat amount off</option></SelectField>
          <TextField label={c.kind === 'percent' ? 'Percent' : 'Rupees off'} type="number" min="0" value={val} onChange={(e) => setVal(e.target.value)} />
        </div>
        <TextField label="Minimum order (rupees)" type="number" min="0" value={c.min_order_paise / 100} onChange={(e) => setC({ ...c, min_order_paise: Math.round(Number(e.target.value) * 100) })} />
        <SelectField label="Applies to" value={c.applies_to} onChange={(e) => setC({ ...c, applies_to: e.target.value as Coupon['applies_to'] })}><option value="all">Everything</option><option value="one_time">One-time orders only</option><option value="subscription">Subscriptions only</option></SelectField>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Total uses (blank = unlimited)" type="number" min="1" value={c.max_uses ?? ''} onChange={(e) => setC({ ...c, max_uses: e.target.value ? Number(e.target.value) : null })} />
          <TextField label="Uses per customer" type="number" min="1" value={c.per_user_limit} onChange={(e) => setC({ ...c, per_user_limit: Math.max(1, Number(e.target.value)) })} />
          <TextField label="Valid from" type="date" value={c.valid_from?.slice(0, 10) ?? ''} onChange={(e) => setC({ ...c, valid_from: e.target.value || null })} />
          <TextField label="Valid to" type="date" value={c.valid_to?.slice(0, 10) ?? ''} onChange={(e) => setC({ ...c, valid_to: e.target.value || null })} error={err?.startsWith('The end') ? err : undefined} />
        </div>
        <Toggle label="Active" checked={c.active} onChange={(v) => setC({ ...c, active: v })} />
        {!isNew && <p className="rounded-lg bg-cream-2/60 p-3 text-sm">Used <b>{c.used_count}</b> time{c.used_count === 1 ? '' : 's'}{c.max_uses != null ? `, ${Math.max(0, c.max_uses - c.used_count)} left` : ''}.</p>}
      </div>
    </Drawer>
  )
}
