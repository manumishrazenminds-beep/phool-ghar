export type Role = 'customer' | 'admin' | 'staff' | 'delivery'
export type Perm = 'orders' | 'products' | 'stock' | 'subscriptions' | 'customers' | 'coupons' | 'reports' | 'settings' | 'team'
export const ALL_PERMS: { id: Perm; label: string; hint: string }[] = [
  { id: 'orders', label: 'Orders and deliveries', hint: 'View, assign, update and refund orders' },
  { id: 'subscriptions', label: 'Subscriptions', hint: 'Pause, resume, skip and cancel for customers' },
  { id: 'customers', label: 'Customers', hint: 'Customer profiles, addresses and history' },
  { id: 'products', label: 'Catalogue', hint: 'Products, categories and plans' },
  { id: 'stock', label: 'Stock', hint: 'Daily quantities' },
  { id: 'coupons', label: 'Coupons', hint: 'Create and edit coupon codes' },
  { id: 'reports', label: 'Reports', hint: 'Sales and subscription reports' },
  { id: 'settings', label: 'Store settings', hint: 'Delivery zones, slots, GST, cut-off' },
  { id: 'team', label: 'Team', hint: 'Manage staff accounts (normally admin only)' },
]

export type OrderStatus = 'placed' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'failed'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
export type SubStatus = 'pending_payment' | 'active' | 'paused' | 'on_hold' | 'cancelled' | 'completed'

export interface Profile {
  id: string
  role: Role
  full_name: string | null
  phone: string | null
  email: string | null
  permissions: string[]
  active: boolean
  created_at?: string
}

export interface AddressSnap {
  recipient_name?: string | null
  recipient_phone?: string | null
  line1?: string | null
  line2?: string | null
  landmark?: string | null
  city?: string | null
  pincode?: string | null
  instructions?: string | null
}
export interface Address extends AddressSnap {
  id: string
  user_id: string
  label: string | null
  is_default: boolean
}

export interface Order {
  id: string
  order_no: string
  user_id: string
  kind: 'one_time' | 'subscription_delivery'
  subscription_id: string | null
  delivery_date: string
  slot_id: string
  status: OrderStatus
  payment_status: PaymentStatus
  address: AddressSnap
  gift_note: string | null
  subtotal_paise: number
  discount_paise: number
  delivery_fee_paise: number
  tax_paise: number
  total_paise: number
  coupon_code: string | null
  assigned_to: string | null
  failure_reason: string | null
  delivered_at: string | null
  created_at: string
}
export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  variant_key: string
  name_snapshot: string
  unit_price_paise: number
  qty: number
  line_total_paise: number
}
export interface OrderEvent {
  id: string
  order_id: string
  status: string
  note: string | null
  actor_id: string | null
  created_at: string
}
export interface Payment {
  id: string
  user_id: string
  order_id: string | null
  subscription_id: string | null
  provider_order_id: string
  provider_payment_id: string | null
  amount_paise: number
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded'
  method: string | null
  error_code: string | null
  error_desc: string | null
  created_at: string
}
export interface Refund {
  id: string
  payment_id: string
  order_id: string | null
  amount_paise: number
  reason: string | null
  status: 'pending' | 'processed' | 'failed'
  created_at: string
}
export interface Subscription {
  id: string
  user_id: string
  product_id: string
  variant_key: string
  plan_days: number
  delivery_days: number[]
  start_date: string
  end_date: string
  slot_id: string
  address: AddressSnap
  status: SubStatus
  per_day_paise: number
  total_paise: number
  paid_through: string | null
  paused_from: string | null
  paused_to: string | null
  skipped_days: number
  cancelled_at: string | null
  cancel_reason: string | null
  created_at: string
}
export interface SubSkip {
  subscription_id: string
  skip_date: string
}
export interface Category {
  id: string
  slug: string
  name: string
  blurb: string | null
  image_url: string | null
  sort: number
  active: boolean
}
export interface Product {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  category_id: string | null
  image_url: string | null
  gallery: string[]
  price_paise: number
  per_day_paise: number | null
  tag: string | null
  care: string | null
  active: boolean
  track_stock: boolean
  sort: number
}
export interface Variant {
  id: string
  product_id: string
  variant_key: string
  label: string
  note: string | null
  multiplier: number
}
export interface StockRow {
  product_id: string
  stock_date: string
  qty: number
  unlimited: boolean
}
export interface PlanPeriod {
  days: number
  label: string
  discount_pct: number
  active: boolean
}
export interface Zone {
  pincode: string
  city: string | null
  area: string | null
  fee_paise: number
  active: boolean
}
export interface Slot {
  id: string
  label: string
  start_time: string
  end_time: string
  capacity: number
  subscription_ok: boolean
  active: boolean
  sort: number
}
export interface Coupon {
  code: string
  kind: 'percent' | 'flat'
  value: number
  min_order_paise: number
  max_uses: number | null
  used_count: number
  per_user_limit: number
  valid_from: string | null
  valid_to: string | null
  applies_to: 'all' | 'one_time' | 'subscription'
  active: boolean
}
export interface OutboxRow {
  id: string
  user_id: string | null
  channel: 'email' | 'whatsapp' | 'sms' | 'push'
  template: string
  to_address: string
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'dead'
  attempts: number
  next_attempt_at: string | null
  last_error: string | null
  sent_at: string | null
  created_at: string
}
export interface SettingRow {
  key: string
  value: unknown
}

/** Assumed columns of todays_delivery_list (contract says only "joined, grouped-ready rows"). All optional-tolerant. */
export interface DeliveryRow {
  order_id: string
  order_no: string
  kind: 'one_time' | 'subscription_delivery'
  slot_id: string
  status: OrderStatus
  payment_status: PaymentStatus | null
  assigned_to: string | null
  assigned_name: string | null
  recipient_name: string
  recipient_phone: string
  line1: string
  line2: string
  landmark: string
  city: string
  area: string
  pincode: string
  instructions: string
  gift_note: string
  items_summary: string
  total_paise: number
}

export interface DashboardData {
  orders_today: number
  orders_tomorrow: number
  revenue_paise: number
  active_subscriptions: number
  paused_subscriptions: number
  deliveries_by_slot: { slot_id: string; count: number }[]
}
