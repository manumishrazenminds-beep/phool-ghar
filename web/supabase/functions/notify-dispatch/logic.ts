// Pure dispatch logic (no Deno or network), unit-testable under node.
export const MAX_ATTEMPTS = 6
export const CHANNELS = ['email', 'whatsapp', 'sms', 'push'] as const
export type Channel = (typeof CHANNELS)[number]

/** Templates that must reach the person regardless of their notify_prefs (account security and onboarding). */
export const ALWAYS_SEND: ReadonlySet<string> = new Set(['staff_invited'])

/**
 * Seconds to wait before the next try after failed attempt number `attempt` (1-based).
 * 30s, 60s, 2m, 4m, 8m ... capped at 1h. Jitter is +/-20% (pass jitter=0 to disable).
 */
export function backoffSeconds(attempt: number, random: () => number = Math.random, jitter = 0.2): number {
  const n = Math.max(1, Math.floor(attempt))
  const base = Math.min(30 * 2 ** (n - 1), 3600)
  const factor = 1 + (random() * 2 - 1) * jitter
  return Math.max(1, Math.round(base * factor))
}

export type Outcome = { status: 'sent' } | { status: 'failed'; retryInSeconds: number } | { status: 'dead' }

/** attempts is the count AFTER this try (the claim step already incremented it). */
export function nextState(attempts: number, retryable: boolean, random: () => number = Math.random): Outcome {
  if (!retryable || attempts >= MAX_ATTEMPTS) return { status: 'dead' }
  return { status: 'failed', retryInSeconds: backoffSeconds(attempts, random) }
}

const DEFAULT_PREFS: Record<string, boolean> = { email: true, whatsapp: true, sms: false, push: false }

/** Missing/invalid prefs fall back to the column default. An explicit false always wins. */
export function channelAllowed(prefs: unknown, channel: string, template: string): boolean {
  if (ALWAYS_SEND.has(template) && channel === 'email') return true
  const p = prefs && typeof prefs === 'object' && !Array.isArray(prefs) ? (prefs as Record<string, unknown>) : {}
  const v = p[channel]
  if (typeof v === 'boolean') return v
  return DEFAULT_PREFS[channel] ?? false
}

/** One in-app notification per event, not per channel: strips a trailing :channel from the dedupe key. */
export function eventKey(row: { id: string; dedupe_key?: string | null; payload?: Record<string, unknown> | null }): string {
  const fromPayload = row.payload && typeof row.payload.event_key === 'string' ? row.payload.event_key : null
  if (fromPayload) return fromPayload
  if (row.dedupe_key) return row.dedupe_key.replace(/[:|_-](email|whatsapp|sms|push)$/i, '')
  return row.id
}
