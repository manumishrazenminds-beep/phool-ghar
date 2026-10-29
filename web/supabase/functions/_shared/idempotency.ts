import { HttpError } from './http.ts'
import type { Db } from './supabase.ts'

// Backed by public.idempotency_keys(key pk, scope, user_id, response jsonb, expires_at).
// Two-phase: begin() claims the key with response = null and a short lease; complete() stores the
// response for 24h; release() frees the key if the work failed so the client may retry.

export function storageKey(scope: string, userId: string | null, key: string): string {
  return `${scope}:${userId ?? 'anon'}:${key}`.slice(0, 300)
}

export type IdemState =
  | { state: 'new'; key: string }
  | { state: 'replay'; key: string; response: unknown }

const LEASE_SEC = 60
const KEEP_SEC = 24 * 3600

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString()

export async function beginIdempotent(db: Db, scope: string, userId: string | null, clientKey: string): Promise<IdemState> {
  const key = storageKey(scope, userId, clientKey)
  const row = { key, scope, user_id: userId, response: null, expires_at: inSeconds(LEASE_SEC) }
  for (let i = 0; i < 2; i++) {
    const ins = await db.from('idempotency_keys').insert(row)
    if (!ins.error) return { state: 'new', key }
    if (ins.error.code !== '23505') throw new Error(`idempotency insert failed: ${ins.error.message}`)
    const { data, error } = await db.from('idempotency_keys').select('response, expires_at').eq('key', key).maybeSingle()
    if (error) throw new Error(`idempotency read failed: ${error.message}`)
    if (!data) continue // deleted between insert and select; claim again
    if (data.response !== null && data.response !== undefined) return { state: 'replay', key, response: data.response }
    if (new Date(data.expires_at).getTime() > Date.now()) {
      throw new HttpError(409, 'request_in_progress', 'The same request is already being processed. Retry in a moment', { retryAfterSec: 2 })
    }
    // Stale lease from a crashed attempt: take it over (conditional delete avoids racing a fresh claim).
    await db.from('idempotency_keys').delete().eq('key', key).is('response', null).lt('expires_at', new Date().toISOString())
  }
  throw new HttpError(409, 'request_in_progress', 'The same request is already being processed. Retry in a moment', { retryAfterSec: 2 })
}

export async function completeIdempotent(db: Db, key: string, response: unknown): Promise<void> {
  const { error } = await db.from('idempotency_keys').update({ response, expires_at: inSeconds(KEEP_SEC) }).eq('key', key)
  if (error) throw new Error(`idempotency complete failed: ${error.message}`)
}

export async function releaseIdempotent(db: Db, key: string): Promise<void> {
  await db.from('idempotency_keys').delete().eq('key', key).is('response', null)
}
