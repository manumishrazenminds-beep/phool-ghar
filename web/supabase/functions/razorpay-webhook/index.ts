import { createHandler } from '../_shared/handler.ts'
import { HttpError, ok, readBodyText } from '../_shared/http.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { verifyWebhookSignature } from '../_shared/razorpay.ts'
import { amountMatches, loadPaymentByOrder, markCaptured, sanitizePayment, sanitizeRefund } from '../_shared/payments.ts'
import { enforceRateLimit } from '../_shared/ratelimit.ts'
import { enqueueForProfile } from '../_shared/enqueue.ts'
import { formatINR } from '../_shared/money.ts'
import { ORPHAN_GRACE_SEC, eventAgeSec, eventId, paymentEntity, refundEntity } from './events.ts'

const MAX_BODY = 512 * 1024

type Outcome = { processed: boolean; note?: string }

const handle = createHandler('razorpay-webhook', ['POST'], async (req, ctx) => {
  const db = serviceClient()

  // Cheap flood guard before any HMAC work. Razorpay's own volume is far below this.
  await enforceRateLimit(db, req, { scope: 'rzp-webhook', ip: { max: 600, windowSec: 60 }, onError: () => {} })

  const raw = await readBodyText(req, MAX_BODY) // RAW text: the signature covers exact bytes
  const sig = req.headers.get('x-razorpay-signature')
  if (!(await verifyWebhookSignature(raw, sig))) {
    await ctx.log.warn('webhook_bad_signature', 'Rejected webhook with invalid signature')
    throw new HttpError(400, 'bad_signature', 'Invalid signature')
  }

  let evt: any
  try { evt = JSON.parse(raw) } catch { throw new HttpError(400, 'invalid_json', 'Body is not valid JSON') }
  const type: string = String(evt?.event ?? '')
  if (!type) throw new HttpError(400, 'invalid_event', 'Missing event type')
  const id = await eventId(req.headers.get('x-razorpay-event-id'), raw)

  // Replay protection: webhook_events.id is the primary key.
  const stored = {
    event: type, account_id: evt.account_id, created_at: evt.created_at,
    payment: sanitizePayment(paymentEntity(evt)), refund: sanitizeRefund(refundEntity(evt)),
  }
  const ins = await db.from('webhook_events').insert({ id, provider: 'razorpay', type, payload: stored })
  if (ins.error) {
    if (ins.error.code !== '23505') {
      await ctx.log.error('webhook_persist_failed', ins.error.message, { id, type })
      throw new HttpError(500, 'persist_failed', 'Could not record event') // Razorpay will retry
    }
    const { data: prev } = await db.from('webhook_events').select('processed_at').eq('id', id).maybeSingle()
    if (prev?.processed_at) return ok(req, { received: true, duplicate: true })
    // Persisted earlier but never finished (crash / transient error): fall through and process again.
  }

  let outcome: Outcome
  try {
    outcome = await dispatch(db, ctx, type, evt)
  } catch (e) {
    // Transient failure (DB/RPC). Keep the row unprocessed and answer 500 so Razorpay retries.
    await db.from('webhook_events').update({ error: String((e as Error).message).slice(0, 500) }).eq('id', id)
    await ctx.log.error('webhook_handler_failed', (e as Error).message, { id, type })
    throw new HttpError(500, 'handler_failed', 'Event will be retried')
  }
  await db.from('webhook_events').update({ processed_at: new Date().toISOString(), error: outcome.note ?? null }).eq('id', id)
  return ok(req, { received: true, processed: outcome.processed })
})

async function dispatch(db: any, ctx: { log: any }, type: string, evt: any): Promise<Outcome> {
  switch (type) {
    case 'payment.captured':
    case 'order.paid':
      return await onCaptured(db, ctx, type, evt)
    case 'payment.failed':
      return await onFailed(db, ctx, evt)
    case 'refund.processed':
    case 'refund.failed':
      return await onRefund(db, ctx, type, evt)
    default:
      return { processed: false, note: 'ignored' } // payment.authorized, order.* others, etc.
  }
}

async function onCaptured(db: any, ctx: { log: any }, type: string, evt: any): Promise<Outcome> {
  const p = paymentEntity(evt)
  const orderId: string | undefined = p?.order_id ?? evt?.payload?.order?.entity?.id
  if (!p?.id || !orderId) return { processed: false, note: 'no payment entity' }

  const row = await loadPaymentByOrder(db, orderId)
  if (!row) {
    if (eventAgeSec(evt) < ORPHAN_GRACE_SEC) throw new Error(`payment row for ${orderId} not found yet`) // retry
    await ctx.log.error('webhook_unknown_order', 'Captured event for an order we have no payment row for', { rzp_order: orderId, rzp_payment: p.id })
    return { processed: false, note: 'unknown order' }
  }
  if (!amountMatches(row, p.amount, p.currency)) {
    await ctx.log.error('amount_mismatch', 'Webhook amount differs from our payment row; not marking paid', {
      payment_row: row.id, expected_paise: row.amount_paise, got_paise: p.amount, got_currency: p.currency, type,
    })
    return { processed: false, note: 'amount mismatch' } // permanent: 200 so Razorpay stops retrying
  }
  // Idempotent: client verify may already have captured this; the RPC treats that as a no-op.
  await markCaptured(db, orderId, p.id, p.method ?? null, { verified_via: 'webhook', event: type, payment: sanitizePayment(p) })
  return { processed: true }
}

async function onFailed(db: any, ctx: { log: any }, evt: any): Promise<Outcome> {
  const p = paymentEntity(evt)
  const orderId: string | undefined = p?.order_id
  if (!p?.id || !orderId) return { processed: false, note: 'no payment entity' }
  const row = await loadPaymentByOrder(db, orderId)
  if (!row) return { processed: false, note: 'unknown order' }
  // Out-of-order protection: a customer can fail a first attempt and succeed on a retry inside the
  // same Razorpay order, and the failed event may be delivered after the captured one. Never downgrade.
  if (row.status === 'captured' || row.status === 'refunded') {
    await ctx.log.info('failed_after_captured', 'Ignoring payment.failed for an already captured order', { payment_row: row.id })
    return { processed: false, note: 'stale failed event' }
  }
  const { error } = await db.rpc('mark_payment_failed', {
    p_provider_order_id: orderId,
    p_code: String(p.error_code ?? 'payment_failed').slice(0, 100),
    p_desc: String(p.error_description ?? '').slice(0, 300),
    p_raw: { verified_via: 'webhook', payment: sanitizePayment(p) },
  })
  if (error) throw new Error(`mark_payment_failed failed: ${error.message}`)
  return { processed: true }
}

async function onRefund(db: any, ctx: { log: any }, type: string, evt: any): Promise<Outcome> {
  const r = refundEntity(evt)
  if (!r?.id || !r?.payment_id) return { processed: false, note: 'no refund entity' }
  const { data: pay, error } = await db
    .from('payments').select('id, user_id, order_id, amount_paise').eq('provider_payment_id', r.payment_id).maybeSingle()
  if (error) throw new Error(`payment lookup failed: ${error.message}`)
  if (!pay) {
    if (eventAgeSec(evt) < ORPHAN_GRACE_SEC) throw new Error('payment for refund not found yet')
    await ctx.log.error('webhook_unknown_refund', 'Refund event for an unknown payment', { rzp_payment: r.payment_id })
    return { processed: false, note: 'unknown payment' }
  }
  const status = type === 'refund.processed' ? 'processed' : 'failed'
  const { error: rpcErr } = await db.rpc('mark_refund', {
    p_payment_id: pay.id, p_amount_paise: r.amount, p_provider_refund_id: r.id, p_status: status,
  })
  if (rpcErr) throw new Error(`mark_refund failed: ${rpcErr.message}`)
  if (status === 'processed') {
    // Same dedupe base as refund-create, so a refund started by staff and confirmed here notifies once.
    await enqueueForProfile(db, pay.user_id, 'refund_processed', { order_id: pay.order_id, refund_id: r.id, amount_paise: r.amount, amount_text: formatINR(r.amount) }, `refund:${r.id}`)
  }
  return { processed: true }
}

Deno.serve(handle)
