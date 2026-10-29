import { HttpError } from './http.ts'
import { serviceClient } from './supabase.ts'

export type Role = 'customer' | 'admin' | 'staff' | 'delivery'
export type Perm = 'orders' | 'products' | 'stock' | 'subscriptions' | 'customers' | 'coupons' | 'reports' | 'settings' | 'team'

export interface AuthContext {
  userId: string
  email: string | null
  token: string
  profile: {
    id: string
    role: Role
    permissions: string[]
    active: boolean
    full_name: string | null
    phone: string | null
    email: string | null
  }
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(\S+)$/i.exec(h)
  return m ? m[1] : null
}

/** Verifies the JWT with Supabase Auth (signature, expiry, revocation) and loads the profile. */
export async function requireUser(req: Request): Promise<AuthContext> {
  const token = bearerToken(req)
  if (!token) throw new HttpError(401, 'unauthenticated', 'Sign in to continue')
  const db = serviceClient()
  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user) throw new HttpError(401, 'unauthenticated', 'Your session has expired. Please sign in again')
  const { data: profile, error: pErr } = await db
    .from('profiles')
    .select('id, role, permissions, active, full_name, phone, email')
    .eq('id', data.user.id)
    .maybeSingle()
  if (pErr) throw new HttpError(503, 'profile_unavailable', 'Could not load your account. Please retry', { retryAfterSec: 3 })
  if (!profile) throw new HttpError(403, 'no_profile', 'Your account is not set up yet')
  if (profile.active === false) throw new HttpError(403, 'account_disabled', 'This account has been disabled')
  return {
    userId: data.user.id,
    email: data.user.email ?? profile.email ?? null,
    token,
    profile: {
      id: profile.id,
      role: profile.role,
      permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
      active: true,
      full_name: profile.full_name ?? null,
      phone: profile.phone ?? null,
      email: profile.email ?? null,
    },
  }
}

export async function requireRole(req: Request, roles: Role[]): Promise<AuthContext> {
  const ctx = await requireUser(req)
  if (!roles.includes(ctx.profile.role)) throw new HttpError(403, 'forbidden', 'You do not have access to this action')
  return ctx
}

/** admin passes; staff must hold the permission; everyone else is refused. */
export async function requirePerm(req: Request, perm: Perm): Promise<AuthContext> {
  const ctx = await requireUser(req)
  const { role, permissions } = ctx.profile
  if (role === 'admin') return ctx
  if (role === 'staff' && permissions.includes(perm)) return ctx
  throw new HttpError(403, 'forbidden', 'You do not have permission for this action')
}
