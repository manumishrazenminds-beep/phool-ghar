// Helpers shared by the Phool Ghar notification functions (notify-dispatch, daily-scheduler).
// Auth for machine callers (cron) lives here because _shared/auth.ts only handles user JWTs.
import { HttpError } from '../_shared/http.ts'
import { readEnv } from '../_shared/env.ts'
import type { Db } from '../_shared/supabase.ts'

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
}

/** Constant-time string comparison (compares SHA-256 digests so lengths do not leak). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256(a), sha256(b)])
  let d = 0
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]
  return d === 0
}

/**
 * Accepts `Authorization: Bearer <CRON_SECRET | service role key>` or `x-cron-secret: <CRON_SECRET>`.
 * With `allowServiceRole` false only CRON_SECRET is accepted.
 */
export async function requireCronOrService(req: Request, allowServiceRole = true): Promise<void> {
  const cron = readEnv('CRON_SECRET')
  const service = allowServiceRole ? readEnv('SUPABASE_SERVICE_ROLE_KEY') : undefined
  if (!cron && !service) throw new HttpError(503, 'not_configured', 'CRON_SECRET is not set for this function')
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')?.[1]
  const header = req.headers.get('x-cron-secret') ?? undefined
  const presented = [bearer, header].filter((v): v is string => !!v)
  for (const p of presented) {
    if (cron && (await safeEqual(p, cron))) return
    if (service && (await safeEqual(p, service))) return
  }
  throw new HttpError(401, 'unauthenticated', 'Missing or invalid credentials')
}

/** Best-effort structured log to app_logs; never throws. */
export async function logApp(db: Db, level: 'info' | 'warn' | 'error', source: string, code: string, message: string, detail?: unknown): Promise<void> {
  try {
    await db.from('app_logs').insert({ level, source, code, message: message.slice(0, 500), detail: detail ?? null })
  } catch { /* logging must not break the request */ }
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](JSON.stringify({ level, source, code, message }))
}

const IST_OFFSET_MS = 330 * 60_000

/** Calendar date (YYYY-MM-DD) in Asia/Kolkata for an instant, offset by whole days. */
export function istDate(now: Date = new Date(), plusDays = 0): string {
  const t = new Date(now.getTime() + IST_OFFSET_MS + plusDays * 86_400_000)
  return t.toISOString().slice(0, 10)
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Reads app_settings rows into a plain map; values stored as jsonb strings are unwrapped. */
export async function loadSettings(db: Db, keys: string[]): Promise<Record<string, unknown>> {
  const { data } = await db.from('app_settings').select('key, value').in('key', keys)
  const out: Record<string, unknown> = {}
  for (const r of (data ?? []) as Array<{ key: string; value: unknown }>) out[r.key] = r.value
  return out
}
