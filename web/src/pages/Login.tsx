import { Crown, GoogleLogo, Truck, UserCircle, UsersThree } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthShell, Divider } from '../auth/AuthShell'
import { landingFor, useAuth } from '../auth/useAuth'
import { friendlyError } from '../lib/api'
import { flags } from '../lib/flags'
import { backendConfigured } from '../lib/env'
import { DEMO_CUSTOMER } from '../lib/demoCustomer'
import { DEMO_ACCOUNTS } from '../admin/demo'
import { Alert, Button, Field } from '../lib/ui'

type Mode = 'password' | 'code' | 'phone'

export default function Login() {
  const auth = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (auth.session && !auth.loading) nav(landingFor(auth.role, next), { replace: true })
  }, [auth.session, auth.role, auth.loading, next, nav])

  async function run(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true); setErr(null)
    try { await fn() } catch (e) { setErr(friendlyError(e)) } finally { setBusy(false) }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      if (mode === 'password') await auth.signInPassword(email, password)
      else if (mode === 'code') {
        if (!sent) { await auth.sendEmailCode(email, next ?? undefined); setSent(true) } else await auth.verifyEmailCode(email, token)
      } else if (!sent) { await auth.sendPhoneCode(phone); setSent(true) } else await auth.verifyPhoneCode(phone, token)
    })
  }

  const tab = (m: Mode, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setSent(false); setErr(null); setToken('') }}
      className={`min-h-11 flex-1 rounded-full px-3 text-sm font-medium transition ${mode === m ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink'}`}>{label}</button>
  )

  return (
    <AuthShell eyebrow="Welcome back" title={<>Sign <em>in</em></>} intro="Track your deliveries, manage your daily plan and reorder in a tap."
      footer={<>New here? <Link to={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-ink underline underline-offset-4">Create an account</Link></>}>
      {!backendConfigured && (
        <div className="mb-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">Try a demo account</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {[{ label: 'Customer', email: DEMO_CUSTOMER.email, password: DEMO_CUSTOMER.password, Icon: UserCircle }, { ...DEMO_ACCOUNTS.admin, label: 'Owner', Icon: Crown }, { ...DEMO_ACCOUNTS.staff, label: 'Staff', Icon: UsersThree }, { ...DEMO_ACCOUNTS.delivery, label: 'Delivery', Icon: Truck }].map((a) => {
              const active = email === a.email
              return (
                <button key={a.email} type="button" onClick={() => { setMode('password'); setEmail(a.email); setPassword(a.password); setErr(null) }}
                  className={`group flex items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? 'border-marigold bg-marigold/10' : 'border-ink/10 bg-cream/60 hover:border-marigold/60 hover:bg-cream'}`}>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${active ? 'bg-marigold text-white' : 'bg-white text-marigold-deep'}`}><a.Icon size={20} weight="duotone" aria-hidden /></span>
                  <span className="min-w-0"><span className="block text-sm font-medium">{a.label}</span><span className="block truncate font-mono text-[11px] text-ink-soft">{a.email.split('@')[0]}</span></span>
                </button>
              )
            })}
          </div>
          <p className="mt-2.5 text-xs text-ink-soft">Tap a tile to fill the form, then press Sign in. Sample data only.</p>
        </div>
      )}
      <div role="tablist" aria-label="Sign-in method" className="flex gap-1 rounded-full border border-ink/10 bg-cream-2 p-1">
        {tab('password', 'Password')}{tab('code', 'Email code')}{flags.phoneOtp && tab('phone', 'Phone')}
      </div>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {mode !== 'phone' && <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={sent} />}
        {mode === 'password' && (
          <>
            <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="text-right"><Link to="/forgot-password" className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink">Forgot password?</Link></div>
          </>
        )}
        {mode === 'phone' && <Field label="Mobile number" type="tel" autoComplete="tel" placeholder="+91 98765 43210" hint="Include the country code." required value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent} />}
        {sent && (
          <>
            <Alert tone="ok">{mode === 'phone' ? 'We sent a code by SMS.' : 'Check your inbox. Tap the link, or type the code from the email below.'}</Alert>
            <Field label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required value={token} onChange={(e) => setToken(e.target.value)} />
          </>
        )}
        {err && <Alert title="Could not sign you in">{err}</Alert>}
        <Button type="submit" loading={busy} className="w-full">
          {mode === 'password' ? 'Sign in' : sent ? 'Verify code' : mode === 'phone' ? 'Send code' : 'Email me a code'}
        </Button>
      </form>
      {flags.googleAuth && (
        <>
          <Divider>or</Divider>
          <Button variant="ghost" className="w-full" onClick={() => void run(() => auth.signInGoogle(next ?? undefined))}><GoogleLogo size={18} weight="bold" aria-hidden />Continue with Google</Button>
        </>
      )}
    </AuthShell>
  )
}
