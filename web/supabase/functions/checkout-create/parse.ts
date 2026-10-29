import { HttpError } from '../_shared/http.ts'
import { RE, arr, asObject, dateStr, reqInt, reqStr, str } from '../_shared/validate.ts'

export function parseBody(raw: unknown) {
  const b = asObject(raw)
  const idempotencyKey = reqStr(b.idempotency_key, 'idempotency_key', { re: RE.idem })

  const lines = arr(b.lines, 'lines', { min: 1, max: 20 }).map((l, i) => {
    const o = asObject(l, `lines[${i}]`)
    const productId = str(o.product_id, `lines[${i}].product_id`, { re: RE.uuid, optional: true })
    const productSlug = str(o.product_slug, `lines[${i}].product_slug`, { re: RE.slug, optional: true })
    if (!productId && !productSlug) throw new HttpError(400, 'invalid_input', `lines[${i}]: product_id or product_slug is required`)
    return {
      product_id: productId,
      product_slug: productSlug,
      variant_key: str(o.variant_key, `lines[${i}].variant_key`, { re: /^[a-z0-9_-]{1,32}$/, optional: true }),
      qty: reqInt(o.qty, `lines[${i}].qty`, { min: 1, max: 50 }),
    }
  })

  let address: Record<string, unknown> | undefined
  if (b.address !== undefined && b.address !== null) {
    const a = asObject(b.address, 'address')
    address = {
      recipient_name: reqStr(a.recipient_name, 'address.recipient_name', { min: 2, max: 80 }),
      recipient_phone: reqStr(a.recipient_phone, 'address.recipient_phone', { re: /^[+0-9][0-9 -]{7,17}$/ }),
      line1: reqStr(a.line1, 'address.line1', { min: 3, max: 200 }),
      line2: str(a.line2, 'address.line2', { max: 200, optional: true }),
      landmark: str(a.landmark, 'address.landmark', { max: 120, optional: true }),
      city: str(a.city, 'address.city', { max: 80, optional: true }),
      pincode: reqStr(a.pincode, 'address.pincode', { re: /^[1-9][0-9]{5}$/ }),
      instructions: str(a.instructions, 'address.instructions', { max: 300, optional: true }),
    }
  }
  const addressId = str(b.address_id, 'address_id', { re: RE.uuid, optional: true })
  if (!address && !addressId) throw new HttpError(400, 'invalid_input', 'address_id or address is required')

  let recipient: Record<string, unknown> | undefined
  if (b.recipient !== undefined && b.recipient !== null) {
    const r = asObject(b.recipient, 'recipient')
    recipient = {
      name: reqStr(r.name, 'recipient.name', { min: 2, max: 80 }),
      phone: str(r.phone, 'recipient.phone', { re: /^[+0-9][0-9 -]{7,17}$/, optional: true }),
    }
  }

  let subscription: Record<string, unknown> | undefined
  if (b.subscription !== undefined && b.subscription !== null) {
    const s = asObject(b.subscription, 'subscription')
    const days = arr(s.delivery_days, 'subscription.delivery_days', { min: 1, max: 7 }).map((d, i) => reqInt(d, `subscription.delivery_days[${i}]`, { min: 0, max: 6 }))
    if (new Set(days).size !== days.length) throw new HttpError(400, 'invalid_input', 'subscription.delivery_days has duplicates')
    subscription = {
      plan_days: reqInt(s.plan_days, 'subscription.plan_days', { min: 1, max: 366 }),
      delivery_days: days.sort((x, y) => x - y),
      start_date: dateStr(s.start_date, 'subscription.start_date'),
    }
  }

  const coupon = str(b.coupon_code, 'coupon_code', { max: 40, re: /^[A-Za-z0-9_-]{1,40}$/, optional: true })
  const payload = {
    lines,
    address_id: addressId,
    address,
    recipient,
    date: dateStr(b.date, 'date', !!subscription),
    slot_id: reqStr(b.slot_id, 'slot_id', { re: /^[a-z0-9_-]{1,32}$/ }),
    gift_note: str(b.gift_note, 'gift_note', { max: 300, optional: true }),
    instructions: str(b.instructions, 'instructions', { max: 300, optional: true }),
    coupon_code: coupon ? coupon.toUpperCase() : undefined,
    subscription,
  }
  if (!subscription && !payload.date) throw new HttpError(400, 'invalid_input', 'date: is required')
  return { idempotencyKey, payload }
}
