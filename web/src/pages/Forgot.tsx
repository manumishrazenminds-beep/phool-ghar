import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthShell } from '../auth/AuthShell'
import { useAuth } from '../auth/useAuth'
import { friendlyError } from '../lib/api'
import { Alert, Button, Field } from '../lib/ui'

export default function Forgot() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr(null)
    try { await auth.sendReset(email); setSent(true) } catch (x) { setErr(friendlyError(x)) } finally { setBusy(false) }
  }
  return (
    <AuthShell eyebrow="Account help" title={<>Reset your <em>password</em></>} intro="Enter your email and we will send a link to choose a new one."
      footer={<Link to="/login" className="font-medium text-ink underline underline-offset-4">Back to sign in</Link>}>
      {sent ? <Alert tone="ok" title="Link on its way">If an account exists for {email}, a reset link is in the inbox. It may take a minute.</Alert> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {err && <Alert>{err}</Alert>}
          <Button type="submit" loading={busy} className="w-full">Send reset link</Button>
        </form>
      )}
    </AuthShell>
  )
}
