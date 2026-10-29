// Edge Function: notify-dispatch
// Auth: CRON_SECRET or service role key (Authorization: Bearer ... or x-cron-secret).
// Claims a batch from notification_outbox (claim_notification_batch RPC: UPDATE ... WHERE id IN
// (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING), sends per channel respecting profiles.notify_prefs,
// writes the in-app notification, and marks each row sent / failed (exponential backoff) / dead (6 tries).
import { preflight } from '../_shared/cors.ts'
import { fail, failFromError, HttpError, ok, readJson } from '../_shared/http.ts'
import { readEnv } from '../_shared/env.ts'
import { serviceClient, type Db } from '../_shared/supabase.ts'
import { isTemplateKey, renderTemplate, type RenderCtx, type Rendered } from '../_shared/emailTemplates.ts'
import { emailConfigured, sendEmail, type SendResult } from '../_shared/email.ts'
import { sendWebPush } from '../_shared/webpush.ts'
import { buildWaLink, normalizePhone, sendSms, sendWhatsAppCloud, whatsappCloudConfigured } from '../_shared/whatsapp.ts'
import { chunk, loadSettings, logApp, requireCronOrService } from './lib.ts'
import { channelAllowed, eventKey, MAX_ATTEMPTS, nextState } from './logic.ts'

interface OutboxRow {
  id: string
  user_id: string | null
  channel: 'email' | 'whatsapp' | 'sms' | 'push'
  template: string
  to_address: string | null
  payload: Record<string, unknown> | null
  attempts: number
  dedupe_key: string | null
}

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  notify_prefs: unknown
}

const CONCURRENCY = 5
const DEADLINE_MS = 45_000

const unwrap = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback)

async function mark(db: Db, id: string, patch: Record<string, unknown>): Promise<void> {
  // Guarded on status='sending' so a slow worker cannot overwrite a row another worker reclaimed.
  const { error } = await db.from('notification_outbox').update(patch).eq('id', id).eq('status', 'sending')
  if (error) await logApp(db, 'error', 'notify-dispatch', 'mark_failed', `Could not update outbox row ${id}`, { error: error.message, patch })
}

async function writeInApp(db: Db, row: OutboxRow, rendered: Rendered): Promise<void> {
  if (!row.user_id) return
  const key = eventKey(row)
  // The SQL side (_notify_user) already wrote the in-app row for this event: do not add a second one.
  const base = row.dedupe_key?.replace(/:(email|whatsapp|sms|push)$/, '')
  if (base) {
    const { data: sqlRow } = await db.from('notifications').select('id').eq('dedupe_key', `${base}:in_app`).limit(1)
    if (sqlRow && sqlRow.length) return
  }
  const { data: existing } = await db.from('notifications').select('id').eq('user_id', row.user_id).contains('data', { event_key: key }).limit(1)
  if (existing && existing.length) return
  const p = row.payload ?? {}
  const data: Record<string, unknown> = { event_key: key, outbox_id: row.id, template: row.template }
  for (const k of ['order_id', 'order_no', 'subscription_id']) if (p[k] !== undefined) data[k] = p[k]
  const { error } = await db.from('notifications').insert({ user_id: row.user_id, type: rendered.inapp.type, title: rendered.inapp.title, body: rendered.inapp.body, data })
  if (error) throw new Error(`in-app insert failed: ${error.message}`)
}

async function processRow(db: Db, row: OutboxRow, profile: Profile | undefined, ctx: RenderCtx): Promise<{ id: string; status: string; note?: string }> {
  const finishDead = async (error: string) => {
    await mark(db, row.id, { status: 'dead', last_error: error.slice(0, 500) })
    return { id: row.id, status: 'dead', note: error }
  }
  try {
    if (!isTemplateKey(row.template)) return await finishDead(`Unknown template ${row.template}`)

    if (!channelAllowed(profile?.notify_prefs, row.channel, row.template)) {
      await mark(db, row.id, { status: 'sent', sent_at: new Date().toISOString(), last_error: `skipped:pref_off:${row.channel}` })
      return { id: row.id, status: 'skipped', note: 'pref_off' }
    }

    const payload = { ...(row.payload ?? {}) }
    if (!payload.name && profile?.full_name) payload.name = profile.full_name.split(' ')[0]
    const rendered = renderTemplate(row.template, payload, ctx)

    // In-app inbox is written once per event, before any external send, and never blocks delivery.
    let inappError: string | undefined
    try {
      await writeInApp(db, row, rendered)
    } catch (e) {
      inappError = (e as Error).message
      await logApp(db, 'warn', 'notify-dispatch', 'inapp_failed', inappError, { outbox_id: row.id })
    }

    let result: SendResult
    let skipNote: string | undefined
    let payloadPatch: Record<string, unknown> | undefined

    if (row.channel === 'email') {
      const to = (row.to_address || profile?.email || '').trim()
      if (!to) return await finishDead('No email address for recipient')
      result = emailConfigured()
        ? await sendEmail({ to, subject: rendered.subject, html: rendered.html, text: rendered.text, idempotencyKey: `outbox-${row.id}`, tags: [{ name: 'template', value: row.template }] })
        : { ok: false, retryable: true, error: 'Email not configured: set RESEND_API_KEY and EMAIL_FROM' }
    } else if (row.channel === 'whatsapp') {
      const phone = row.to_address || profile?.phone || ''
      if (!normalizePhone(phone)) return await finishDead('No valid WhatsApp number for recipient')
      if (whatsappCloudConfigured()) {
        result = await sendWhatsAppCloud({ to: phone, text: rendered.whatsapp, templateName: row.template })
      } else {
        // Free tier: nothing to send automatically. Keep a click-to-chat link on the row for staff/admin tools.
        result = { ok: true, skipped: 'whatsapp_cloud_not_configured' }
        skipNote = 'skipped:whatsapp_cloud_not_configured'
        payloadPatch = { ...(row.payload ?? {}), wa_link: buildWaLink(phone, rendered.whatsapp), wa_text: rendered.whatsapp }
      }
    } else if (row.channel === 'sms') {
      result = await sendSms(row.to_address || profile?.phone, rendered.whatsapp)
      if (result.ok && result.skipped) skipNote = `skipped:${result.skipped}`
    } else {
      result = row.user_id ? await sendWebPush(db, row.user_id, { title: rendered.subject, body: rendered.whatsapp }) : { ok: true, skipped: 'no_user' }
      if (result.ok && result.skipped) skipNote = `skipped:${result.skipped}`
    }

    if (result.ok) {
      const patch: Record<string, unknown> = { status: 'sent', sent_at: new Date().toISOString(), last_error: skipNote ?? inappError ? (skipNote ?? `inapp:${inappError}`) : null }
      if (payloadPatch) patch.payload = payloadPatch
      await mark(db, row.id, patch)
      return { id: row.id, status: skipNote ? 'skipped' : 'sent', note: skipNote }
    }

    const outcome = nextState(row.attempts, result.retryable)
    if (outcome.status === 'dead') return await finishDead(result.error)
    if (outcome.status === 'failed') {
      await mark(db, row.id, { status: 'failed', last_error: result.error.slice(0, 500), next_attempt_at: new Date(Date.now() + outcome.retryInSeconds * 1000).toISOString() })
      return { id: row.id, status: 'failed', note: result.error }
    }
    return { id: row.id, status: 'sent' }
  } catch (e) {
    // Unexpected error: treat as retryable so a transient DB blip does not lose the message.
    const msg = (e as Error).message ?? String(e)
    const outcome = nextState(row.attempts, true)
    if (outcome.status === 'failed') {
      await mark(db, row.id, { status: 'failed', last_error: msg.slice(0, 500), next_attempt_at: new Date(Date.now() + outcome.retryInSeconds * 1000).toISOString() })
      return { id: row.id, status: 'failed', note: msg }
    }
    await mark(db, row.id, { status: 'dead', last_error: msg.slice(0, 500) })
    return { id: row.id, status: 'dead', note: msg }
  }
}

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST' && req.method !== 'GET') return fail(req, 405, 'method_not_allowed', 'Use POST')
  const started = Date.now()
  try {
    await requireCronOrService(req)
    let limit = Number(new URL(req.url).searchParams.get('limit')) || 25
    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
      const body = await readJson(req, 4096).catch(() => ({})) as Record<string, unknown>
      if (typeof body.limit === 'number') limit = body.limit
    }
    limit = Math.min(Math.max(Math.floor(limit), 1), 100)

    const db = serviceClient()
    const { data: claimed, error } = await db.rpc('claim_notification_batch', { p_limit: limit, p_lease_seconds: 300 })
    if (error) {
      await logApp(db, 'error', 'notify-dispatch', 'claim_failed', error.message)
      throw new HttpError(503, 'claim_failed', 'Could not claim notifications. Is migration 20261024990100_outbox_claim.sql applied?')
    }
    const rows = (claimed ?? []) as OutboxRow[]
    if (!rows.length) return ok(req, { claimed: 0, sent: 0, skipped: 0, failed: 0, dead: 0 })

    const settings = await loadSettings(db, ['store_name', 'support_whatsapp'])
    const ctx: RenderCtx = {
      siteUrl: readEnv('SITE_URL') ?? '',
      storeName: unwrap(settings.store_name, readEnv('STORE_NAME') ?? 'Phool Ghar'),
      supportWhatsapp: unwrap(settings.support_whatsapp) || undefined,
    }

    const userIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))]
    const profiles = new Map<string, Profile>()
    for (const ids of chunk(userIds, 100)) {
      const { data } = await db.from('profiles').select('id, full_name, email, phone, notify_prefs').in('id', ids)
      for (const p of (data ?? []) as Profile[]) profiles.set(p.id, p)
    }

    const results: Array<{ id: string; status: string; note?: string }> = []
    const unprocessed: OutboxRow[] = []
    let cursor = 0
    const worker = async () => {
      while (cursor < rows.length) {
        const row = rows[cursor++]
        if (Date.now() - started > DEADLINE_MS) {
          unprocessed.push(row)
          continue
        }
        results.push(await processRow(db, row, row.user_id ? profiles.get(row.user_id) : undefined, ctx))
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker))

    // Out of time: hand untouched rows back without burning an attempt.
    for (const r of unprocessed) {
      await db.from('notification_outbox').update({ status: 'queued', attempts: Math.max(0, r.attempts - 1), next_attempt_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'sending')
    }

    const count = (s: string) => results.filter((r) => r.status === s).length
    const summary = { claimed: rows.length, sent: count('sent'), skipped: count('skipped'), failed: count('failed'), dead: count('dead'), released: unprocessed.length, max_attempts: MAX_ATTEMPTS }
    if (summary.failed || summary.dead) {
      await logApp(db, summary.dead ? 'error' : 'warn', 'notify-dispatch', 'batch_partial', `${summary.failed} failed, ${summary.dead} dead of ${summary.claimed}`, results.filter((r) => r.status === 'failed' || r.status === 'dead').slice(0, 20))
    }
    return ok(req, summary)
  } catch (e) {
    if (e instanceof HttpError) return failFromError(req, e)
    try {
      await logApp(serviceClient(), 'error', 'notify-dispatch', 'unhandled', (e as Error).message)
    } catch { /* ignore */ }
    return fail(req, 500, 'internal_error', 'Dispatch failed')
  }
})
