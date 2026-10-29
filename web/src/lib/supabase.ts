import { createClient } from '@supabase/supabase-js'
import { env } from './env'

/**
 * Browser Supabase client. Uses the publishable (anon) key only; every table is protected by RLS.
 * When env is missing we still create a client against a placeholder so imports never crash;
 * check `backendConfigured` from ./env before relying on it.
 */
export const supabase = createClient(env.supabaseUrl || 'http://localhost:54321', env.supabaseKey || 'public-anon-key-placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Call an Edge Function with the current session attached. Throws on non-2xx with the server's error message. */
export async function callFn<T = unknown>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> | undefined })
  if (error) {
    let message = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) message = (await ctx.json())?.error?.message ?? message
    } catch { /* keep default */ }
    throw new Error(message)
  }
  return data as T
}
