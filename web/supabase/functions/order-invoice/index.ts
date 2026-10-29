// Edge Function: order-invoice (user JWT). GET ?order_id=<uuid>[&format=json]
// Owner of the order, an admin, or staff holding the 'orders' permission may read it.
// Default response is the printable HTML. NOTE: Supabase serves text/html from the default functions domain
// as text/plain, so browsers should call with format=json and open data.html in a Blob/iframe (see docs/NOTIFICATIONS.md).
import { corsHeaders, preflight } from '../_shared/cors.ts'
import { fail, failFromError, HttpError, ok } from '../_shared/http.ts'
import { requireUser } from '../_shared/auth.ts'
import { enforceRateLimit } from '../_shared/ratelimit.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { RE } from '../_shared/validate.ts'
import { loadSettings, logApp } from '../notify-dispatch/lib.ts'
import { renderInvoiceHtml, type InvoiceInput } from './invoice.ts'

const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'number' ? v : Number(typeof v === 'string' ? v : NaN)
  return Number.isFinite(n) ? n : d
}

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'GET') return fail(req, 405, 'method_not_allowed', 'Use GET')
  try {
    const caller = await requireUser(req)
    const db = serviceClient()
    await enforceRateLimit(db, req, { scope: 'order-invoice', userId: caller.userId, user: { max: 30, windowSec: 60 }, ip: { max: 120, windowSec: 60 }, onError: (e) => console.warn('rate limiter error', e) })
    const url = new URL(req.url)
    const orderId = url.searchParams.get('order_id') ?? ''
    if (!RE.uuid.test(orderId)) throw new HttpError(400, 'invalid_input', 'order_id must be a valid id')

    const { data: order, error } = await db.from('orders').select('*').eq('id', orderId).maybeSingle()
    if (error) throw new HttpError(503, 'lookup_failed', 'Could not load the order')
    const { role, permissions } = caller.profile
    const staffOk = role === 'admin' || (role === 'staff' && permissions.includes('orders'))
    // Same answer for "missing" and "not yours" so ids cannot be probed.
    if (!order || (order.user_id !== caller.userId && !staffOk)) throw new HttpError(404, 'not_found', 'Order not found')

    const [{ data: items }, settings, { data: cust }] = await Promise.all([
      db.from('order_items').select('name_snapshot, variant_key, unit_price_paise, qty, line_total_paise').eq('order_id', orderId).order('id'),
      loadSettings(db, ['store_name', 'gstin', 'store_gstin', 'store_address', 'store_state', 'support_whatsapp', 'gst_percent']),
      db.from('profiles').select('full_name, email').eq('id', order.user_id).maybeSingle(),
    ])
    const input: InvoiceInput = {
      orderNo: order.order_no,
      createdAt: order.created_at,
      deliveryDate: order.delivery_date,
      paymentStatus: order.payment_status,
      kind: order.kind,
      lines: ((items ?? []) as Array<Record<string, unknown>>).map((i) => ({ name: txt(i.name_snapshot), variant: txt(i.variant_key) || null, qty: num(i.qty, 1), unit_paise: num(i.unit_price_paise), line_paise: num(i.line_total_paise) })),
      subtotalPaise: num(order.subtotal_paise),
      discountPaise: num(order.discount_paise),
      deliveryFeePaise: num(order.delivery_fee_paise),
      taxPaise: num(order.tax_paise),
      totalPaise: num(order.total_paise),
      couponCode: order.coupon_code,
      address: (order.address ?? {}) as Record<string, unknown>,
      customerName: cust?.full_name ?? null,
      customerEmail: cust?.email ?? null,
      seller: {
        name: txt(settings.store_name) || 'Phool Ghar',
        gstin: txt(settings.gstin) || txt(settings.store_gstin) || null,
        address: txt(settings.store_address) || null,
        state: txt(settings.store_state) || null,
        phone: txt(settings.support_whatsapp) || null,
      },
      gstPercent: num(settings.gst_percent, 0),
    }
    const { html, totals, title } = renderInvoiceHtml(input)

    if (url.searchParams.get('format') === 'json') {
      return ok(req, { html, filename: `${title.toLowerCase().replace(/\s+/g, '-')}-${order.order_no}.html`, order_no: order.order_no, total_paise: input.totalPaise, tax_paise: totals.taxPaise })
    }
    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
      },
    })
  } catch (e) {
    if (e instanceof HttpError) return failFromError(req, e)
    try {
      await logApp(serviceClient(), 'error', 'order-invoice', 'unhandled', (e as Error).message)
    } catch { /* ignore */ }
    return fail(req, 500, 'internal_error', 'Could not build the invoice')
  }
})
