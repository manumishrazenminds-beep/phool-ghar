import { createHandler } from '../_shared/handler.ts'
import { ok, readJson } from '../_shared/http.ts'
import { requireUser } from '../_shared/auth.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { enforceRateLimit } from '../_shared/ratelimit.ts'
import { beginIdempotent, completeIdempotent, releaseIdempotent } from '../_shared/idempotency.ts'
import { HttpError } from '../_shared/http.ts'
import { RazorpayError, createOrder, razorpayKeyIdPublic } from '../_shared/razorpay.ts'
import { env } from '../_shared/env.ts'
import { isPaise } from '../_shared/money.ts'
import { parseBody } from './parse.ts'

const MAX_BODY = 16 * 1024

const handle = createHandler('checkout-create', ['POST'], async (req, ctx) => {
  const auth = await requireUser(req)
  ctx.setActor(auth.userId)
  const db = serviceClient()

  await enforceRateLimit(db, req, {
    scope: 'checkout',
    userId: auth.userId,
    user: { max: 10, windowSec: 60 },
    ip: { max: 30, windowSec: 60 },
    onError: (e) => void ctx.log.warn('ratelimit_error', String((e as Error).message)),
  })

  const { idempotencyKey, payload } = parseBody(await readJson(req, MAX_BODY))

  // Layer 1: a double click or network retry with the same key replays the stored response.
  const idem = await beginIdempotent(db, 'checkout', auth.userId, idempotencyKey)
  if (idem.state === 'replay') return ok(req, idem.response, 200, { 'Idempotent-Replay': 'true' })

  try {
    // Layer 2: create_checkout is itself idempotent on p_idem, so a lost response is safe to retry.
    const { data: co, error: coErr } = await db.rpc('create_checkout', {
      p_user: auth.userId,
      p_payload: payload,
      p_idem: idempotencyKey,
    })
    if (coErr) {
      const msg = String(coErr.message ?? '')
      // RPCs raise business errors as 'code: message'; surface them as 422 without leaking internals.
      if (coErr.code && /^P0001$|^22|^23/.test(coErr.code)) {
        throw new HttpError(422, 'checkout_rejected', msg.slice(0, 200) || 'Checkout could not be completed')
      }
      await ctx.log.error('create_checkout_failed', msg, { pg: coErr.code })
      throw new HttpError(503, 'checkout_unavailable', 'Checkout is temporarily unavailable. Please retry', { retryAfterSec: 3 })
    }
    const kind: string = co?.kind
    const entityId: string | undefined = co?.order_id ?? co?.subscription_id
    const amount = co?.amount_paise
    if (!entityId || !isPaise(amount) || amount <= 0) {
      await ctx.log.error('create_checkout_bad_shape', 'create_checkout returned an unexpected result', { kind })
      throw new HttpError(500, 'internal_error', 'Something went wrong. Please try again')
    }
    const col = co.order_id ? 'order_id' : 'subscription_id'

    // Reuse a payment row if an earlier attempt already created the Razorpay order (retry after a crash).
    let rzpOrderId: string | null = null
    {
      const { data: existing } = await db
        .from('payments').select('provider_order_id, amount_paise, status').eq(col, entityId).eq('status', 'created')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (existing && existing.amount_paise === amount) rzpOrderId = existing.provider_order_id
    }

    if (!rzpOrderId) {
      let order
      try {
        order = await createOrder({
          amountPaise: amount,
          receipt: String(entityId).replace(/-/g, ''),
          notes: { kind, entity_id: String(entityId), user_id: auth.userId },
        })
      } catch (e) {
        if (e instanceof RazorpayError) {
          await ctx.log.error('razorpay_order_rejected', e.message, { status: e.status, rzp_code: e.rzpCode })
          throw new HttpError(502, 'payment_provider_error', 'The payment provider rejected the request. Please try again or contact support')
        }
        throw e // HttpError 503 with Retry-After for outages
      }
      if (order.amount !== amount || order.currency !== 'INR') {
        await ctx.log.error('razorpay_order_mismatch', 'Razorpay order amount differs from checkout amount', { expected: amount, got: order.amount })
        throw new HttpError(502, 'payment_provider_error', 'The payment provider returned an unexpected result')
      }
      const { error: insErr } = await db.from('payments').insert({
        user_id: auth.userId,
        order_id: co.order_id ?? null,
        subscription_id: co.subscription_id ?? null,
        provider: 'razorpay',
        provider_order_id: order.id,
        amount_paise: amount,
        currency: 'INR',
        status: 'created',
      })
      if (insErr) {
        await ctx.log.error('payment_row_insert_failed', insErr.message, { rzp_order: order.id, pg: insErr.code })
        throw new HttpError(503, 'checkout_unavailable', 'Checkout is temporarily unavailable. Please retry', { retryAfterSec: 3 })
      }
      rzpOrderId = order.id
    }

    const response = {
      kind,
      order_id: co.order_id ?? undefined,
      subscription_id: co.subscription_id ?? undefined,
      summary: co.summary ?? undefined,
      payment: {
        key_id: razorpayKeyIdPublic(),
        razorpay_order_id: rzpOrderId,
        amount_paise: amount,
        currency: 'INR',
        name: env.storeName,
        prefill: {
          name: auth.profile.full_name ?? undefined,
          email: auth.email ?? undefined,
          contact: auth.profile.phone ?? undefined,
        },
      },
    }
    await completeIdempotent(db, idem.key, response)
    return ok(req, response, 201)
  } catch (e) {
    await releaseIdempotent(db, idem.key) // let the client retry with the same key
    throw e
  }
})

Deno.serve(handle)
