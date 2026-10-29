import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, NOT_CONNECTED, type Profile } from '../lib/api'
import { backendConfigured } from '../lib/env'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthCtx } from './context'
import { DEMO_CUSTOMER, demoCustomerActive, demoCustomerProfile, setDemoCustomerSession } from '../lib/demoCustomer'

const off = () => { throw new ApiError(NOT_CONNECTED, 'not_configured') }
const origin = () => window.location.origin
const safeNext = (n?: string) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/account')

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [booting, setBooting] = useState(backendConfigured)
  const [profileFor, setProfileFor] = useState<string | null>(null)
  const loading = booting || (!!session && profileFor !== session.user.id)
  const [recovering, setRecovering] = useState(false)
  const [demoIn, setDemoIn] = useState(demoCustomerActive)

  const latest = useRef(0)
  const loadProfile = useCallback(async (uid: string | undefined) => {
    const ticket = ++latest.current // an older, slower request must never overwrite a newer one
    if (!uid) { setProfile(null); setProfileFor(null); return }
    let row: Profile | null = null
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      row = (data as Profile) ?? null
    } catch { /* offline or RLS hiccup: fall through, never leave the app on a permanent skeleton */ }
    if (ticket !== latest.current) return
    // keep the last known profile on a failed refetch so a staff user is not demoted to a customer by a blip
    setProfile((prev) => row ?? (prev?.id === uid ? prev : null))
    setProfileFor(uid)
  }, [])

  useEffect(() => {
    if (!backendConfigured) return
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      if (alive) setBooting(false)
    }).catch(() => alive && setBooting(false))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      // Token refreshes fire constantly and change nothing about who this is; INITIAL_SESSION is covered by getSession above.
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return
      // defer: calling supabase inside the callback can deadlock the auth lock
      setTimeout(() => { void loadProfile(s?.user.id) }, 0)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const value = useMemo<AuthCtx>(() => {
    if (!backendConfigured) {
      // No backend: the dummy accounts (customer + admin/staff/delivery) stand in for real sign-in.
      const demoSession = demoIn ? ({ user: { id: demoCustomerProfile.id, email: demoCustomerProfile.email } } as unknown as Session) : null
      return {
        configured: true, loading: false, session: demoSession, user: demoSession?.user ?? null, profile: demoIn ? demoCustomerProfile : null, role: demoIn ? 'customer' : null, recovering: false,
        signInPassword: async (email, password) => {
          const e = email.trim().toLowerCase()
          if (e === DEMO_CUSTOMER.email && password === DEMO_CUSTOMER.password) { setDemoCustomerSession(true); setDemoIn(true); return }
          const { DEMO_ACCOUNTS } = await import('../admin/demo')
          const role = (Object.keys(DEMO_ACCOUNTS) as (keyof typeof DEMO_ACCOUNTS)[]).find((r) => DEMO_ACCOUNTS[r].email === e && DEMO_ACCOUNTS[r].password === password)
          if (role) {
            try { localStorage.setItem('pg_admin_demo_role', role); localStorage.setItem('pg_admin_demo_session', '1') } catch { /* private mode */ }
            window.location.assign(role === 'delivery' ? '/delivery' : '/admin')
            return
          }
          throw new ApiError('That email and password do not match a demo account. Use one from the list on this page.', 'auth')
        },
        signUp: off, sendEmailCode: off, verifyEmailCode: off, signInGoogle: off, sendPhoneCode: off, verifyPhoneCode: off, sendReset: off, updatePassword: off,
        signOut: async () => { setDemoCustomerSession(false); setDemoIn(false) }, refreshProfile: async () => {},
      }
    }
    const base = { configured: backendConfigured, loading, session, user: session?.user ?? null, profile, role: profile?.role ?? null, recovering }
    const must = (error: { message: string; status?: number } | null) => { if (error) throw new ApiError(error.message, 'auth') }
    return {
      ...base,
      signInPassword: async (email, password) => must((await supabase.auth.signInWithPassword({ email: email.trim(), password })).error),
      signUp: async ({ email, password, fullName, phone }) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: fullName, phone: phone || null }, emailRedirectTo: origin() + '/account' },
        })
        must(error)
        return { needsConfirm: !data.session }
      },
      sendEmailCode: async (email, next) => must((await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: origin() + safeNext(next) } })).error),
      verifyEmailCode: async (email, token) => must((await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' })).error),
      signInGoogle: async (next) => must((await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin() + safeNext(next) } })).error),
      sendPhoneCode: async (phone) => must((await supabase.auth.signInWithOtp({ phone: phone.trim() })).error),
      verifyPhoneCode: async (phone, token) => must((await supabase.auth.verifyOtp({ phone: phone.trim(), token: token.trim(), type: 'sms' })).error),
      sendReset: async (email) => must((await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: origin() + '/reset-password' })).error),
      updatePassword: async (password) => { must((await supabase.auth.updateUser({ password })).error); setRecovering(false) },
      signOut: async () => { await supabase.auth.signOut(); setProfile(null) },
      refreshProfile: () => loadProfile(session?.user.id),
    }
  }, [loading, session, profile, recovering, loadProfile, demoIn])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
