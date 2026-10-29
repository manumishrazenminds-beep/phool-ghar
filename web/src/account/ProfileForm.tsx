import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { disablePush, enablePush, pushAvailable } from '../lib/push'
import { friendlyError, updateProfile, type NotifyPrefs } from '../lib/api'
import { Alert, Button, Field } from '../lib/ui'

const CHANNELS: { key: keyof NotifyPrefs; label: string; note?: string; disabled?: boolean }[] = [
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp', note: 'Delivery reminders and updates' },
  { key: 'push', label: 'Browser notifications', note: 'On this device' },
]

export function ProfileForm() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [prefs, setPrefs] = useState<NotifyPrefs>(profile?.notify_prefs ?? { email: true, whatsapp: true, sms: false, push: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function toggle(key: keyof NotifyPrefs, on: boolean) {
    setErr(null)
    if (key === 'push' && user) {
      try {
        if (on) {
          const r = await enablePush(user.id)
          if (r !== 'ok') { setErr(r === 'denied' ? 'Notifications are blocked for this site. Allow them in your browser settings and try again.' : 'Browser notifications are not available on this device.'); return }
        } else await disablePush()
      } catch (x) { setErr(friendlyError(x)); return }
    }
    setPrefs((p) => ({ ...p, [key]: on }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !user) return
    setBusy(true); setErr(null); setOk(false)
    try { await updateProfile(user.id, { full_name: name.trim(), phone: phone.trim() || null, notify_prefs: prefs }); await refreshProfile(); setOk(true) } catch (x) { setErr(friendlyError(x)) } finally { setBusy(false) }
  }

  return (
    <div className="max-w-lg">
      <h2 className="font-display text-3xl">Your details</h2>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Email" value={user?.email ?? ''} readOnly hint="Email cannot be changed here." />
        <Field label="Mobile number" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Send me updates by</legend>
          {CHANNELS.filter((c) => c.key !== 'push' || pushAvailable()).map((c) => (
            <label key={c.key} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-marigold)]" checked={prefs[c.key]} onChange={(e) => void toggle(c.key, e.target.checked)} />
              <span>{c.label}{c.note && <span className="text-ink-soft"> ({c.note})</span>}</span>
            </label>
          ))}
        </fieldset>
        {err && <Alert>{err}</Alert>}
        {ok && <Alert tone="ok">Saved.</Alert>}
        <Button type="submit" loading={busy}>Save changes</Button>
      </form>
      <div className="mt-12 border-t border-ink/10 pt-6">
        <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
      </div>
    </div>
  )
}
