import { useState, type FormEvent } from 'react'
import { ArrowLeft, Flower, Eye, EyeSlash } from '@phosphor-icons/react'
import { backendConfigured } from '../lib/env'
import { supabase } from '../lib/supabase'
import { DEMO_ACCOUNTS } from './demo'
import { useAdminMode } from './mode'
import { readableError } from './format'
import { Button, ErrorBanner, TextField } from './ui'

export function AdminLogin({ title = 'Team sign in' }: { title?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  const { demoSignIn } = useAdminMode()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    if (!backendConfigured) {
      // No backend yet: only the dummy accounts below unlock the sample-data workspace.
      const hit = (Object.keys(DEMO_ACCOUNTS) as (keyof typeof DEMO_ACCOUNTS)[]).find((k) => DEMO_ACCOUNTS[k].email === email.trim().toLowerCase() && DEMO_ACCOUNTS[k].password === password)
      if (hit) demoSignIn(hit)
      else setErr('That email and password do not match a demo account. Pick one from the list below.')
      setBusy(false)
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setErr(readableError(error))
    setBusy(false)
  }
  return (
    <div className="grid min-h-screen place-items-center bg-cream px-4 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-[0_40px_90px_-40px_rgba(31,61,43,0.45)]">
      <div className="relative overflow-hidden bg-leaf px-8 pb-8 pt-9 text-cream">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-52 rounded-full bg-marigold/30 blur-3xl" />
        <p className="relative flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-saffron"><Flower size={14} weight="fill" aria-hidden />Phool Ghar admin</p>
        <h1 className="relative mt-2 font-display text-5xl">{title}</h1>
        <p className="relative mt-2 text-sm text-cream/75">{backendConfigured ? 'Use the email and password the owner gave you.' : 'Pick a dummy account below to explore the demo workspace.'}</p>
      </div>
      <div className="p-6 sm:p-8">
        <a href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"><ArrowLeft size={14} aria-hidden />Back to the store</a>
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBanner message={err} />}
        <TextField label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="relative">
          <TextField label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)} className="absolute bottom-0 right-0 grid h-10 w-10 place-items-center text-ink-soft hover:text-ink">{show ? <EyeSlash size={18} /> : <Eye size={18} />}</button>
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</Button>
      </form>
      {!backendConfigured && (
        <div className="mt-6 rounded-2xl bg-cream/70 p-4">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft"><Flower size={14} aria-hidden />Dummy accounts</p>
          <ul className="mt-3 space-y-2">
            {(Object.keys(DEMO_ACCOUNTS) as (keyof typeof DEMO_ACCOUNTS)[]).map((k) => {
              const a = DEMO_ACCOUNTS[k]
              return (
                <li key={k}>
                  <button type="button" onClick={() => { setEmail(a.email); setPassword(a.password); setErr(null) }} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-left hover:border-marigold">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block font-mono text-xs text-ink-soft">{a.email} / {a.password}</span>
                    <span className="block text-xs text-ink-soft">{a.note}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">Tap a row to fill the form. These only open sample data in this browser. Replaced by real accounts once Supabase is connected.</p>
        </div>
      )}
      </div>
      </div>
    </div>
  )
}
