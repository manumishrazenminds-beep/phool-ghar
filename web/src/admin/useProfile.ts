import { useCallback, useEffect, useState } from 'react'
import { backendConfigured } from '../lib/env'
import { supabase } from '../lib/supabase'
import { readableError } from './format'
import { useAdminMode } from './mode'
import type { Perm, Profile } from './types'

export interface ProfileState {
  loading: boolean
  profile: Profile | null
  error: string | null
  signedIn: boolean
  /** admin: always true. staff: only listed permissions. others: false */
  can: (p: Perm) => boolean
  isAdmin: boolean
  isStaff: boolean
  isDelivery: boolean
  refresh: () => void
  signOut: () => Promise<void>
}

/** Resolves the signed-in user's profile (role + permissions). In demo mode returns a sample profile. */
export function useProfile(): ProfileState {
  const { demo, demoUser, demoSignedIn, demoSignOut } = useAdminMode()
  const [state, setState] = useState<{ loading: boolean; profile: Profile | null; error: string | null; signedIn: boolean }>({
    loading: !demo && backendConfigured, profile: null, error: null, signedIn: false,
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (demo || !backendConfigured) return
    let live = true
    const load = async () => {
      setState((s) => ({ ...s, loading: true, error: null }))
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess.session?.user.id
      if (!uid) { if (live) setState({ loading: false, profile: null, error: null, signedIn: false }); return }
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (!live) return
      if (error) setState({ loading: false, profile: null, error: readableError(error), signedIn: true })
      else setState({ loading: false, profile: (data as Profile | null) ?? null, error: data ? null : 'No profile row exists for this account yet.', signedIn: true })
    }
    void load()
    const { data: sub } = supabase.auth.onAuthStateChange(() => { void load() })
    return () => { live = false; sub.subscription.unsubscribe() }
  }, [demo, tick])

  const profile = demo ? demoUser : state.profile
  const active = !!profile && profile.active !== false
  const can = useCallback(
    (p: Perm) => !!profile && active && (profile.role === 'admin' || (profile.role === 'staff' && profile.permissions.includes(p))),
    [profile, active],
  )
  return {
    loading: demo ? false : state.loading,
    profile,
    error: demo ? null : state.error,
    signedIn: demo ? (backendConfigured ? true : demoSignedIn) : state.signedIn,
    can,
    isAdmin: active && profile?.role === 'admin',
    isStaff: active && profile?.role === 'staff',
    isDelivery: active && profile?.role === 'delivery',
    refresh: () => setTick((t) => t + 1),
    signOut: async () => { if (demo) demoSignOut(); else await supabase.auth.signOut() },
  }
}
