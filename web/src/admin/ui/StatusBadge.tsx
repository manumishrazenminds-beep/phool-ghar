import clsx from 'clsx'
import { humanize } from '../format'

type Tone = 'neutral' | 'amber' | 'green' | 'red' | 'blue' | 'violet'
const TONE: Record<Tone, string> = {
  neutral: 'bg-ink/5 text-ink-soft ring-ink/10',
  amber: 'bg-saffron/25 text-marigold-deep ring-marigold/25',
  green: 'bg-leaf-soft text-leaf ring-leaf/20',
  red: 'bg-rose-soft text-rose ring-rose/20',
  blue: 'bg-sky-100 text-sky-800 ring-sky-300/50',
  violet: 'bg-violet-100 text-violet-800 ring-violet-300/50',
}
const MAP: Record<string, Tone> = {
  placed: 'neutral', confirmed: 'blue', preparing: 'amber', out_for_delivery: 'violet', delivered: 'green', cancelled: 'red', failed: 'red',
  pending: 'amber', paid: 'green', refunded: 'neutral', partially_refunded: 'neutral',
  pending_payment: 'amber', active: 'green', paused: 'amber', on_hold: 'amber', completed: 'neutral',
  queued: 'neutral', sending: 'blue', sent: 'green', dead: 'red', processed: 'green',
  captured: 'green', created: 'neutral', authorized: 'blue',
  one_time: 'neutral', subscription_delivery: 'violet',
  admin: 'violet', staff: 'blue', delivery: 'amber', customer: 'neutral',
}
export function StatusBadge({ status, label, tone }: { status: string; label?: string; tone?: Tone }) {
  return (
    <span className={clsx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', TONE[tone ?? MAP[status] ?? 'neutral'])}>
      {label ?? (status === 'subscription_delivery' ? 'Subscription' : status === 'one_time' ? 'One-time' : humanize(status))}
    </span>
  )
}
