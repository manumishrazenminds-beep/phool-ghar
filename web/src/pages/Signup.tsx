import { GoogleLogo } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthShell, Divider } from '../auth/AuthShell'
import { landingFor, useAuth } from '../auth/useAuth'
import { friendlyError } from '../lib/api'
import { flags } from '../lib/flags'
import { Alert, Button, Field, LinkButton } from '../lib/ui'

export default function Signup() {
  const auth = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const [f, setF] = useState({ fullName: '', email: '', phone: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }))

  useEffect(() => { if (auth.session && !auth.loading) nav(landingFor(auth.role, next), { replace: true }) }, [auth.session, auth.loading, auth.role, next, nav])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (f.password.length < 8) { setErr('Please choose a password of at least 8 characters.'); return }
    setBusy(true); setErr(null)
    try { const r = await auth.signUp(f); if (r.needsConfirm) setConfirm(true) } catch (x) { setErr(friendlyError(x)) } finally { setBusy(false) }
  }

  return (
    <AuthShell eyebrow="Join Phool Ghar" title={<>Create your <em>account</em></>} intro="Save addresses once, schedule daily flowers and follow every delivery."
      footer={<>Already have an account? <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-ink underline underline-offset-4">Sign in</Link></>}>
      {confirm ? (
        <div className="space-y-4">
          <Alert tone="ok" title="Check your email">We sent a confirmation link to {f.email}. Open it to finish creating your account.</Alert>
          <LinkButton to="/shop" variant="ghost">Keep browsing</LinkButton>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Full name" autoComplete="name" required value={f.fullName} onChange={set('fullName')} />
            <Field label="Email" type="email" autoComplete="email" required value={f.email} onChange={set('email')} />
            <Field label="Mobile number (optional)" type="tel" autoComplete="tel" hint="Used only for delivery updates." value={f.phone} onChange={set('phone')} />
            <Field label="Password" type="password" autoComplete="new-password" hint="At least 8 characters." required value={f.password} onChange={set('password')} />
            {err && <Alert title="Could not create the account">{err}</Alert>}
            <Button type="submit" loading={busy} className="w-full">Create account</Button>
          </form>
          {flags.googleAuth && (
            <>
              <Divider>or</Divider>
              <Button variant="ghost" className="w-full" onClick={() => auth.signInGoogle(next ?? undefined).catch((x) => setErr(friendlyError(x)))}><GoogleLogo size={18} weight="bold" aria-hidden />Continue with Google</Button>
            </>
          )}
        </>
      )}
    </AuthShell>
  )
}
