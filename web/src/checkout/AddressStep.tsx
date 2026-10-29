import { Plus } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { AddressForm, blankAddress, usePincode, PinStatus } from '../account/AddressForm'
import { AddressLine } from '../account/Addresses'
import { useAuth } from '../auth/useAuth'
import { friendlyError, listAddresses, saveAddress, checkPincode, type Address, type AddressInput } from '../lib/api'
import { Alert, Button, ErrorState, SkeletonList } from '../lib/ui'
import type { AddressValue } from './types'

const snap = (a: AddressInput | Address) => ({
  recipient_name: a.recipient_name, recipient_phone: a.recipient_phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, pincode: a.pincode, instructions: a.instructions,
})

export function AddressStep({ value, onDone }: { value: AddressValue | null; onDone: (v: AddressValue) => void }) {
  const { user, profile } = useAuth()
  const [list, setList] = useState<Address[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sel, setSel] = useState<string | 'new'>(value?.id ?? 'new')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    listAddresses().then((l) => {
      if (!alive) return
      setList(l)
      setSel((cur) => (cur !== 'new' && l.some((a) => a.id === cur) ? cur : l.find((a) => a.is_default)?.id ?? l[0]?.id ?? 'new'))
    }).catch((e) => alive && setError(friendlyError(e)))
    return () => { alive = false }
  }, [reload])

  const chosen = list?.find((a) => a.id === sel)
  const pin = usePincode(chosen?.pincode ?? '')
  const [contErr, setContErr] = useState<string | null>(null)

  if (error) return <ErrorState message={error} onRetry={() => { setError(null); setReload((n) => n + 1) }} />
  if (!list) return <SkeletonList rows={2} />

  async function useNew(a: AddressInput, save: boolean) {
    const info = await checkPincode(a.pincode)
    if (!info.ok) throw new Error('We do not deliver to this pincode yet.')
    let id: string | undefined
    if (save && user) id = (await saveAddress(a, user.id)).id
    onDone({ id, snapshot: snap(a), pincode: a.pincode, feePaise: info.fee_paise, label: a.label ?? 'Address' })
  }

  return (
    <div>
      {list.length > 0 && (
        <div role="radiogroup" aria-label="Delivery address" className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={sel === a.id} onClick={() => setSel(a.id)}
              className={`rounded-3xl border p-5 text-left transition ${sel === a.id ? 'border-ink bg-white ring-1 ring-ink' : 'border-ink/15 bg-white hover:border-ink/40'}`}>
              <span className="flex items-center gap-2 text-sm font-medium">{a.label || 'Address'}{a.is_default && <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xs text-leaf">Default</span>}</span>
              <span className="mt-2 block text-sm">{a.recipient_name} <span className="text-ink-soft">{a.recipient_phone}</span></span>
              <span className="mt-1 block text-sm text-ink-soft"><AddressLine a={a} /></span>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={sel === 'new'} onClick={() => setSel('new')}
            className={`flex min-h-24 items-center justify-center gap-2 rounded-3xl border border-dashed p-5 text-sm font-medium transition ${sel === 'new' ? 'border-ink bg-white' : 'border-ink/25 hover:border-ink/50'}`}>
            <Plus size={16} aria-hidden />Deliver somewhere else, or as a gift
          </button>
        </div>
      )}

      {sel !== 'new' && chosen && (
        <div className="mt-6">
          <PinStatus state={pin} />
          {contErr && <div className="mt-3"><Alert>{contErr}</Alert></div>}
          <Button className="mt-5" disabled={pin.status !== 'ok'} onClick={() => {
            if (pin.status !== 'ok') return setContErr('We could not confirm delivery to this pincode.')
            onDone({ id: chosen.id, snapshot: snap(chosen), pincode: chosen.pincode, feePaise: pin.info.fee_paise, label: chosen.label ?? 'Address' })
          }}>Deliver here</Button>
        </div>
      )}

      {sel === 'new' && (
        <div className={list.length ? 'mt-8 rounded-3xl border border-ink/10 bg-white p-6' : ''}>
          {list.length === 0 && <p className="mb-5 text-sm text-ink-soft">Where should we deliver? For a gift, enter the recipient's name and number.</p>}
          <AddressForm initial={blankAddress(profile?.full_name ?? '', profile?.phone ?? '')} submitLabel="Deliver here" showSaveToggle onSubmit={useNew}
            recipientHint="Sending a gift? Use the recipient's details." />
        </div>
      )}
    </div>
  )
}
