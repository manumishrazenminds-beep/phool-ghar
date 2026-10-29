import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import { checkPincode, friendlyError, normalizeIndianMobile, type AddressInput, type PincodeInfo } from '../lib/api'
import { inrP } from '../lib/pricing'
import { Alert, Button, Field, TextArea } from '../lib/ui'

export type PinState = { status: 'idle' } | { status: 'checking' } | { status: 'ok'; info: PincodeInfo } | { status: 'no' } | { status: 'error'; message: string }

/** Debounced pincode serviceability lookup via the check_pincode RPC. */
export function usePincode(pincode: string): PinState {
  const [state, setState] = useState<PinState>({ status: 'idle' })
  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) { setState({ status: 'idle' }); return }
    let alive = true
    setState({ status: 'checking' })
    const t = setTimeout(() => {
      checkPincode(pincode)
        .then((info) => alive && setState(info.ok ? { status: 'ok', info } : { status: 'no' }))
        .catch((e) => alive && setState({ status: 'error', message: friendlyError(e) }))
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [pincode])
  return state
}

export function PinStatus({ state }: { state: PinState }) {
  if (state.status === 'checking') return <p className="mt-1.5 text-xs text-ink-soft" role="status">Checking delivery to this pincode</p>
  if (state.status === 'ok') return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-leaf" role="status">
      <CheckCircle size={14} weight="fill" aria-hidden />We deliver to {state.info.area ?? state.info.city}. {state.info.fee_paise ? `Delivery ${inrP(state.info.fee_paise)}.` : 'Free delivery.'}
    </p>
  )
  if (state.status === 'no') return <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rose" role="alert"><WarningCircle size={14} weight="fill" aria-hidden />Sorry, we do not deliver to this pincode yet.</p>
  if (state.status === 'error') return <p className="mt-1.5 text-xs text-rose" role="alert">{state.message}</p>
  return null
}

export const blankAddress = (name = '', phone = ''): AddressInput => ({
  label: 'Home', recipient_name: name, recipient_phone: phone, line1: '', line2: '', landmark: '', city: '', pincode: '', instructions: '', is_default: false,
})

interface Props {
  initial: AddressInput
  submitLabel?: string
  /** checkout can offer "save to my addresses" */
  showSaveToggle?: boolean
  onSubmit: (a: AddressInput, save: boolean) => Promise<void> | void
  onCancel?: () => void
  onPin?: (s: PinState) => void
  recipientHint?: string
}

const LABELS = ['Home', 'Office', 'Temple', 'Shop', 'Other']

export function AddressForm({ initial, submitLabel = 'Save address', showSaveToggle, onSubmit, onCancel, onPin, recipientHint }: Props) {
  const [a, setA] = useState<AddressInput>(initial)
  const [save, setSave] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const pin = usePincode(a.pincode)
  useEffect(() => { onPin?.(pin) }, [pin, onPin])
  // fill city from the zone when empty
  useEffect(() => { if (pin.status === 'ok' && !a.city && pin.info.city) setA((p) => ({ ...p, city: pin.info.city ?? '' })) }, [pin, a.city])

  const set = (k: keyof AddressInput) => (e: { target: { value: string } }) => setA((p) => ({ ...p, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const v: Record<string, string> = {}
    if (a.recipient_name.trim().length < 2) v.recipient_name = 'Please enter the recipient name.'
    if (!normalizeIndianMobile(a.recipient_phone.trim())) v.recipient_phone = 'Enter a valid 10-digit mobile number.'
    if (a.line1.trim().length < 4) v.line1 = 'Please enter the house / flat and street.'
    if (!a.city.trim()) v.city = 'Please enter the city.'
    if (!/^\d{6}$/.test(a.pincode)) v.pincode = 'Enter a 6-digit pincode.'
    else if (pin.status === 'no') v.pincode = 'We do not deliver here yet.'
    setErrs(v)
    if (Object.keys(v).length) return
    setBusy(true); setErr(null)
    try { await onSubmit({ ...a, recipient_name: a.recipient_name.trim(), line1: a.line1.trim() }, save) } catch (x) { setErr(friendlyError(x)) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Label</legend>
        <div className="flex flex-wrap gap-2">
          {LABELS.map((l) => (
            <button key={l} type="button" aria-pressed={a.label === l} onClick={() => setA((p) => ({ ...p, label: l }))}
              className={`min-h-11 rounded-full border px-4 text-sm transition ${a.label === l ? 'border-ink bg-ink text-cream' : 'border-ink/15 hover:border-ink/40'}`}>{l}</button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recipient name" autoComplete="name" value={a.recipient_name} onChange={set('recipient_name')} error={errs.recipient_name} hint={recipientHint} />
        <Field label="Recipient mobile" type="tel" autoComplete="tel" value={a.recipient_phone} onChange={set('recipient_phone')} error={errs.recipient_phone} />
      </div>
      <Field label="House / flat, street" autoComplete="address-line1" value={a.line1} onChange={set('line1')} error={errs.line1} />
      <Field label="Area (optional)" autoComplete="address-line2" value={a.line2 ?? ''} onChange={set('line2')} />
      <Field label="Landmark (optional)" value={a.landmark ?? ''} onChange={set('landmark')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Field label="Pincode" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={a.pincode} onChange={(e) => setA((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '') }))} error={errs.pincode} />
          {!errs.pincode && <PinStatus state={pin} />}
        </div>
        <Field label="City" autoComplete="address-level2" value={a.city} onChange={set('city')} error={errs.city} />
      </div>
      <TextArea label="Delivery instructions (optional)" hint="Gate code, where to leave the flowers, a good time to call." value={a.instructions ?? ''} onChange={set('instructions')} />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5 accent-[var(--color-marigold)]" checked={a.is_default} onChange={(e) => setA((p) => ({ ...p, is_default: e.target.checked }))} />
        Make this my default address
      </label>
      {showSaveToggle && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[var(--color-marigold)]" checked={save} onChange={(e) => setSave(e.target.checked)} />
          Save to my address book
        </label>
      )}
      {err && <Alert>{err}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={busy}>{submitLabel}</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  )
}
