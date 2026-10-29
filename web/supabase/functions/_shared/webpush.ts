// Web Push (VAPID). Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com).
// Generate keys once with: npx web-push generate-vapid-keys
import webpush from 'npm:web-push@3.6.7'
import { readEnv } from './env.ts'
import type { Db } from './supabase.ts'
import type { SendResult } from './email.ts'

export const pushConfigured = () => !!(readEnv('VAPID_PUBLIC_KEY') && readEnv('VAPID_PRIVATE_KEY'))

/** Sends to every browser the user has enabled. Dead endpoints (404/410) are removed. */
export async function sendWebPush(db: Db, userId: string, msg: { title: string; body: string; url?: string }): Promise<SendResult> {
  if (!pushConfigured()) return { ok: true, skipped: 'push_not_configured' }
  webpush.setVapidDetails(readEnv('VAPID_SUBJECT') ?? 'mailto:admin@example.com', readEnv('VAPID_PUBLIC_KEY')!, readEnv('VAPID_PRIVATE_KEY')!)
  const { data, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
  if (error) return { ok: false, retryable: true, error: `push subscriptions lookup failed: ${error.message}` }
  if (!data?.length) return { ok: true, skipped: 'no_push_subscription' }

  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? '/account/notifications' })
  let delivered = 0
  let transient: string | null = null
  for (const s of data as { id: string; endpoint: string; p256dh: string; auth: string }[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 })
      delivered++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      else transient = `push failed (${status ?? 'network'}): ${(e as Error).message}`
    }
  }
  if (delivered > 0 || !transient) return { ok: true }
  return { ok: false, retryable: true, error: transient }
}
