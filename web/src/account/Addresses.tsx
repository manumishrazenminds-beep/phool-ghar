import { MapPin, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { deleteAddress, friendlyError, listAddresses, saveAddress, setDefaultAddress, type Address } from '../lib/api'
import { Alert, Button, EmptyState, ErrorState, Modal, SkeletonList } from '../lib/ui'
import { AddressForm, blankAddress } from './AddressForm'

export function AddressLine({ a }: { a: { line1?: string; line2?: string | null; landmark?: string | null; city?: string; pincode?: string } }) {
  return <>{[a.line1, a.line2, a.landmark, a.city].filter(Boolean).join(', ')} {a.pincode}</>
}

export function Addresses() {
  const { user, profile } = useAuth()
  const [items, setItems] = useState<Address[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Address | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<Address | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setError(null)
    listAddresses().then(setItems).catch((e) => setError(friendlyError(e)))
  }, [])
  useEffect(load, [load])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!items) return <SkeletonList rows={2} />

  async function remove() {
    if (!toDelete || busy) return
    setBusy(true); setActionErr(null)
    try { await deleteAddress(toDelete.id); setToDelete(null); load() } catch (e) { setActionErr(friendlyError(e)) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-3xl">Saved addresses</h2>
        <Button onClick={() => setEditing('new')}><Plus size={16} aria-hidden />Add address</Button>
      </div>
      {actionErr && <div className="mt-4"><Alert>{actionErr}</Alert></div>}
      {items.length === 0 ? (
        <div className="mt-6"><EmptyState title="No addresses yet" body="Add the places you send flowers to. Temples, shops and gifts included." action={<Button onClick={() => setEditing('new')}>Add your first address</Button>} /></div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {items.map((a) => (
            <li key={a.id} className="flex flex-col rounded-3xl border border-ink/10 bg-white p-5">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-marigold" aria-hidden />
                <span className="font-medium">{a.label || 'Address'}</span>
                {a.is_default && <span className="rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-medium text-leaf">Default</span>}
              </div>
              <p className="mt-3 text-sm">{a.recipient_name} <span className="text-ink-soft">{a.recipient_phone}</span></p>
              <p className="mt-1 flex-1 text-sm text-ink-soft"><AddressLine a={a} /></p>
              <div className="mt-4 flex flex-wrap gap-1">
                <Button variant="quiet" className="!px-3" onClick={() => setEditing(a)}><PencilSimple size={16} aria-hidden />Edit</Button>
                {!a.is_default && user && <Button variant="quiet" className="!px-3" onClick={() => setDefaultAddress(a.id, user.id).then(load).catch((e) => setActionErr(friendlyError(e)))}>Make default</Button>}
                <Button variant="quiet" className="!px-3 text-rose" onClick={() => setToDelete(a)}><Trash size={16} aria-hidden />Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New address' : 'Edit address'}>
        {editing && user && (
          <AddressForm
            initial={editing === 'new' ? { ...blankAddress(profile?.full_name ?? '', profile?.phone ?? ''), is_default: items.length === 0 } : editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (a) => { await saveAddress(editing === 'new' ? { ...a, id: undefined } : { ...a, id: editing.id }, user.id); setEditing(null); load() }}
          />
        )}
      </Modal>
      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete this address?">
        <p className="text-sm text-ink-soft">Past orders keep their own copy of the address. Active subscriptions are not affected.</p>
        <div className="mt-6 flex gap-3"><Button variant="danger" loading={busy} onClick={remove}>Delete</Button><Button variant="ghost" onClick={() => setToDelete(null)}>Keep it</Button></div>
      </Modal>
    </div>
  )
}
