import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthShell } from '../auth/AuthShell'
import { useAuth } from '../auth/useAuth'
import { friendlyError } from '../lib/api'
import { Alert, Button, Field, SkeletonList } from '../lib/ui'

export default function Reset() {
  const auth = useAuth()
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (pw.length < 8) return setErr('Please choose a password of at least 8 characters.')
    if (pw !== pw2) return setErr('The two passwords do not match.')
    setBusy(true); setErr(null)
    try { await auth.updatePassword(pw); setDone(true); setTimeout(() => nav('/account'), 1500) } catch (x) { setErr(friendlyError(x)) } finally { setBusy(false) }
  }

  return (
    <AuthShell eyebrow="Account help" title={<>Choose a <em>new password</em></>} intro="Pick something you have not used elsewhere."
      footer={<Link to="/login" className="font-medium text-ink underline underline-offset-4">Back to sign in</Link>}>
      {auth.loading ? <SkeletonList rows={2} /> : done ? <Alert tone="ok" title="Password updated">Taking you to your account.</Alert>
        : !auth.session ? <Alert tone="warn" title="This link has expired">Reset links work once. <Link to="/forgot-password" className="underline underline-offset-4">Request a new one</Link>.</Alert> : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." required value={pw} onChange={(e) => setPw(e.target.value)} />
            <Field label="Confirm new password" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
            {err && <Alert>{err}</Alert>}
            <Button type="submit" loading={busy} className="w-full">Update password</Button>
          </form>
        )}
    </AuthShell>
  )
}
