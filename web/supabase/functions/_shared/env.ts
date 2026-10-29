// Typed, lazy environment access. Nothing is read at import time, so every
// function boots with zero configuration. A missing variable only throws when
// code actually asks for it, with a message that says which variable and why.

export class EnvError extends Error {
  envName: string
  constructor(envName: string, why: string) {
    super(`Missing environment variable ${envName}: ${why}`)
    this.name = 'EnvError'
    this.envName = envName
  }
}

export function readEnv(name: string): string | undefined {
  const g = globalThis as any
  const v = g.Deno?.env?.get?.(name) ?? g.process?.env?.[name]
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t === '' ? undefined : t
}

export function requireEnv(name: string, why: string): string {
  const v = readEnv(name)
  if (!v) throw new EnvError(name, why)
  return v
}

export function csvEnv(name: string): string[] {
  return (readEnv(name) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Lazy getters: each property is evaluated on access only. */
export const env = {
  // Injected automatically by Supabase on hosted Edge Functions.
  get supabaseUrl() {
    return requireEnv('SUPABASE_URL', 'Supabase project URL (injected automatically when deployed)')
  },
  get supabaseAnonKey() {
    return requireEnv('SUPABASE_ANON_KEY', 'Supabase anon key (injected automatically when deployed)')
  },
  get serviceRoleKey() {
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'service role key (injected automatically when deployed)')
  },
  // Set with `supabase secrets set`.
  get razorpayKeyId() {
    return requireEnv('RAZORPAY_KEY_ID', 'Razorpay API key id (Dashboard > Account & Settings > API Keys)')
  },
  get razorpayKeySecret() {
    return requireEnv('RAZORPAY_KEY_SECRET', 'Razorpay API key secret, used to create orders and verify checkout signatures')
  },
  get razorpayWebhookSecret() {
    return requireEnv('RAZORPAY_WEBHOOK_SECRET', 'the secret you typed when creating the Razorpay webhook')
  },
  get allowedOrigins(): string[] {
    return csvEnv('ALLOWED_ORIGINS')
  },
  get storeName() {
    return readEnv('STORE_NAME') ?? 'Phool Ghar'
  },
  get logLevel() {
    return (readEnv('LOG_LEVEL') ?? 'info').toLowerCase()
  },
}
