import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { env } from './env.ts'

// deno-lint-ignore no-explicit-any
export type Db = any

let cached: Db | null = null

/**
 * Service-role client. Bypasses RLS: only use it after you have authenticated the caller yourself.
 * Edge Functions are short-lived HTTP calls, so the client uses PostgREST (stateless HTTP) and never
 * holds a Postgres connection. Supavisor pooling matters only for direct SQL; see docs/PAYMENTS.md.
 */
export function serviceClient(): Db {
  if (!cached) {
    cached = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-client-info': 'phoolghar-edge' } },
    })
  }
  return cached
}
