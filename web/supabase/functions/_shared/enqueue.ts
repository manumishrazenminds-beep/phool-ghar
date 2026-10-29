import type { Db } from './supabase.ts'

/** Queue a notification through the outbox RPC. Never throws: notifications must not break payments. */
export async function enqueue(
  db: Db,
  o: { userId: string | null; channel: 'email' | 'whatsapp' | 'sms' | 'push'; template: string; to: string; payload: Record<string, unknown>; dedupe: string },
): Promise<boolean> {
  try {
    const { error } = await db.rpc('enqueue_notification', {
      p_user: o.userId,
      p_channel: o.channel,
      p_template: o.template,
      p_to: o.to,
      p_payload: o.payload,
      p_dedupe: o.dedupe,
    })
    return !error
  } catch {
    return false
  }
}

/** Email + WhatsApp (when the profile has the data). Dedupe keys make repeats harmless. */
export async function enqueueForProfile(
  db: Db,
  userId: string,
  template: string,
  payload: Record<string, unknown>,
  dedupeBase: string,
): Promise<void> {
  try {
    const { data } = await db.from('profiles').select('email, phone, notify_prefs').eq('id', userId).maybeSingle()
    if (!data) return
    const prefs = data.notify_prefs ?? {}
    if (data.email && prefs.email !== false) await enqueue(db, { userId, channel: 'email', template, to: data.email, payload, dedupe: `${dedupeBase}:email` })
    if (data.phone && prefs.whatsapp !== false) await enqueue(db, { userId, channel: 'whatsapp', template, to: data.phone, payload, dedupe: `${dedupeBase}:whatsapp` })
  } catch {
    /* swallow */
  }
}
