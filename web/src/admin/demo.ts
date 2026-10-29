/**
 * Demo-data provider. Implements the same `Api` interface as the live Supabase client but answers from
 * in-memory sample data, with no network. Mutations persist until the page is reloaded.
 * All names, phone numbers and addresses are invented.
 */
import { CATEGORIES, PLAN_PERIODS, PRODUCTS, SLOTS } from '../data/products'
import type { Api, Filter, Query } from './api'
import { addDays, todayISO, weekdayOf } from './format'
import type { Coupon, DashboardData, DeliveryRow, Order, OrderItem, OrderStatus, OutboxRow, Payment, Profile, Role, Subscription } from './types'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const uid = () => (globalThis.crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2, 12))

/** Dummy sign-ins for the local demo workspace. Not real accounts; they only unlock sample data in this browser. */
export const DEMO_ACCOUNTS = {
  admin: { label: 'Owner (admin)', email: 'owner@phoolghar.test', password: 'Owner@123', note: 'Everything, including team and settings' },
  staff: { label: 'Sub-admin (staff)', email: 'subadmin@phoolghar.test', password: 'SubAdmin@123', note: 'Orders, customers, subscriptions, catalogue, stock' },
  delivery: { label: 'Delivery staff', email: 'delivery@phoolghar.test', password: 'Delivery@123', note: 'Today\'s route only' },
} as const

const DEMO_USERS: Record<'admin' | 'staff' | 'delivery', Profile> = {
  admin: { id: 'demo-admin', role: 'admin', full_name: 'Meera Kulkarni (owner)', phone: '9820011001', email: DEMO_ACCOUNTS.admin.email, permissions: [], active: true },
  staff: { id: 'demo-staff-1', role: 'staff', full_name: 'Priya Menon', phone: '9820011002', email: DEMO_ACCOUNTS.staff.email, permissions: ['orders', 'customers', 'subscriptions', 'products', 'stock'], active: true },
  delivery: { id: 'demo-del-1', role: 'delivery', full_name: 'Imran Shaikh', phone: '9820011003', email: DEMO_ACCOUNTS.delivery.email, permissions: [], active: true },
}
export function demoProfile(role: Role): Profile {
  return DEMO_USERS[(role === 'customer' ? 'admin' : role) as 'admin' | 'staff' | 'delivery']
}

const AREAS: [string, string, number][] = [
  ['Kothrud', '411038', 4000], ['Baner', '411045', 6000], ['Aundh', '411007', 5000], ['Viman Nagar', '411014', 7000],
  ['Koregaon Park', '411001', 7000], ['Hadapsar', '411028', 8000], ['Shivajinagar', '411005', 4000],
]
const FIRST = ['Aarav', 'Ananya', 'Rohan', 'Sneha', 'Vikram', 'Kavya', 'Nikhil', 'Pooja', 'Rahul', 'Divya', 'Arjun', 'Neha', 'Sanjay', 'Isha', 'Manish', 'Tara']
const LAST = ['Deshpande', 'Joshi', 'Patil', 'Kulkarni', 'Iyer', 'Shah', 'Nair', 'Gokhale', 'Rao', 'Bhosale']
const STREETS = ['Lane 4, Sai Krupa Society', 'Flat 302, Green Park Apartments', 'Bungalow 12, Shanti Nagar', 'Shop 5, Market Road', 'Row House 7, Lotus Residency', 'Flat 8B, Orchid Heights']
const LANDMARKS = ['Near the Ganesh temple', 'Opposite the bus stop', 'Behind the bakery', 'Next to the petrol pump', 'Beside the school gate', '']
const NOTES = ['Please ring the bell twice', 'Leave with the security guard', 'Call before arriving', '', '', 'Deliver before 7 am, pooja at 7:15']

export function buildDemoDb(): Record<string, Row[]> {
  const r = rng(42)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const today = todayISO()
  const db: Record<string, Row[]> = {}

  db.categories = CATEGORIES.map((c, i) => ({ id: 'cat-' + c.id, slug: c.id, name: c.label, blurb: c.blurb, image_url: c.image, sort: i, active: true }))
  db.products = PRODUCTS.map((p, i) => ({
    id: p.id, slug: p.slug, name: p.name, tagline: p.tagline, description: p.description, category_id: 'cat-' + p.category,
    image_url: p.image, gallery: p.gallery, price_paise: p.price * 100, per_day_paise: p.perDay ? p.perDay * 100 : null,
    tag: p.tag ?? null, care: p.care, active: i !== 11, track_stock: i < 8, sort: i,
  }))
  db.product_variants = PRODUCTS.flatMap((p) => [
    { id: `${p.id}-s`, product_id: p.id, variant_key: 'small', label: 'Small', note: 'Single altar', multiplier: 0.7 },
    { id: `${p.id}-r`, product_id: p.id, variant_key: 'regular', label: 'Regular', note: 'Family altar', multiplier: 1 },
    { id: `${p.id}-l`, product_id: p.id, variant_key: 'large', label: 'Large', note: 'Shop or office', multiplier: 1.6 },
  ])
  db.product_stock = []
  for (const p of db.products.filter((x) => x.track_stock)) {
    for (let d = 0; d < 7; d++) db.product_stock.push({ product_id: p.id, stock_date: addDays(today, d), qty: 20 + Math.floor(r() * 60), unlimited: false })
  }
  db.plan_periods = PLAN_PERIODS.map((p: any) => ({ days: p.days, label: p.label ?? `${p.days} days`, discount_pct: Math.round((p.discount ?? 0) * 100), active: true }))
  db.delivery_zones = AREAS.map(([area, pin, fee]) => ({ pincode: pin, city: 'Pune', area, fee_paise: fee, active: true }))
  db.delivery_zones.push({ pincode: '411057', city: 'Pune', area: 'Hinjewadi', fee_paise: 9000, active: false })
  const slotMeta: Record<string, [string, string, number]> = { early: ['05:00', '06:30', 25], morning: ['06:30', '08:00', 40], evening: ['17:00', '19:00', 30] }
  db.delivery_slots = SLOTS.map((s: any, i: number) => {
    const id = s.id as string
    const m = slotMeta[id] ?? ['08:00', '10:00', 30]
    return { id, label: s.label ?? id, start_time: m[0], end_time: m[1], capacity: m[2], subscription_ok: id !== 'evening', active: true, sort: i }
  })
  db.app_settings = [
    { key: 'cutoff_time', value: '21:00' }, { key: 'free_delivery_for_subscription', value: true }, { key: 'min_order_paise', value: 10000 },
    { key: 'store_name', value: 'Phool Ghar' }, { key: 'support_whatsapp', value: '919820011000' }, { key: 'gst_percent', value: 5 },
  ]
  const coupon = (c: Partial<Coupon> & { code: string }): Coupon => ({ kind: 'percent', value: 10, min_order_paise: 0, max_uses: null, used_count: 0, per_user_limit: 1, valid_from: null, valid_to: null, applies_to: 'all', active: true, ...c })
  db.coupons = [
    coupon({ code: 'WELCOME10', value: 10, used_count: 38, max_uses: 200, valid_from: addDays(today, -60), valid_to: addDays(today, 60) }),
    coupon({ code: 'FESTIVE50', kind: 'flat', value: 5000, min_order_paise: 40000, used_count: 12, max_uses: 50, valid_to: addDays(today, 14), applies_to: 'one_time' }),
    coupon({ code: 'DAILY15', value: 15, applies_to: 'subscription', used_count: 7, per_user_limit: 1 }),
    coupon({ code: 'OLDDIWALI', value: 20, used_count: 90, max_uses: 90, valid_to: addDays(today, -10), active: false }),
  ]

  db.reviews = [
    { id: 'rv1', product_id: db.products[0]?.id, rating: 5, body: 'Fresh and fragrant, delivered before six.', approved: false, created_at: addDays(today, -1) },
    { id: 'rv2', product_id: db.products[3]?.id, rating: 4, body: 'Lovely mogra, a couple of strings were a bit dry.', approved: false, created_at: addDays(today, -2) },
    { id: 'rv3', product_id: db.products[0]?.id, rating: 5, body: 'Have used it daily for a month.', approved: true, created_at: addDays(today, -9) },
  ]

  // people
  db.profiles = [
    DEMO_USERS.admin, DEMO_USERS.staff,
    { id: 'demo-staff-2', role: 'staff', full_name: 'Rahul Sawant', phone: '9820011004', email: 'rahul@example.com', permissions: ['products', 'stock'], active: true },
    DEMO_USERS.delivery,
    { id: 'demo-del-2', role: 'delivery', full_name: 'Suresh Jadhav', phone: '9820011005', email: 'suresh@example.com', permissions: [], active: true },
    { id: 'demo-del-3', role: 'delivery', full_name: 'Lakshmi Pawar', phone: '9820011006', email: 'lakshmi@example.com', permissions: [], active: false },
  ].map((p) => ({ created_at: addDays(today, -90) + 'T09:00:00Z', ...p }))
  const customers: Row[] = []
  for (let i = 0; i < 16; i++) {
    const name = `${FIRST[i]} ${pick(LAST)}`
    customers.push({ id: 'cust-' + i, role: 'customer', full_name: name, phone: '98' + String(20000000 + Math.floor(r() * 7999999)), email: name.toLowerCase().replace(/ /g, '.') + '@example.com', permissions: [], active: true, created_at: addDays(today, -30 - Math.floor(r() * 60)) + 'T10:00:00Z' })
  }
  db.profiles.push(...customers)
  db.addresses = customers.flatMap((c, i) => {
    const [area, pin] = AREAS[i % AREAS.length]
    return [{
      id: 'addr-' + i, user_id: c.id, label: i % 4 === 0 ? 'Shop' : 'Home', recipient_name: c.full_name, recipient_phone: c.phone,
      line1: STREETS[i % STREETS.length], line2: area, landmark: LANDMARKS[i % LANDMARKS.length], city: 'Pune', pincode: pin,
      instructions: NOTES[i % NOTES.length], is_default: true,
    }]
  })
  const addrOf = (i: number) => {
    const a = db.addresses[i]
    return { recipient_name: a.recipient_name, recipient_phone: a.recipient_phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, pincode: a.pincode, instructions: a.instructions }
  }

  // subscriptions
  const subs: Subscription[] = []
  for (let i = 0; i < 12; i++) {
    const p = PRODUCTS.filter((x) => x.perDay)[i % PRODUCTS.filter((x) => x.perDay).length]
    const plan = [7, 15, 30][i % 3]
    const status: Subscription['status'] = i === 3 || i === 9 ? 'paused' : i === 6 ? 'cancelled' : i === 11 ? 'pending_payment' : i === 10 ? 'completed' : 'active'
    const start = addDays(today, status === 'completed' ? -30 : -Math.floor(r() * Math.min(10, plan - 2)) - 1)
    const days = i % 4 === 0 ? [0, 1, 2, 3, 4, 5, 6] : i % 4 === 1 ? [0, 1, 2, 3, 4, 5] : i % 4 === 2 ? [0, 2, 4] : [5, 6]
    subs.push({
      id: 'sub-' + i, user_id: 'cust-' + i, product_id: p.id, variant_key: i % 5 === 0 ? 'large' : 'regular', plan_days: plan, delivery_days: days,
      start_date: start, end_date: addDays(start, plan + 1), slot_id: i % 2 ? 'morning' : 'early', address: addrOf(i), status,
      per_day_paise: (p.perDay ?? 50) * 100, total_paise: (p.perDay ?? 50) * 100 * plan, paid_through: addDays(start, plan),
      paused_from: status === 'paused' ? addDays(today, 1) : null, paused_to: status === 'paused' ? addDays(today, 5) : null,
      skipped_days: i % 3, cancelled_at: status === 'cancelled' ? addDays(today, -3) + 'T11:00:00Z' : null, cancel_reason: status === 'cancelled' ? 'Moving to another city' : null,
      created_at: start + 'T08:00:00Z',
    })
  }
  db.subscriptions = subs as unknown as Row[]
  db.subscription_skips = [
    { subscription_id: 'sub-0', skip_date: addDays(today, 3), created_at: today + 'T08:00:00Z' },
    { subscription_id: 'sub-1', skip_date: addDays(today, 2), created_at: today + 'T08:00:00Z' },
    { subscription_id: 'sub-2', skip_date: addDays(today, 5), created_at: today + 'T08:00:00Z' },
  ]

  // orders
  const orders: Order[] = []
  const items: OrderItem[] = []
  const events: Row[] = []
  const payments: Payment[] = []
  const delStaff = ['demo-del-1', 'demo-del-2', 'demo-del-3']
  let n = 1000
  const mkOrder = (date: string, custIdx: number, sub: Subscription | null) => {
    n++
    const id = 'ord-' + n
    const slot = sub ? sub.slot_id : pick(['early', 'morning', 'morning', 'evening'])
    const cnt = 1 + Math.floor(r() * 2)
    let subtotal = 0
    for (let k = 0; k < cnt; k++) {
      const p = sub ? PRODUCTS.find((x) => x.id === sub.product_id)! : pick(PRODUCTS)
      const vk = sub ? sub.variant_key : pick(['small', 'regular', 'regular', 'large'])
      const mult = vk === 'small' ? 0.7 : vk === 'large' ? 1.6 : 1
      const unit = Math.round(p.price * 100 * mult)
      const qty = sub ? 1 : 1 + Math.floor(r() * 2)
      if (!sub) subtotal += unit * qty
      items.push({ id: `${id}-i${k}`, order_id: id, product_id: p.id, variant_key: vk, name_snapshot: p.name, unit_price_paise: sub ? 0 : unit, qty, line_total_paise: sub ? 0 : unit * qty })
      if (sub) break
    }
    const fee = sub ? 0 : AREAS[custIdx % AREAS.length][2]
    const tax = Math.round(((subtotal + fee) * 0.05) / 100) * 100
    const diff = date === today ? 0 : date < today ? -1 : 1
    let status: OrderStatus
    const x = r()
    if (diff < 0) status = x < 0.88 ? 'delivered' : x < 0.94 ? 'cancelled' : 'failed'
    else if (diff === 0) status = x < 0.3 ? 'delivered' : x < 0.5 ? 'out_for_delivery' : x < 0.7 ? 'preparing' : x < 0.9 ? 'confirmed' : x < 0.95 ? 'failed' : 'placed'
    else status = x < 0.6 ? 'confirmed' : 'placed'
    const pay: Order['payment_status'] = sub ? 'paid' : status === 'cancelled' ? (r() < 0.5 ? 'refunded' : 'paid') : diff >= 0 && x > 0.96 ? 'failed' : 'paid'
    const assigned = diff <= 0 && status !== 'placed' && status !== 'cancelled' && r() < 0.8 ? delStaff[Math.floor(r() * 2)] : null
    const o: Order = {
      id, order_no: `PG-26-${String(n).padStart(6, '0')}`, user_id: 'cust-' + custIdx, kind: sub ? 'subscription_delivery' : 'one_time', subscription_id: sub?.id ?? null,
      delivery_date: date, slot_id: slot, status, payment_status: pay, address: addrOf(custIdx), gift_note: !sub && r() < 0.15 ? 'Happy birthday, Aai!' : null,
      subtotal_paise: subtotal, discount_paise: 0, delivery_fee_paise: fee, tax_paise: tax, total_paise: subtotal + fee + tax, coupon_code: null,
      assigned_to: assigned, failure_reason: status === 'failed' ? pick(['Customer not reachable', 'Address not found', 'Gate locked, nobody home']) : null,
      delivered_at: status === 'delivered' ? date + 'T07:40:00+05:30' : null, created_at: addDays(date, -1) + 'T16:' + String(10 + Math.floor(r() * 49)) + ':00+05:30',
    }
    orders.push(o)
    events.push({ id: id + '-e0', order_id: id, status: 'placed', note: null, actor_id: o.user_id, created_at: o.created_at })
    if (status !== 'placed') events.push({ id: id + '-e1', order_id: id, status: 'confirmed', note: null, actor_id: 'demo-staff-1', created_at: addDays(date, -1) + 'T18:05:00+05:30' })
    if (['preparing', 'out_for_delivery', 'delivered'].includes(status)) events.push({ id: id + '-e2', order_id: id, status: 'preparing', note: null, actor_id: 'demo-staff-1', created_at: date + 'T04:30:00+05:30' })
    if (['out_for_delivery', 'delivered'].includes(status)) events.push({ id: id + '-e3', order_id: id, status: 'out_for_delivery', note: null, actor_id: assigned, created_at: date + 'T06:10:00+05:30' })
    if (status === 'delivered') events.push({ id: id + '-e4', order_id: id, status: 'delivered', note: null, actor_id: assigned, created_at: o.delivered_at! })
    if (status === 'failed' || status === 'cancelled') events.push({ id: id + '-e5', order_id: id, status, note: o.failure_reason ?? 'Cancelled by customer', actor_id: 'demo-staff-1', created_at: date + 'T08:00:00+05:30' })
    if (!sub) payments.push({
      id: 'pay-' + n, user_id: o.user_id, order_id: id, subscription_id: null, provider_order_id: 'order_Demo' + n, provider_payment_id: pay === 'failed' ? null : 'pay_Demo' + n,
      amount_paise: o.total_paise, status: pay === 'failed' ? 'failed' : pay === 'refunded' ? 'refunded' : 'captured', method: pick(['upi', 'card', 'upi']),
      error_code: pay === 'failed' ? 'BAD_REQUEST_ERROR' : null, error_desc: pay === 'failed' ? 'Payment declined by the bank' : null, created_at: o.created_at,
    })
  }
  for (let d = -7; d <= 1; d++) {
    const date = addDays(today, d)
    const count = d === 0 ? 14 : d === 1 ? 10 : 6 + Math.floor(r() * 5)
    for (let k = 0; k < count; k++) mkOrder(date, Math.floor(r() * 16), null)
    for (const s of subs.filter((x) => x.status === 'active' && x.delivery_days.includes(weekdayOf(date)) && d >= -3)) mkOrder(date, Number(s.user_id.slice(5)), s)
  }
  // a couple of unassigned orders for today so bulk assign is demonstrable
  db.orders = orders as unknown as Row[]
  db.order_items = items as unknown as Row[]
  db.order_events = events
  db.payments = payments as unknown as Row[]
  db.refunds = [{ id: 'ref-1', payment_id: payments.find((p) => p.status === 'refunded')?.id ?? 'pay-x', order_id: payments.find((p) => p.status === 'refunded')?.order_id ?? null, amount_paise: 24900, reason: 'Order cancelled by customer', status: 'processed', created_at: addDays(today, -2) + 'T12:00:00Z' }]

  const tpl = ['order_confirmed', 'order_out_for_delivery', 'delivery_reminder', 'payment_success', 'subscription_started', 'plan_ending_soon', 'order_delivered']
  const ob: OutboxRow[] = []
  for (let i = 0; i < 28; i++) {
    const st: OutboxRow['status'] = i % 9 === 0 ? 'failed' : i % 17 === 0 ? 'dead' : i % 5 === 0 ? 'queued' : 'sent'
    const channel = (['email', 'whatsapp', 'whatsapp', 'email'] as const)[i % 4]
    const c = customers[i % customers.length]
    ob.push({
      id: 'ob-' + i, user_id: c.id, channel, template: tpl[i % tpl.length], to_address: channel === 'email' ? c.email : c.phone, status: st,
      attempts: st === 'failed' ? 2 : st === 'dead' ? 6 : st === 'queued' ? 0 : 1, next_attempt_at: st === 'failed' ? addDays(today, 0) + 'T12:00:00Z' : null,
      last_error: st === 'failed' ? 'Provider timeout after 10s' : st === 'dead' ? 'Recipient address rejected (550)' : null, sent_at: st === 'sent' ? addDays(today, -(i % 3)) + 'T07:00:00Z' : null,
      created_at: addDays(today, -(i % 4)) + `T0${i % 9}:15:00Z`,
    })
  }
  db.notification_outbox = ob as unknown as Row[]
  return db
}

let DB: Record<string, Row[]> | null = null
const db = () => (DB ??= buildDemoDb())
const delay = <T,>(v: T) => new Promise<T>((res) => setTimeout(() => res(structuredClone(v)), 120))

const PK: Record<string, string[]> = {
  product_stock: ['product_id', 'stock_date'], plan_periods: ['days'], delivery_zones: ['pincode'], delivery_slots: ['id'], app_settings: ['key'],
  product_variants: ['product_id', 'variant_key'], coupons: ['code'], subscription_skips: ['subscription_id', 'skip_date'],
}
const pkOf = (t: string) => PK[t] ?? ['id']

function matches(row: Row, f: Filter): boolean {
  const v = row[f.col]
  switch (f.op) {
    case 'eq': return v === f.val
    case 'neq': return v !== f.val
    case 'in': return (f.val as unknown[]).includes(v)
    case 'gt': return v > (f.val as never)
    case 'gte': return v >= (f.val as never)
    case 'lt': return v < (f.val as never)
    case 'lte': return v <= (f.val as never)
    case 'ilike': return String(v ?? '').toLowerCase().includes(String(f.val).toLowerCase())
    case 'is': return f.val === null ? v == null : v === f.val
  }
}
function run(table: string, q: Query = {}): Row[] {
  let rows = [...(db()[table] ?? [])]
  for (const f of q.filters ?? []) rows = rows.filter((r) => matches(r, f))
  const term = q.or?.term.trim().toLowerCase()
  if (term) rows = rows.filter((r) => q.or!.cols.some((c) => String(r[c] ?? '').toLowerCase().includes(term)))
  for (const o of [...(q.order ?? [])].reverse()) {
    rows.sort((a, b) => {
      const x = a[o.col], y = b[o.col]
      if (x === y) return 0
      if (x == null) return 1
      if (y == null) return -1
      return (x < y ? -1 : 1) * (o.asc === false ? -1 : 1)
    })
  }
  return rows.slice(0, q.limit ?? 1000)
}

function event(orderId: string, status: string, note: string | null, actor = 'demo-admin') {
  db().order_events.push({ id: uid(), order_id: orderId, status, note, actor_id: actor, created_at: new Date().toISOString() })
}
const find = (t: string, id: string) => {
  const r = db()[t].find((x) => x.id === id)
  if (!r) throw new Error('Record not found in demo data.')
  return r
}
const cutoffPassed = () => {
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(new Date())
  return hhmm >= '21:00'
}
function guardCutoff(date: string) {
  if (date <= todayISO() || (date === todayISO(1) && cutoffPassed())) throw new Error('Past the 9 pm cut-off for that date (demo applies the same rule as the server).')
}

function rpc(name: string, a: Row): unknown {
  const today = todayISO()
  switch (name) {
    case 'set_order_status': {
      const o = find('orders', a.p_order)
      o.status = a.p_status
      if (a.p_status === 'delivered') o.delivered_at = new Date().toISOString()
      if (a.p_status === 'failed') o.failure_reason = a.p_note || 'Delivery failed'
      event(o.id, a.p_status, a.p_note ?? null)
      return null
    }
    case 'assign_order': {
      const o = find('orders', a.p_order)
      o.assigned_to = a.p_staff ?? null
      return null
    }
    case 'bulk_assign_orders': {
      let n = 0
      for (const o of db().orders) {
        if (o.delivery_date === a.p_date && (!a.p_slot || o.slot_id === a.p_slot) && !['delivered', 'cancelled', 'failed'].includes(o.status)) { o.assigned_to = a.p_staff; n++ }
      }
      return n
    }
    case 'todays_delivery_list': {
      return db().orders.filter((o) => o.delivery_date === a.p_date && o.status !== 'cancelled').map((o): DeliveryRow => {
        const ad = o.address ?? {}
        const zone = db().delivery_zones.find((z) => z.pincode === ad.pincode)
        const its = db().order_items.filter((i) => i.order_id === o.id)
        return {
          order_id: o.id, order_no: o.order_no, kind: o.kind, slot_id: o.slot_id, status: o.status, payment_status: o.payment_status, assigned_to: o.assigned_to,
          assigned_name: db().profiles.find((p) => p.id === o.assigned_to)?.full_name ?? null, recipient_name: ad.recipient_name ?? '', recipient_phone: ad.recipient_phone ?? '',
          line1: ad.line1 ?? '', line2: ad.line2 ?? '', landmark: ad.landmark ?? '', city: ad.city ?? '', area: zone?.area ?? ad.line2 ?? '', pincode: ad.pincode ?? '',
          instructions: ad.instructions ?? '', gift_note: o.gift_note ?? '', items_summary: its.map((i) => `${i.qty} x ${i.name_snapshot} (${i.variant_key})`).join(', '), total_paise: o.total_paise,
        }
      })
    }
    case 'admin_dashboard': {
      const rows = db().orders
      const live = (d: string) => rows.filter((o) => o.delivery_date === d && o.status !== 'cancelled')
      const paid = rows.filter((o) => o.delivery_date >= a.p_from && o.delivery_date <= a.p_to && o.payment_status === 'paid' && o.status !== 'cancelled')
      const by: Record<string, number> = {}
      for (const o of live(today)) by[o.slot_id] = (by[o.slot_id] ?? 0) + 1
      const d: DashboardData = {
        orders_today: live(today).length, orders_tomorrow: live(addDays(today, 1)).length, revenue_paise: paid.reduce((s, o) => s + o.total_paise, 0),
        active_subscriptions: db().subscriptions.filter((s) => s.status === 'active').length, paused_subscriptions: db().subscriptions.filter((s) => s.status === 'paused').length,
        deliveries_by_slot: Object.entries(by).map(([slot_id, count]) => ({ slot_id, count })),
      }
      return d
    }
    case 'skip_subscription_day': {
      guardCutoff(a.p_date)
      const s = find('subscriptions', a.p_sub)
      if (!db().subscription_skips.some((k) => k.subscription_id === s.id && k.skip_date === a.p_date)) {
        db().subscription_skips.push({ subscription_id: s.id, skip_date: a.p_date, created_at: new Date().toISOString() })
        s.skipped_days += 1
        s.end_date = addDays(s.end_date, 1)
      }
      return null
    }
    case 'unskip_subscription_day': {
      guardCutoff(a.p_date)
      const s = find('subscriptions', a.p_sub)
      const i = db().subscription_skips.findIndex((k) => k.subscription_id === s.id && k.skip_date === a.p_date)
      if (i >= 0) { db().subscription_skips.splice(i, 1); s.skipped_days = Math.max(0, s.skipped_days - 1); s.end_date = addDays(s.end_date, -1) }
      return null
    }
    case 'pause_subscription': {
      guardCutoff(a.p_from)
      const s = find('subscriptions', a.p_sub)
      s.status = 'paused'; s.paused_from = a.p_from; s.paused_to = a.p_to
      return null
    }
    case 'resume_subscription': {
      const s = find('subscriptions', a.p_sub)
      s.status = 'active'; s.paused_from = null; s.paused_to = null
      return null
    }
    case 'cancel_subscription': {
      const s = find('subscriptions', a.p_sub)
      s.status = 'cancelled'; s.cancelled_at = new Date().toISOString(); s.cancel_reason = a.p_reason ?? null
      return null
    }
    case 'cancel_order': {
      const o = find('orders', a.p_order)
      o.status = 'cancelled'
      event(o.id, 'cancelled', a.p_reason ?? null)
      return null
    }
    case 'retry_outbox': {
      const r = find('notification_outbox', a.p_id)
      r.status = 'queued'; r.next_attempt_at = new Date().toISOString()
      return null
    }
  }
  throw new Error(`Demo mode does not implement the RPC "${name}".`)
}

function fn(name: string, body: Row): unknown {
  const d = db()
  if (name === 'team-admin') {
    switch (body.op) {
      case 'list': return { members: d.profiles.filter((p) => ['admin', 'staff', 'delivery'].includes(p.role)) }
      case 'create': {
        const p: Profile = { id: uid(), role: body.role, full_name: body.full_name, phone: body.phone ?? null, email: body.email, permissions: body.permissions ?? [], active: true, created_at: new Date().toISOString() }
        d.profiles.push(p as unknown as Row)
        return { ...p, invite_sent: !body.password }
      }
      case 'update': { const t = find('profiles', body.id); for (const k of ['permissions', 'full_name', 'phone', 'role', 'active']) if (body[k] !== undefined) t[k] = body[k]; return t }
      case 'deactivate': { const t = find('profiles', body.id); t.active = false; return t }
      case 'reactivate': { const t = find('profiles', body.id); t.active = true; return t }
      case 'reset_password': return { id: body.id, method: body.password ? 'set' : 'email' }
    }
  }
  if (name === 'refund-create') {
    const pay = find('payments', body.payment_id)
    const o = d.orders.find((x) => x.id === pay.order_id)
    const amount = body.amount_paise ?? pay.amount_paise
    d.refunds.push({ id: uid(), payment_id: pay.id, order_id: pay.order_id, amount_paise: amount, reason: body.reason ?? null, status: 'processed', created_at: new Date().toISOString() })
    if (o) o.payment_status = amount >= o.total_paise ? 'refunded' : 'partially_refunded'
    if (amount >= pay.amount_paise) pay.status = 'refunded'
    return { status: 'processed', amount_paise: amount, payment_id: pay.id }
  }
  throw new Error(`Demo mode does not implement the function "${name}".`)
}

export const demoApi: Api = {
  mode: 'demo',
  select: async <T,>(table: string, q?: Query) => delay(run(table, q)) as Promise<T[]>,
  upsert: async <T,>(table: string, rows: Partial<T> | Partial<T>[]) => {
    const list = (Array.isArray(rows) ? rows : [rows]) as Row[]
    const out: Row[] = []
    const t = (db()[table] ??= [])
    for (const row of list) {
      const keys = pkOf(table)
      if (keys[0] === 'id' && !row.id) row.id = uid()
      const existing = t.find((x) => keys.every((k) => x[k] === row[k]))
      if (existing) { Object.assign(existing, row); out.push(existing) } else { const c = { created_at: new Date().toISOString(), ...row }; t.push(c); out.push(c) }
    }
    return delay(out) as Promise<T[]>
  },
  update: async (table, match, patch) => {
    for (const r of db()[table] ?? []) if (Object.entries(match).every(([k, v]) => r[k] === v)) Object.assign(r, patch)
    return delay(undefined)
  },
  invoice: async (orderId) => {
    const o = find('orders', orderId)
    return `<!doctype html><meta charset="utf-8"><title>Invoice ${o.order_no}</title><body style="font-family:Georgia,serif;padding:32px;max-width:640px;margin:auto"><h1>Invoice ${o.order_no}</h1><p>Demo invoice for ${o.address?.recipient_name ?? ''}.</p><p>Total Rs ${(o.total_paise / 100).toFixed(2)} including GST Rs ${(o.tax_paise / 100).toFixed(2)}.</p></body>`
  },
  remove: async (table, match) => {
    const t = db()[table] ?? []
    db()[table] = t.filter((r) => !Object.entries(match).every(([k, v]) => r[k] === v))
    return delay(undefined)
  },
  rpc: async <T,>(name: string, args: Record<string, unknown> = {}) => delay(rpc(name, args)) as Promise<T>,
  fn: async <T,>(name: string, body: unknown = {}) => delay(fn(name, body as Row)) as Promise<T>,
  uploadImage: async (file: File) => URL.createObjectURL(file),
}
