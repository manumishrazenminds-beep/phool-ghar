import { Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { fmtDate } from '../format'
import { useApi } from '../mode'
import { useQuery } from '../useQuery'
import { ALL_PERMS, type Profile } from '../types'
import { Button, ConfirmDialog, Drawer, EmptyState, ErrorBanner, PageHeader, Panel, SelectField, StatusBadge, Table, TextField, useToast } from '../ui'

type Draft = { id?: string; full_name: string; email: string; phone: string; role: 'staff' | 'delivery'; permissions: string[]; password: string }

export default function Team() {
  const api = useApi()
  const q = useQuery(async () => (await api.fn<{ members: Profile[] }>('team-admin', { op: 'list' })).members, [])
  const [edit, setEdit] = useState<Draft | null>(null)
  return (
    <>
      <PageHeader eyebrow="Store" title="Team" actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ full_name: '', email: '', phone: '', role: 'staff', permissions: ['orders'], password: '' })}>Add team member</Button>}>
        Sub-admins see only the sections you tick. Delivery staff see only their own deliveries in the delivery app. Only you, the owner, can see this page.
      </PageHeader>
      <Table caption="Team members" rows={q.data} loading={q.loading} error={q.error} onRetry={q.reload} rowKey={(p) => p.id}
        onRowClick={(p) => p.role !== 'admin' && setEdit({ id: p.id, full_name: p.full_name ?? '', email: p.email ?? '', phone: p.phone ?? '', role: p.role as 'staff' | 'delivery', permissions: p.permissions, password: '' })}
        empty={<EmptyState title="Just you so far">Add a sub-admin to share the work, or a delivery person to give them the delivery app.</EmptyState>}
        columns={[
          { key: 'n', header: 'Name', cell: (p) => <span><b className="font-medium">{p.full_name ?? 'Unnamed'}</b><span className="block text-xs text-ink-soft">{p.email}</span></span> },
          { key: 'r', header: 'Role', cell: (p) => <StatusBadge status={p.role} label={p.role === 'admin' ? 'Owner' : p.role === 'staff' ? 'Sub-admin' : 'Delivery'} /> },
          { key: 'p', header: 'Can manage', hideOnSmall: true, cell: (p) => p.role === 'admin' ? 'Everything' : p.role === 'delivery' ? 'Own deliveries' : p.permissions.length ? p.permissions.join(', ') : 'Nothing yet' },
          { key: 'j', header: 'Added', hideOnSmall: true, cell: (p) => fmtDate(p.created_at) },
          { key: 's', header: 'Status', cell: (p) => <StatusBadge status={p.active ? 'active' : 'paused'} label={p.active ? 'Active' : 'Deactivated'} /> },
        ]} />
      {edit && <MemberDrawer init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload() }} active={q.data?.find((m) => m.id === edit.id)?.active ?? true} />}
    </>
  )
}

function MemberDrawer({ init, active, onClose, onSaved }: { init: Draft; active: boolean; onClose: () => void; onSaved: () => void }) {
  const api = useApi()
  const { run, toast } = useToast()
  const [d, setD] = useState(init)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | 'deactivate' | 'reset'>(null)
  const [newPw, setNewPw] = useState('')
  const isNew = !d.id
  const errors: string[] = []
  if (d.full_name.trim().length < 2) errors.push('Enter a name.')
  if (isNew && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errors.push('Enter a valid email address.')
  if (d.password && d.password.length < 10) errors.push('A password needs at least 10 characters (or leave it blank to email an invite link).')
  const toggle = (p: string) => setD({ ...d, permissions: d.permissions.includes(p) ? d.permissions.filter((x) => x !== p) : [...d.permissions, p] })

  const save = async () => {
    setBusy(true)
    const body = isNew
      ? { op: 'create', full_name: d.full_name.trim(), email: d.email.trim(), phone: d.phone || undefined, role: d.role, permissions: d.role === 'staff' ? d.permissions : [], password: d.password || undefined }
      : { op: 'update', id: d.id, full_name: d.full_name.trim(), phone: d.phone || null, role: d.role, permissions: d.role === 'staff' ? d.permissions : [] }
    const r = await run(() => api.fn<{ invite_sent?: boolean }>('team-admin', body))
    setBusy(false)
    if (r !== undefined) { toast(isNew ? (d.password ? 'Account created with the password you set.' : r.invite_sent ? 'Account created. A sign-in link was emailed.' : 'Account created, but the invite email could not be queued. Use Reset password.') : 'Changes saved.'); onSaved() }
  }
  const op = async (body: Record<string, unknown>, ok: string) => { setBusy(true); const r = await run(() => api.fn('team-admin', body), ok); setBusy(false); setConfirm(null); if (r !== undefined) onSaved() }

  return (
    <>
      <Drawer open onClose={onClose} eyebrow={isNew ? 'New team member' : 'Team member'} title={d.full_name || 'Name'}
        footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" disabled={busy || errors.length > 0} onClick={() => void save()}>{isNew ? 'Create account' : 'Save changes'}</Button></>}>
        <div className="space-y-4">
          {errors.length > 0 && (d.full_name || d.email || d.password) && <ErrorBanner message={errors.join(' ')} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Full name" required value={d.full_name} onChange={(e) => setD({ ...d, full_name: e.target.value })} />
            <TextField label="Email" type="email" required disabled={!isNew} value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} hint={isNew ? undefined : 'Email cannot be changed.'} />
            <TextField label="Phone" type="tel" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
            <SelectField label="Role" value={d.role} onChange={(e) => setD({ ...d, role: e.target.value as Draft['role'] })}><option value="staff">Sub-admin (picks what they can manage)</option><option value="delivery">Delivery person</option></SelectField>
          </div>
          {isNew && <TextField label="Password (optional)" type="password" autoComplete="new-password" value={d.password} onChange={(e) => setD({ ...d, password: e.target.value })} hint="Leave blank and they get an email link to set their own password." />}
          {d.role === 'staff' ? (
            <Panel title="What can they manage?">
              <fieldset><legend className="sr-only">Permissions</legend>
                <ul className="space-y-1">{ALL_PERMS.map((p) => (
                  <li key={p.id}><label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-cream-2/50">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[#1f3d2b]" checked={d.permissions.includes(p.id)} onChange={() => toggle(p.id)} />
                    <span className="text-sm"><b className="font-medium">{p.label}</b><span className="block text-xs text-ink-soft">{p.hint}</span></span>
                  </label></li>
                ))}</ul>
              </fieldset>
            </Panel>
          ) : <p className="rounded-lg bg-cream-2/60 p-3 text-sm">Delivery people sign in at <span className="font-mono">/delivery</span> and see only the orders assigned to them.</p>}
          {!isNew && (
            <Panel title="Account">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setConfirm('reset')}>Reset password</Button>
                {active ? <Button variant="danger" onClick={() => setConfirm('deactivate')}>Deactivate</Button> : <Button variant="leaf" onClick={() => void op({ op: 'reactivate', id: d.id }, 'Account reactivated')}>Reactivate</Button>}
              </div>
            </Panel>
          )}
        </div>
      </Drawer>
      <ConfirmDialog open={confirm === 'deactivate'} danger title={`Deactivate ${d.full_name}?`} confirmLabel="Deactivate" busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void op({ op: 'deactivate', id: d.id }, 'Account deactivated')}>
        They are signed out and cannot sign in again until you reactivate them. Their past work stays in the records.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'reset'} title="Reset password" confirmLabel={newPw ? 'Set this password' : 'Email a reset link'} busy={busy || (!!newPw && newPw.length < 10)} onCancel={() => { setConfirm(null); setNewPw('') }} onConfirm={() => void op({ op: 'reset_password', id: d.id, password: newPw || undefined }, newPw ? 'Password set' : 'Reset link emailed')}>
        <TextField label="New password (optional)" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} hint="Leave blank to email them a link instead. At least 10 characters." />
      </ConfirmDialog>
    </>
  )
}
