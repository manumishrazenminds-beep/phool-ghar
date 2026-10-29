import { HttpError } from './http.ts'
import type { Db } from './supabase.ts'

export function clientIp(req: Request): string {
  const h = req.headers
  const raw =
    h.get('cf-connecting-ip') ?? h.get('x-real-ip') ?? (h.get('x-forwarded-for') ?? '').split(',')[0] ?? ''
  const ip = raw.trim().slice(0, 64)
  return ip || 'unknown'
}

/** Key shape: rl:<scope>:<user|ip>:<id>. Id is stripped to a safe charset and capped. */
export function rlKey(scope: string, kind: 'user' | 'ip', id: string): string {
  const safe = (s: string, n: number) => s.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, n)
  return `rl:${safe(scope, 40)}:${kind}:${safe(id, 64)}`
}

export interface Limit {
  max: number
  windowSec: number
}

/** true = request allowed. Assumes rl_hit returns true when under the limit (see docs/PAYMENTS.md). */
export async function rlHit(db: Db, key: string, l: Limit): Promise<boolean> {
  const { data, error } = await db.rpc('rl_hit', { p_key: key, p_max: l.max, p_window_seconds: l.windowSec })
  if (error) throw new Error(`rl_hit failed: ${error.message}`)
  return data === true
}

/**
 * Applies the per-IP limit (always) and the per-user limit (when userId is given).
 * Fails OPEN if the limiter itself errors, so a limiter outage cannot block paying customers;
 * the error is reported through onError (the caller logs it).
 */
export async function enforceRateLimit(
  db: Db,
  req: Request,
  o: { scope: string; userId?: string; user?: Limit; ip?: Limit; onError?: (e: unknown) => void },
): Promise<void> {
  const checks: Array<[string, Limit]> = []
  if (o.ip) checks.push([rlKey(o.scope, 'ip', clientIp(req)), o.ip])
  if (o.userId && o.user) checks.push([rlKey(o.scope, 'user', o.userId), o.user])
  for (const [key, limit] of checks) {
    let allowed = true
    try {
      allowed = await rlHit(db, key, limit)
    } catch (e) {
      o.onError?.(e)
    }
    if (!allowed) {
      throw new HttpError(429, 'rate_limited', 'Too many requests. Please wait a moment and try again', {
        retryAfterSec: Math.min(limit.windowSec, 60),
      })
    }
  }
}
