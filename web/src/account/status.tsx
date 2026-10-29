import type { OrderStatus, PaymentStatus, SubStatus } from '../lib/api'

export const ORDER_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'placed', label: 'Order placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Being prepared' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
]
export const STATUS_LABEL: Record<string, string> = {
  placed: 'Placed', confirmed: 'Confirmed', preparing: 'Preparing', out_for_delivery: 'Out for delivery', delivered: 'Delivered',
  cancelled: 'Cancelled', failed: 'Not delivered', pending: 'Awaiting payment', paid: 'Paid', refunded: 'Refunded', partially_refunded: 'Partly refunded',
  pending_payment: 'Awaiting payment', active: 'Active', paused: 'Paused', on_hold: 'On hold', completed: 'Completed',
}

const tone: Record<string, string> = {
  delivered: 'bg-leaf-soft text-leaf', active: 'bg-leaf-soft text-leaf', paid: 'bg-leaf-soft text-leaf', completed: 'bg-leaf-soft text-leaf',
  cancelled: 'bg-rose-soft text-rose', failed: 'bg-rose-soft text-rose', refunded: 'bg-rose-soft text-rose',
  paused: 'bg-saffron/25 text-ink', on_hold: 'bg-saffron/25 text-ink', pending: 'bg-saffron/25 text-ink', pending_payment: 'bg-saffron/25 text-ink',
}

export function StatusPill({ status }: { status: OrderStatus | PaymentStatus | SubStatus | string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tone[status] ?? 'bg-ink/8 text-ink'}`}>{STATUS_LABEL[status] ?? status}</span>
}
