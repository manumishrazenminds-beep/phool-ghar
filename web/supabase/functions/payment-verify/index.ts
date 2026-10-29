import { createHandler } from '../_shared/handler.ts'
import { HttpError, ok, readJson } from '../_shared/http.ts'
import { requireUser } from '../_shared/auth.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { enforceRateLimit } from '../_shared/ratelimit.ts'
import { RazorpayError, fetchPayment, verifyCheckoutSignature } from '../_shared/razorpay.ts'
import { amountMatches, loadPaymentByOrder, markCaptured, sanitizePayment } from '../_shared/payments.ts'
import { RE, asObject, reqStr } from '../_shared/validate.ts'

const handle = createHandler('payment-verify', ['POST'], async (req, ctx) => {
  const auth = await requireUser(req)
  ctx.setActor(auth.userId)
  const db = serviceClient()

  await enforceRateLimit(db, req, {
    scope: 'payverify',
    userId: auth.userId,
    user: { max: 20, windowSec: 60 },
    ip: { max: 60, windowSec: 60 },
    onError: (e) => void ctx.log.warn('ratelimit_error', String((e as Error).message)),
  })

  const b = asObject(await readJson(req, 4 * 1024))
  const orderId = reqStr(b.razorpay_order_id, 'razorpay_order_id', { re: RE.rzpOrder })
  const paymentId = reqStr(b.razorpay_payment_id, 'razorpay_payment_id', { re: RE.rzpPayment })
  const signature = reqStr(b.razorpay_signature, 'razorpay_signature', { re: RE.hex64 })

  // Ownership: the payment row must belong to the caller. Same 404 for "not yours" and "not found".
  const row = await loadPaymentByOrder(db, orderId)
  if (!row || row.user_id !== auth.userId) throw new HttpError(404, 'payment_not_found', 'We could not find this payment')

  const target = { order_id: row.order_id ?? undefined, subscription_id: row.subscription_id ?? undefined }

  // Webhook may have won the race, or the client is retrying: already captured is a success.
  if (row.status === 'captured' || row.status === 'refunded') {
    return ok(req, { status: 'captured', already: true, ...target })
  }

  if (!(await verifyCheckoutSignature(orderId, paymentId, signature))) {
    await ctx.log.warn('bad_signature', 'Checkout signature mismatch', { rzp_order: orderId, rzp_payment: paymentId })
    throw new HttpError(400, 'bad_signature', 'Payment could not be verified')
  }

  // Cross-check with Razorpay: amount, currency, order binding, status. If Razorpay is down the
  // HMAC alone already proves this payment id was issued for this order, so we continue on it.
  let method: string | null = null
  let raw: Record<string, unknown> = { verified_via: 'signature' }
  try {
    const p = await fetchPayment(paymentId)
    if (p.order_id !== orderId || !amountMatches(row, p.amount, p.currency)) {
      await ctx.log.error('amount_mismatch', 'Razorpay payment does not match our payment row', {
        payment_row: row.id, expected_paise: row.amount_paise, got_paise: p.amount, got_currency: p.currency, order_match: p.order_id === orderId,
      })
      throw new HttpError(409, 'payment_mismatch', 'This payment does not match your order. Please contact support')
    }
    if (p.status === 'failed') {
      throw new HttpError(402, 'payment_failed', 'The payment did not go through')
    }
    if (p.status !== 'captured') {
      // authorized but not yet captured: the webhook finishes the job once Razorpay captures.
      return ok(req, { status: 'processing', ...target }, 202)
    }
    method = p.method ?? null
    raw = { verified_via: 'api', payment: sanitizePayment(p) }
  } catch (e) {
    if (e instanceof HttpError && e.code === 'payment_provider_unavailable') {
      await ctx.log.warn('verify_signature_only', 'Razorpay unreachable; capturing on signature alone', { rzp_payment: paymentId })
    } else if (e instanceof RazorpayError) {
      await ctx.log.error('razorpay_fetch_rejected', e.message, { status: e.status, rzp_code: e.rzpCode })
      throw new HttpError(502, 'payment_provider_error', 'We could not confirm this payment with the provider. Please contact support')
    } else {
      throw e
    }
  }

  const result = await markCaptured(db, orderId, paymentId, method, raw) as { ok?: boolean; code?: string; message?: string } | null
  if (!result || result.ok === false) {
    await ctx.log.error('mark_captured_rejected', String(result?.message ?? 'mark_payment_captured returned not ok'), { rzp_order: orderId, rzp_payment: paymentId, code: result?.code })
    throw new HttpError(409, 'payment_mismatch', 'We could not match this payment to your order. If money was deducted, contact support and quote your payment id')
  }
  return ok(req, { status: 'captured', ...target, result })
})

Deno.serve(handle)
