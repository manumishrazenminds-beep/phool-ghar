import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { backendConfigured } from '../lib/env'
import { liveApi, type Api } from './api'
import { demoApi, demoProfile } from './demo'
import type { Profile, Role } from './types'

interface ModeCtx {
  demo: boolean
  setDemo: (v: boolean) => void
  api: Api
  demoRole: Role
  setDemoRole: (r: Role) => void
  demoUser: Profile
  /** True once someone has signed in with a demo account (only meaningful when no backend is configured). */
  demoSignedIn: boolean
  demoSignIn: (r: Role) => void
  demoSignOut: () => void
}
const Ctx = createContext<ModeCtx | null>(null)
const KEY = 'pg_admin_demo'
const RKEY = 'pg_admin_demo_role'
const SKEY = 'pg_admin_demo_session'

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { /* private mode */ }
}

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const [demoFlag, setDemoState] = useState(() => read(KEY) === '1')
  // With no backend the admin only runs on demo data, behind the demo sign-in.
  const demo = demoFlag || !backendConfigured
  const [demoSignedIn, setSignedIn] = useState(() => read(SKEY) === '1')
  const [demoRole, setRole] = useState<Role>(() => (['admin', 'staff', 'delivery'].includes(read(RKEY) ?? '') ? (read(RKEY) as Role) : 'admin'))
  const setDemo = useCallback((v: boolean) => { write(KEY, v ? '1' : '0'); setDemoState(v) }, [])
  const setDemoRole = useCallback((r: Role) => { write(RKEY, r); setRole(r) }, [])
  const demoSignIn = useCallback((r: Role) => { write(RKEY, r); setRole(r); write(SKEY, '1'); setSignedIn(true) }, [])
  const demoSignOut = useCallback(() => { write(SKEY, '0'); setSignedIn(false) }, [])
  const value = useMemo<ModeCtx>(
    () => ({ demo, setDemo, api: demo ? demoApi : liveApi, demoRole, setDemoRole, demoUser: demoProfile(demoRole), demoSignedIn, demoSignIn, demoSignOut }),
    [demo, setDemo, demoRole, setDemoRole, demoSignedIn, demoSignIn, demoSignOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAdminMode() {
  const c = useContext(Ctx)
  if (!c) throw new Error('AdminModeProvider missing')
  return c
}
export const useApi = () => useAdminMode().api

/** True when screens can run: live backend configured, or demo mode on. */
export function useCanRun() {
  const { demo } = useAdminMode()
  return demo || backendConfigured
}
