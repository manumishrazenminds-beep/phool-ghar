import { backendConfigured, env } from './env'
import { supabase } from './supabase'
import * as demo from './demoCustomer'

/* ---------- types (mirror docs/BACKEND_CONTRACT.md) ---------- */

export type Role = 'customer' | 'admin' | 'staff' | 'delivery'
export type OrderStatus = 'placed' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'failed'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
export type SubStatus = 'pending_payment' | 'active' | 'paused' | 'on_hold' | 'cancelled' | 'completed'

export interface NotifyPrefs { email: boolean; whatsapp: boolean; sms: boolean; push: boolean }
export interface Profile {
  id: string; role: Role; full_name: string | null; phone: string | null; email: string | null
  permissions: string[]; active: boolean; lang: string; notify_prefs: NotifyPrefs
}
export interface Address {
  id: string; user_id: string; label: string | null; recipient_name: string; recipient_phone: string
  line1: string; line2: string | null; landmark: string | null; city: string; pincode: string
  instructions: string | null; is_default: boolean
}
export type AddressInput = Omit<Address, 'id' | 'user_id'> & { id?: string }
export interface AddressSnapshot {
  recipient_name?: string; recipient_phone?: string; line1?: string; line2?: string | null
  landmark?: string | null; city?: string; pincode?: string; instructions?: string | null
}
export interface PincodeInfo { ok: boolean; city: string | null; area: string | null; fee_paise: number }
export interface OrderItem { id: string; product_id: string; variant_key: string | null; name_snapshot: string; unit_price_paise: number; qty: number; line_total_paise: number }
export interface OrderRow {
  id: string; order_no: string; kind: 'one_time' | 'subscription_delivery'; subscription_id: string | null
  delivery_date: string; slot_id: string | null; status: OrderStatus; payment_status: PaymentStatus
  address: AddressSnapshot; gift_note: string | null; subtotal_paise: number; discount_paise: number
  delivery_fee_paise: number; tax_paise: number; total_paise: number; coupon_code: string | null
  failure_reason: string | null; delivered_at: string | null; created_at: string
}
export interface OrderEvent { id: string; order_id: string; status: string; note: string | null; created_at: string }
export interface SubscriptionRow {
  id: string; product_id: string; variant_key: string; plan_days: number; delivery_days: number[]
  start_date: string; end_date: string | null; slot_id: string | null; address: AddressSnapshot; status: SubStatus
  per_day_paise: number; total_paise: number; paid_through: string | null
  paused_from: string | null; paused_to: string | null; skipped_days: number
  cancelled_at: string | null; cancel_reason: string | null; created_at: string
  products?: { name: string; slug: string; image_url: string | null } | null
}
export interface NotificationRow { id: string; type: string; title: string; body: string | null; data: Record<string, unknown> | null; read_at: string | null; created_at: string }
export interface TicketRow { id: string; order_id: string | null; subject: string; message: string; status: 'open' | 'pending' | 'closed'; created_at: string }

/* ---------- errors ---------- */

export class ApiError extends Error {
  code: string
  network: boolean
  constructor(message: string, code = 'error', network = false) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.network = network
  }
}

export const NOT_CONNECTED = 'The shop is not connected to its backend yet.'
function assertBackend() {
  if (!backendConfigured) throw new ApiError(NOT_CONNECTED, 'not_configured')
}

/** Turn any thrown value into a calm, customer-facing sentence. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : (e as { message?: string })?.message ?? ''
  const code = e instanceof ApiError ? e.code : ''
  if (e instanceof ApiError && e.network) return 'We could not reach the server. Please check your connection and try again.'
  if (/cut-?off|too late|after 21|already locked/i.test(msg) || code === 'cutoff_passed') return 'The cut-off for that day has passed (9 PM the evening before). Please choose a later date.'
  if (/invalid login credentials/i.test(msg)) return 'That email and password do not match. Please try again.'
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. We sent you a link when you signed up.'
  if (/already registered|already been registered/i.test(msg)) return 'An account with this email already exists. Try signing in instead.'
  if (/rate limit|too many/i.test(msg) || code === 'rate_limited') return 'Too many attempts. Please wait a minute and try again.'
  if (/jwt (expired|invalid)|invalid jwt|not authenticated|session (expired|not found)|auth session missing/i.test(msg)) return 'Your session has expired. Please sign in again.'
  if (/failed to (send|fetch)|networkerror|network request|load failed/i.test(msg)) return 'We could not reach the server. Please check your connection and try again.'
  return msg || 'Something went wrong. Please try again.'
}

function wrapPg(error: { message: string; code?: string } | null): void {
  if (!error) return
  const net = /failed to fetch|networkerror|load failed/i.test(error.message)
  throw new ApiError(error.message, error.code ?? 'error', net)
}

/** '+91 98220-12345' -> '9822012345'. Returns null unless it is a valid 10-digit Indian mobile (the addresses table enforces this). */
export function normalizeIndianMobile(raw: string): string | null {
  const d = raw.replace(/[\s-]/g, '').replace(/^(\+?91|0)(?=\d{10}$)/, '')
  return /^[6-9]\d{9}$/.test(d) ? d : null
}
const ADDRESS_LABELS = ['Home', 'Office', 'Temple', 'Shop', 'Other']

/** Id of the signed-in user. Staff RLS lets admins read every customer's rows, so customer lists must filter by this. */
async function meId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new ApiError('Your session has expired. Please sign in again.', 'auth')
  return id
}

/* ---------- demo-mode state (no backend) ---------- */

const addrs = [...demo.demoAddresses]
const tickets = [...demo.demoTickets]
function saveDemoAddress(a: AddressInput, userId: string): Address {
  const { id, ...rest } = a
  if (rest.is_default) addrs.forEach((x) => { x.is_default = false })
  const existing = id ? addrs.find((x) => x.id === id) : undefined
  if (existing) return Object.assign(existing, rest)
  const row: Address = { ...rest, id: 'a' + Date.now(), user_id: userId }
  addrs.push(row)
  return row
}
function demoRpc<T>(name: string): T {
  if (name === 'check_pincode') return { ok: true, city: 'Pune', area: 'Demo area', fee_paise: 0 } as T
  return { ok: true } as T
}

/* ---------- RPC + Edge Function plumbing ---------- */

export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (demo.demoCustomerActive()) return demoRpc<T>(fn)
  assertBackend()
  try {
    const { data, error } = await supabase.rpc(fn, args)
    wrapPg(error)
    return data as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(e instanceof Error ? e.message : 'Request failed', 'error', true)
  }
}

/** Edge Function call that preserves the contract's `{ error: { code, message } }` envelope. */
export async function fn<T>(name: string, body?: unknown): Promise<T> {
  assertBackend()
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> | undefined })
  if (error) {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = await ctx.json()
        if (j?.error) throw new ApiError(j.error.message ?? error.message, j.error.code ?? 'error')
      } catch (inner) {
        if (inner instanceof ApiError) throw inner
      }
      throw new ApiError(error.message, 'error')
    }
    throw new ApiError(error.message, 'network', true)
  }
  const env2 = data as { data?: T; error?: { code: string; message: string } } | null
  if (env2?.error) throw new ApiError(env2.error.message, env2.error.code)
  return (env2 && 'data' in env2 ? env2.data : data) as T
}

/* ---------- reads ---------- */

export async function checkPincode(pincode: string): Promise<PincodeInfo> {
  const rows = await rpc<PincodeInfo[] | PincodeInfo | null>('check_pincode', { p_pincode: pincode })
  const r = Array.isArray(rows) ? rows[0] : rows
  return r ?? { ok: false, city: null, area: null, fee_paise: 0 }
}

export interface PricingRequest {
  lines: CheckoutLine[]
  pincode?: string
  slot_id?: string
  date?: string
  coupon_code?: string
}
export interface PricingResult {
  subtotal_paise: number; discount_paise: number; delivery_fee_paise: number; tax_paise?: number; total_paise: number
  slots?: { id: string; remaining?: number | null; available?: boolean }[]
  messages?: string[]
}
export const previewPricing = (req: PricingRequest) => rpc<PricingResult>('preview_pricing', { p_payload: req })

export interface CouponPreview { valid: boolean; discount_paise?: number; message?: string; code?: string }
export const applyCouponPreview = (code: string, subtotalPaise: number, kind: 'one_time' | 'subscription') =>
  rpc<CouponPreview>('apply_coupon_preview', { p_code: code.trim().toUpperCase(), p_subtotal_paise: subtotalPaise, p_kind: kind })

export async function listAddresses(): Promise<Address[]> {
  if (demo.demoCustomerActive()) return [...addrs]
  assertBackend()
  const uid = await meId()
  const { data, error } = await supabase.from('addresses').select('*').eq('user_id', uid).order('is_default', { ascending: false }).order('created_at', { ascending: false })
  wrapPg(error)
  return (data ?? []) as Address[]
}
export async function saveAddress(a: AddressInput, userId: string): Promise<Address> {
  if (demo.demoCustomerActive()) return saveDemoAddress(a, userId)
  assertBackend()
  const { id, is_default, ...rest } = a
  const phone = normalizeIndianMobile(rest.recipient_phone)
  if (!phone) throw new ApiError('Enter a valid 10-digit mobile number.', 'invalid_input')
  const label = rest.label && ADDRESS_LABELS.includes(rest.label) ? rest.label : 'Home'
  // Never write is_default here: the one-default unique index would reject it while another default exists.
  const row = { ...rest, label, recipient_phone: phone, user_id: userId }
  const q = id ? supabase.from('addresses').update(row).eq('id', id) : supabase.from('addresses').insert({ ...row, is_default: false })
  const { data, error } = await q.select().single()
  wrapPg(error)
  if (is_default) {
    await setDefaultAddress((data as Address).id, userId)
    return { ...(data as Address), is_default: true }
  }
  return data as Address
}
export async function deleteAddress(id: string) {
  if (demo.demoCustomerActive()) { const i = addrs.findIndex((x) => x.id === id); if (i >= 0) addrs.splice(i, 1); return }
  assertBackend()
  const { error } = await supabase.from('addresses').delete().eq('id', id)
  wrapPg(error)
}
export async function setDefaultAddress(id: string, userId: string) {
  if (demo.demoCustomerActive()) { addrs.forEach((x) => { x.is_default = x.id === id }); return }
  assertBackend()
  const a = await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId).neq('id', id)
  wrapPg(a.error)
  const b = await supabase.from('addresses').update({ is_default: true }).eq('id', id)
  wrapPg(b.error)
}

export async function listOrders(): Promise<OrderRow[]> {
  if (demo.demoCustomerActive()) return [...demo.demoOrders]
  assertBackend()
  const uid = await meId()
  const { data, error } = await supabase.from('orders').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(100)
  wrapPg(error)
  return (data ?? []) as OrderRow[]
}
export async function getOrder(id: string): Promise<{ order: OrderRow; items: OrderItem[]; events: OrderEvent[] } | null> {
  if (demo.demoCustomerActive()) return demo.demoOrderDetail(id)
  assertBackend()
  const uid = await meId()
  const [o, i, e] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).eq('user_id', uid).maybeSingle(),
    supabase.from('order_items').select('*').eq('order_id', id),
    supabase.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: true }),
  ])
  wrapPg(o.error)
  wrapPg(i.error)
  wrapPg(e.error)
  if (!o.data) return null
  return { order: o.data as OrderRow, items: (i.data ?? []) as OrderItem[], events: (e.data ?? []) as OrderEvent[] }
}
export const cancelOrder = (id: string, reason: string) => rpc<unknown>('cancel_order', { p_order: id, p_reason: reason })

export async function listSubscriptions(): Promise<{ subs: SubscriptionRow[]; skips: Record<string, string[]> }> {
  if (demo.demoCustomerActive()) return { subs: demo.demoSubscriptions, skips: demo.demoSkips }
  assertBackend()
  const uid = await meId()
  const s = await supabase.from('subscriptions').select('*, products(name, slug, image_url)').eq('user_id', uid).order('created_at', { ascending: false })
  wrapPg(s.error)
  const ids = ((s.data ?? []) as { id: string }[]).map((r) => r.id)
  const k = ids.length ? await supabase.from('subscription_skips').select('subscription_id, skip_date').in('subscription_id', ids) : { data: [], error: null }
  wrapPg(k.error)
  const skips: Record<string, string[]> = {}
  for (const r of (k.data ?? []) as { subscription_id: string; skip_date: string }[]) (skips[r.subscription_id] ??= []).push(r.skip_date)
  return { subs: (s.data ?? []) as SubscriptionRow[], skips }
}
export async function getSubscription(id: string): Promise<SubscriptionRow | null> {
  if (demo.demoCustomerActive()) return demo.demoSubscriptions.find((x) => x.id === id) ?? null
  assertBackend()
  const uid = await meId()
  const { data, error } = await supabase.from('subscriptions').select('*, products(name, slug, image_url)').eq('id', id).eq('user_id', uid).maybeSingle()
  wrapPg(error)
  return (data as SubscriptionRow) ?? null
}
export const skipDay = (sub: string, date: string) => rpc<unknown>('skip_subscription_day', { p_sub: sub, p_date: date })
export const unskipDay = (sub: string, date: string) => rpc<unknown>('unskip_subscription_day', { p_sub: sub, p_date: date })
export const pauseSub = (sub: string, from: string, to: string) => rpc<unknown>('pause_subscription', { p_sub: sub, p_from: from, p_to: to })
export const resumeSub = (sub: string) => rpc<unknown>('resume_subscription', { p_sub: sub })
export const updateSchedule = (sub: string, p: { days?: number[]; slot?: string; address?: AddressSnapshot }) =>
  rpc<{ ok: boolean; effective_from: string; end_date: string }>('update_subscription_schedule', { p_sub: sub, p_days: p.days ?? null, p_slot: p.slot ?? null, p_address: p.address ?? null })
export const requestRedelivery = (order: string, date: string, slot: string, note?: string) =>
  rpc<{ ok: boolean }>('request_redelivery', { p_order: order, p_date: date, p_slot: slot, p_note: note ?? null })
export const cancelSub = (sub: string, reason: string) => rpc<unknown>('cancel_subscription', { p_sub: sub, p_reason: reason })

export async function getSettings(): Promise<Record<string, unknown>> {
  if (!backendConfigured) return {}
  const { data } = await supabase.from('public_settings').select('*')
  const out: Record<string, unknown> = {}
  for (const r of (data ?? []) as { key: string; value: unknown }[]) out[r.key] = r.value
  return out
}

export async function createTicket(userId: string, t: { subject: string; message: string; order_id?: string | null }) {
  if (demo.demoCustomerActive()) { tickets.unshift({ id: 't' + Date.now(), order_id: t.order_id || null, subject: t.subject, message: t.message, status: 'open', created_at: new Date().toISOString() }); return }
  assertBackend()
  const { error } = await supabase.from('support_tickets').insert({ user_id: userId, subject: t.subject, message: t.message, order_id: t.order_id || null })
  wrapPg(error)
}
export async function listTickets(): Promise<TicketRow[]> {
  if (demo.demoCustomerActive()) return [...tickets]
  assertBackend()
  const uid = await meId()
  const { data, error } = await supabase.from('support_tickets').select('id, order_id, subject, message, status, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(20)
  wrapPg(error)
  return (data ?? []) as TicketRow[]
}

export async function updateProfile(id: string, patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'lang' | 'notify_prefs'>>): Promise<Profile> {
  if (demo.demoCustomerActive()) { Object.assign(demo.demoCustomerProfile, patch); return { ...demo.demoCustomerProfile } }
  assertBackend()
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single()
  wrapPg(error)
  return data as Profile
}

/* ---------- checkout + payments ---------- */

export interface CheckoutLine {
  product_slug: string
  variant_key: string
  qty: number
  mode: 'once' | 'sub'
}
export interface CheckoutBody {
  lines: CheckoutLine[]
  address_id?: string
  address?: AddressSnapshot
  recipient?: { name: string; phone: string }
  date: string
  slot_id: string
  gift_note?: string
  instructions?: string
  coupon_code?: string
  subscription?: { plan_days: number; delivery_days: number[]; start_date: string }
  idempotency_key: string
}
export interface PaymentSession {
  key_id: string; razorpay_order_id: string; amount_paise: number; currency: string; name: string
  prefill?: { name?: string; email?: string; contact?: string }
}
export interface CheckoutResult { order_id?: string; subscription_id?: string; payment: PaymentSession }
export const checkoutCreate = (body: CheckoutBody) => fn<CheckoutResult>('checkout-create', body)

export interface VerifyBody { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
export const paymentVerify = (body: VerifyBody) => fn<{ order_id?: string; subscription_id?: string; status?: string }>('payment-verify', body)

/** Fetches the HTML invoice with the user's JWT and opens it in a new tab (a plain link cannot carry the token). */
export async function openInvoice(orderId: string): Promise<void> {
  assertBackend()
  const win = window.open('', '_blank')
  try {
    const { data } = await supabase.auth.getSession()
    const res = await fetch(`${env.supabaseUrl}/functions/v1/order-invoice?order_id=${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}`, apikey: env.supabaseKey },
    })
    if (!res.ok) throw new ApiError(res.status === 404 ? 'Invoice not available for this order yet.' : 'Could not load the invoice.', 'invoice')
    const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }))
    if (win) win.location.href = url
    else window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    win?.close()
    throw e instanceof ApiError ? e : new ApiError('Could not load the invoice.', 'invoice', true)
  }
}
