// Pure helpers for the webhook: event identity and entity extraction.

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Razorpay sends X-Razorpay-Event-Id; if absent, fall back to a hash of the raw body (still replay-safe). */
export async function eventId(headerValue: string | null, rawBody: string): Promise<string> {
  const h = (headerValue ?? '').trim()
  if (/^[A-Za-z0-9_-]{6,100}$/.test(h)) return h
  return 'h_' + (await sha256Hex(rawBody))
}

export function paymentEntity(evt: any): any | null {
  return evt?.payload?.payment?.entity ?? null
}
export function refundEntity(evt: any): any | null {
  return evt?.payload?.refund?.entity ?? null
}

/** Unknown-order events younger than this are retried (payment row may not be committed yet). */
export const ORPHAN_GRACE_SEC = 15 * 60

export function eventAgeSec(evt: any, nowMs = Date.now()): number {
  const t = Number(evt?.created_at)
  return Number.isFinite(t) && t > 0 ? Math.max(0, nowMs / 1000 - t) : 0
}
