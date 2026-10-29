import { useContext } from 'react'
import { AuthContext, type AuthCtx } from './context'

export function useAuth(): AuthCtx {
  const c = useContext(AuthContext)
  if (!c) throw new Error('useAuth must be used inside <CustomerProviders>')
  return c
}

/** Where to send a user after sign-in: staff roles land on their console, customers on `next` or the account. */
export function landingFor(role: string | null | undefined, next?: string | null): string {
  if (role === 'admin' || role === 'staff') return '/admin'
  if (role === 'delivery') return '/delivery'
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
}
