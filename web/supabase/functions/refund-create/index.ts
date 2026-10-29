import { createHandler } from '../_shared/handler.ts'
import { HttpError, ok, readJson } from '../_shared/http.ts'
import { requirePerm } from '../_shared/auth.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { enforceRateLimit } from '../_shared/ratelimit.ts'
import { beginIdempotent, completeIdempotent, releaseIdempotent } from '../_shared/idempotency.ts'
import { RazorpayError, refund as rzpRefund } from '../_shared/razorpay.ts'
import { enqueueForProfile } from '../_shared/enqueue.ts'
import { formatINR } from '../_shared/money.ts'
import { RE, asObject, int, reqStr, str } from '../_shared/validate.ts'

const handle = createHandler('refund-create', ['POST'], async (req, ctx) => {
  const auth = await requirePerm(req, 'orders')
  ctx.setActor(auth.userId)
  const db = serviceClient()

  await enforceRateLimit(db, req, {
    scope: 'refund',
    userId: auth.userId,
    user: { max: 10, windowSec: 60 },
    ip: { max: 30, windowSec: 60 },
    onError: (e) => void ctx.log.warn('ratelimit_error', String((e as Error).message)),
  })

  const b = asObject(await readJson(req, 4 * 1024))
  const paymentId = reqStr(b.payment_id, 'payment_id', { re: RE.uuid })
  const reason = str(b.reason, 'reason', { max: 300, optional: true }) ?? 'Refund requested by staff'
  const idemKey = reqStr(b.idempotency_key, 'idempotency_key', { re: RE.idem })
  const requestedAmount = int(b.amount_paise, 'amount_paise', { min: 1, max: 100_000_000, optional: true })
  const refundId = str(b.refund_id, 'refund_id', { re: RE.uuid, optional: true }) // existing pending request row

  const idem = await beginIdempotent(db, 'refund', auth.userId, idemKey)
  if (idem.state === 'replay') return ok(req, idem.response, 200, { 'Idempotent-Replay': 'true' })

  try {
    const { data: pay, error } = await db
      .from('payments')
      .select('id, user_id, order_id, subscription_id, provider_payment_id, amount_paise, status')
      .eq('id', paymentId).maybeSingle()
    if (error) throw new HttpError(503, 'refund_unavailable', 'Could not load the payment. Please retry', { retryAfterSec: 3 })
    if (!pay) throw new HttpError(404, 'payment_not_found', 'Payment not found')
    if (!pay.provider_payment_id || (pay.status !== 'captured' && pay.status !== 'refunded')) {
      throw new HttpError(409, 'not_refundable', 'Only captured payments can be refunded')
    }

    // Refundable = captured amount minus refunds already pending or processed.
    const { data: prior, error: priorErr } = await db
      .from('refunds').select('id, amount_paise, status, provider_refund_id').eq('payment_id', pay.id)
    if (priorErr) throw new HttpError(503, 'refund_unavailable', 'Could not load refunds. Please retry', { retryAfterSec: 3 })
    const requestRow = refundId ? (prior ?? []).find((r: any) => r.id === refundId) : null
    if (refundId && (!requestRow || requestRow.provider_refund_id)) {
      throw new HttpError(409, 'refund_request_invalid', 'That refund request is not open')
    }
    const used = (prior ?? [])
      .filter((r: any) => (r.status === 'processed' || r.status === 'pending') && r.id !== refundId && (r.provider_refund_id || r.status === 'processed'))
      .reduce((t: number, r: any) => t + r.amount_paise, 0)
    const remaining = pay.amount_paise - used
    const amount = requestedAmount ?? requestRow?.amount_paise ?? remaining
    if (amount <= 0 || amount > remaining) {
      throw new HttpError(422, 'refund_amount_invalid', `Refund must be between Rs 0.01 and ${formatINR(Math.max(0, remaining))}`)
    }

    let rr
    try {
      rr = await rzpRefund(pay.provider_payment_id, {
        amountPaise: amount,
        idempotencyKey: idem.key.slice(-36),
        notes: { reason: reason.slice(0, 200), by: auth.userId },
      })
    } catch (e) {
      if (e instanceof RazorpayError) {
        await ctx.log.error('razorpay_refund_rejected', e.message, { status: e.status, rzp_code: e.rzpCode, payment: pay.id })
        throw new HttpError(502, 'payment_provider_error', `The payment provider rejected the refund: ${e.message.slice(0, 120)}`)
      }
      throw e // 503 with Retry-After on outage
    }

    const status = rr.status === 'processed' ? 'processed' : rr.status === 'failed' ? 'failed' : 'pending'
    const { data: marked, error: markErr } = await db.rpc('mark_refund', {
      p_payment_id: pay.id, p_amount_paise: amount, p_provider_refund_id: rr.id, p_status: status,
    })
    if (markErr) {
      // Money has moved at Razorpay; the refund.processed webhook will reconcile via mark_refund.
      await ctx.log.error('mark_refund_failed', markErr.message, { payment: pay.id, rzp_refund: rr.id })
      throw new HttpError(503, 'refund_recording_delayed', 'Refund was sent to the provider and will be recorded shortly', { retryAfterSec: 30 })
    }
    await ctx.log.info('refund_created', 'Refund created', { payment: pay.id, rzp_refund: rr.id, amount_paise: amount, status })

    if (status === 'processed') {
      await enqueueForProfile(db, pay.user_id, 'refund_processed',
        { order_id: pay.order_id, refund_id: rr.id, amount_paise: amount, amount_text: formatINR(amount), status },
        `refund:${rr.id}`)
    }

    const response = { refund_id: rr.id, status, amount_paise: amount, payment_id: pay.id, result: marked }
    await completeIdempotent(db, idem.key, response)
    return ok(req, response, 201)
  } catch (e) {
    await releaseIdempotent(db, idem.key)
    throw e
  }
})

Deno.serve(handle)
