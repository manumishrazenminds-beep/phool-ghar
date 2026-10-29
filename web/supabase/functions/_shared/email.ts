// Resend email sender over fetch, with retry. Pure fetch (no SDK). Env:
//   RESEND_API_KEY (required to send), EMAIL_FROM (e.g. "Phool Ghar <orders@yourdomain.in>"),
//   EMAIL_REPLY_TO (optional).

export type SendResult =
  | { ok: true; id?: string; skipped?: string }
  | { ok: false; retryable: boolean; error: string }

// deno-lint-ignore no-explicit-any
const env = (k: string): string => ((globalThis as any).Deno?.env?.get(k) ?? '').trim()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface RetryOpts {
  attempts?: number
  baseMs?: number
  timeoutMs?: number
}

/** fetch with a per-attempt timeout; retries network errors, 429 and 5xx with jittered exponential backoff. */
export async function fetchWithRetry(url: string, init: RequestInit, opts: RetryOpts = {}): Promise<Response> {
  const attempts = opts.attempts ?? 3
  const baseMs = opts.baseMs ?? 400
  const timeoutMs = opts.timeoutMs ?? 10_000
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      if ((res.status === 429 || res.status >= 500) && i < attempts - 1) {
        const ra = Number(res.headers.get('retry-after'))
        await res.body?.cancel()
        await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 5000) : baseMs * 2 ** i * (0.8 + Math.random() * 0.4))
        continue
      }
      return res
    } catch (e) {
      lastErr = e
      if (i < attempts - 1) await sleep(baseMs * 2 ** i * (0.8 + Math.random() * 0.4))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export function emailConfigured(): boolean {
  return !!env('RESEND_API_KEY') && !!env('EMAIL_FROM')
}

export interface EmailInput {
  to: string
  subject: string
  html: string
  text: string
  /** Sent as Resend Idempotency-Key so a crash between send and bookkeeping cannot double-send. */
  idempotencyKey?: string
  tags?: Array<{ name: string; value: string }>
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

export async function sendEmail(input: EmailInput): Promise<SendResult> {
  const key = env('RESEND_API_KEY')
  const from = env('EMAIL_FROM')
  if (!key || !from) return { ok: false, retryable: true, error: 'Email not configured: set RESEND_API_KEY and EMAIL_FROM' }
  if (!EMAIL_RE.test(input.to)) return { ok: false, retryable: false, error: `Invalid recipient address` }
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  if (input.idempotencyKey) headers['Idempotency-Key'] = input.idempotencyKey.slice(0, 256)
  const body: Record<string, unknown> = { from, to: [input.to], subject: input.subject, html: input.html, text: input.text }
  const reply = env('EMAIL_REPLY_TO')
  if (reply) body.reply_to = reply
  if (input.tags?.length) body.tags = input.tags
  try {
    const res = await fetchWithRetry('https://api.resend.com/emails', { method: 'POST', headers, body: JSON.stringify(body) })
    const raw = await res.text()
    if (res.ok) {
      let id: string | undefined
      try {
        id = JSON.parse(raw)?.id
      } catch { /* ignore */ }
      return { ok: true, id }
    }
    // 4xx other than 408/409/429 are permanent (bad address, unverified domain, invalid key)
    const retryable = res.status === 408 || res.status === 409 || res.status === 429 || res.status >= 500
    return { ok: false, retryable, error: `Resend ${res.status}: ${raw.slice(0, 300)}` }
  } catch (e) {
    return { ok: false, retryable: true, error: `Resend request failed: ${(e as Error).message}` }
  }
}
