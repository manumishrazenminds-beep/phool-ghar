import type { Address, NotificationRow, OrderEvent, OrderItem, OrderRow, Profile, SubscriptionRow, TicketRow } from './api'
import { backendConfigured } from './env'

/** Dummy customer for running the storefront without a backend. Data lives in memory and resets on reload. */
export const DEMO_CUSTOMER = { email: 'customer@phoolghar.test', password: 'Customer@123', name: 'Anjali Deshpande' }

const SKEY = 'pg_customer_demo_session'
export const demoCustomerActive = () => {
  if (backendConfigured) return false
  try { return localStorage.getItem(SKEY) === '1' } catch { return false }
}
export const setDemoCustomerSession = (on: boolean) => { try { localStorage.setItem(SKEY, on ? '1' : '0') } catch { /* private mode */ } }

export const demoCustomerProfile: Profile = {
  id: 'demo-customer', role: 'customer', full_name: DEMO_CUSTOMER.name, phone: '9822012345', email: DEMO_CUSTOMER.email,
  permissions: [], active: true, lang: 'en', notify_prefs: { email: true, whatsapp: true, sms: false, push: false },
}

const day = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}
const ago = (days: number, hour = 6) => {
  const d = new Date(); d.setDate(d.getDate() - days); d.setHours(hour, 12, 0, 0)
  return d.toISOString()
}

const snap = { recipient_name: DEMO_CUSTOMER.name, recipient_phone: '9822012345', line1: 'Flat 402, Sai Heights, Baner Road', line2: null, landmark: 'Near Balewadi Phata', city: 'Pune', pincode: '411045', instructions: 'Hang on the door handle' }

export const demoAddresses: Address[] = [
  { id: 'a1', user_id: 'demo-customer', label: 'Home', recipient_name: DEMO_CUSTOMER.name, recipient_phone: '9822012345', line1: snap.line1, line2: null, landmark: snap.landmark, city: 'Pune', pincode: '411045', instructions: snap.instructions, is_default: true },
  { id: 'a2', user_id: 'demo-customer', label: 'Parents', recipient_name: 'Suresh Deshpande', recipient_phone: '9822099887', line1: '12, Shivaji Nagar Society, Kothrud', line2: null, landmark: 'Opp. Mhatre Bridge', city: 'Pune', pincode: '411038', instructions: null, is_default: false },
]

const mk = (n: number, status: OrderRow['status'], dOff: number, items: [string, string, number, number][], extra: Partial<OrderRow> = {}) => {
  const subtotal = items.reduce((s, [, , p, q]) => s + p * q, 0)
  const fee = subtotal >= 49900 ? 0 : 4000
  const id = `o${n}`
  const order: OrderRow = {
    id, order_no: `PG-${10240 + n}`, kind: 'one_time', subscription_id: null, delivery_date: day(dOff), slot_id: 'morning', status,
    payment_status: status === 'cancelled' ? 'refunded' : 'paid', address: snap, gift_note: null, subtotal_paise: subtotal, discount_paise: 0,
    delivery_fee_paise: fee, tax_paise: 0, total_paise: subtotal + fee, coupon_code: null, failure_reason: null,
    delivered_at: status === 'delivered' ? ago(-dOff, 7) : null, created_at: ago(-dOff + 1, 20), ...extra,
  }
  const lines: OrderItem[] = items.map(([name, variant, price, qty], i) => ({ id: `${id}i${i}`, product_id: `p${i}`, variant_key: variant, name_snapshot: name, unit_price_paise: price, qty, line_total_paise: price * qty }))
  const flow: OrderRow['status'][] = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered']
  const upto = status === 'cancelled' ? ['placed', 'cancelled'] : flow.slice(0, flow.indexOf(status) + 1)
  const events: OrderEvent[] = upto.map((s, i) => ({ id: `${id}e${i}`, order_id: id, status: s, note: s === 'cancelled' ? 'Cancelled by customer' : null, created_at: ago(-dOff + 1, 20 + i) }))
  return { order, lines, events }
}

const built = [
  mk(1, 'out_for_delivery', 0, [['Pooja Mix', '250 g', 14900, 1], ['Mogra Strings', '2 strings', 8900, 1]]),
  mk(2, 'confirmed', 2, [['Peach Garden Bouquet', 'Medium', 79900, 1]], { gift_note: 'Happy birthday, Aai!' }),
  mk(3, 'delivered', -3, [['Marigold Orange', '500 g', 19900, 1]]),
  mk(4, 'delivered', -9, [['Rose Petal Pooja Pack', '250 g', 12900, 2]]),
  mk(5, 'cancelled', -14, [['Lotus Offering Set', 'Set of 5', 24900, 1]]),
]
export const demoOrders: OrderRow[] = built.map((b) => b.order)
export const demoOrderDetail = (id: string) => {
  const b = built.find((x) => x.order.id === id)
  return b ? { order: b.order, items: b.lines, events: b.events } : null
}

export const demoSubscriptions: SubscriptionRow[] = [{
  id: 's1', product_id: 'p1', variant_key: '250 g', plan_days: 30, delivery_days: [0, 1, 2, 3, 4, 5, 6], start_date: day(-8), end_date: day(21),
  slot_id: 'morning', address: snap, status: 'active', per_day_paise: 4900, total_paise: 147000, paid_through: day(21),
  paused_from: null, paused_to: null, skipped_days: 1, cancelled_at: null, cancel_reason: null, created_at: ago(9, 19),
  products: { name: 'Pooja Mix', slug: 'pooja-mix', image_url: null },
}]
export const demoSkips: Record<string, string[]> = { s1: [day(-4)] }

export const demoNotifications: NotificationRow[] = [
  { id: 'n1', type: 'order', title: 'Out for delivery', body: 'Order PG-10241 is on its way. Imran will reach you before 8 AM.', data: null, read_at: null, created_at: ago(0, 6) },
  { id: 'n2', type: 'subscription', title: 'Daily plan renews in 21 days', body: 'Your 30-day Pooja Mix plan is paid through ' + day(21) + '.', data: null, read_at: null, created_at: ago(1, 9) },
  { id: 'n3', type: 'order', title: 'Order delivered', body: 'PG-10243 was delivered. We hope the flowers were fresh!', data: null, read_at: ago(2, 10), created_at: ago(3, 7) },
]

export const demoTickets: TicketRow[] = [
  { id: 't1', order_id: 'o4', subject: 'Petals arrived slightly crushed', message: 'The pack was a bit squashed. Could you send a replacement?', status: 'closed', created_at: ago(8, 11) },
]
