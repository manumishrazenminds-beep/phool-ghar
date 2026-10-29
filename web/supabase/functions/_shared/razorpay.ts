import { env, readEnv } from './env.ts'
import { HttpError } from './http.ts'
import { CircuitBreaker, CircuitOpenError, TimeoutError, isNetworkError, withRetry } from './retry.ts'

const LIVE_BASE = 'https://api.razorpay.com/v1'
/** Test-only seam: lets a local fake stand in for Razorpay. Ignored unless the key is a test key, so production can never be redirected. */
function apiBase(): string {
  const o = readEnv('RAZORPAY_API_BASE')
  return o && env.razorpayKeyId.startsWith('rzp_test_') && /^http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?\//.test(o) ? o.replace(/\/$/, '') : LIVE_BASE
}
export const razorpayBreaker = new CircuitBreaker('razorpay', { threshold: 5, cooldownMs: 30_000 })

// ---------- signatures (pure, WebCrypto) ----------

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

/** Constant-time string compare. Length is not secret (always 64 hex chars for a valid signature). */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a)
  const y = enc.encode(b)
  let diff = x.length ^ y.length
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

/** Checkout signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret), hex. */
export async function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret?: string): Promise<boolean> {
  if (!orderId || !paymentId || !signature) return false
  const expected = await hmacSha256Hex(secret ?? env.razorpayKeySecret, `${orderId}|${paymentId}`)
  return timingSafeEqual(expected, signature.toLowerCase())
}

/** Webhook signature = HMAC_SHA256(raw request body, webhook_secret), hex. Must use the RAW body. */
export async function verifyWebhookSignature(rawBody: string, signature: string | null, secret?: string): Promise<boolean> {
  if (!signature) return false
  const expected = await hmacSha256Hex(secret ?? env.razorpayWebhookSecret, rawBody)
  return timingSafeEqual(expected, signature.trim().toLowerCase())
}

// ---------- REST client ----------

export class RazorpayError extends Error {
  status: number
  rzpCode: string | undefined
  retryable: boolean
  retryAfterMs: number | undefined
  constructor(status: number, rzpCode: string | undefined, description: string, retryAfterMs?: number) {
    super(description)
    this.name = 'RazorpayError'
    this.status = status
    this.rzpCode = rzpCode
    this.retryable = status === 429 || status >= 500
    this.retryAfterMs = retryAfterMs
  }
}

export interface RzpOrder { id: string; amount: number; currency: string; receipt: string | null; status: string; notes?: Record<string, unknown> }
export interface RzpPayment {
  id: string; order_id: string | null; amount: number; currency: string; status: string; method?: string
  captured?: boolean; error_code?: string | null; error_description?: string | null; amount_refunded?: number
}
export interface RzpRefund { id: string; payment_id: string; amount: number; currency?: string; status: string }

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const auth = 'Basic ' + btoa(`${env.razorpayKeyId}:${env.razorpayKeySecret}`)
  try {
    return await withRetry<T>(
      async (signal) => {
        const res = await fetch(apiBase() + path, {
          method,
          signal,
          headers: { Authorization: auth, 'Content-Type': 'application/json', ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        const text = await res.text()
        let json: any = null
        try { json = JSON.parse(text) } catch { /* non-json */ }
        if (res.ok) return json as T
        const ra = Number(res.headers.get('retry-after'))
        throw new RazorpayError(res.status, json?.error?.code, String(json?.error?.description ?? `HTTP ${res.status}`), Number.isFinite(ra) && ra > 0 ? ra * 1000 : undefined)
      },
      {
        retries: 3,
        baseMs: 400,
        maxMs: 4000,
        timeoutMs: 8000,
        breaker: razorpayBreaker,
        shouldRetry: (e) => (e instanceof RazorpayError ? e.retryable : isNetworkError(e)),
        retryAfterMs: (e) => (e instanceof RazorpayError ? e.retryAfterMs : undefined),
      },
    )
  } catch (e) {
    if (e instanceof CircuitOpenError) {
      throw new HttpError(503, 'payment_provider_unavailable', 'The payment provider is temporarily unavailable. Please try again shortly', { retryAfterSec: Math.max(5, Math.ceil(e.retryAfterMs / 1000)) })
    }
    if (e instanceof TimeoutError || e instanceof TypeError || (e instanceof RazorpayError && e.retryable)) {
      throw new HttpError(503, 'payment_provider_unavailable', 'The payment provider is not responding. Please try again shortly', { retryAfterSec: 15 })
    }
    throw e // RazorpayError 4xx: caller decides
  }
}

/** Razorpay does not de-duplicate order creation; our own idempotency layer does. */
export function createOrder(o: { amountPaise: number; receipt: string; notes?: Record<string, string> }): Promise<RzpOrder> {
  return call<RzpOrder>('POST', '/orders', {
    amount: o.amountPaise,
    currency: 'INR',
    receipt: o.receipt.slice(0, 40),
    notes: o.notes ?? {},
  })
}

export function fetchPayment(paymentId: string): Promise<RzpPayment> {
  return call<RzpPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`)
}

/** Uses Razorpay's X-Refund-Idempotency header so a retried POST cannot refund twice. */
export function refund(paymentId: string, o: { amountPaise: number; idempotencyKey: string; notes?: Record<string, string> }): Promise<RzpRefund> {
  return call<RzpRefund>(
    'POST',
    `/payments/${encodeURIComponent(paymentId)}/refund`,
    { amount: o.amountPaise, speed: 'normal', notes: o.notes ?? {} },
    { 'X-Refund-Idempotency': o.idempotencyKey.slice(0, 64) },
  )
}

export function razorpayKeyIdPublic(): string {
  return env.razorpayKeyId
}
