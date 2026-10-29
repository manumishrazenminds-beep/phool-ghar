import { useNavigate } from 'react-router-dom'
import { fmtDateTime } from '../lib/dates'
import { Button, EmptyState, ErrorState, SkeletonList } from '../lib/ui'
import { useNotifications } from './NotificationsProvider'

export function Notifications() {
  const { items, unread, loading, error, reload, markRead, markAllRead } = useNotifications()
  const nav = useNavigate()
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading && items.length === 0) return <SkeletonList />

  function open(id: string, data: Record<string, unknown> | null) {
    void markRead(id)
    const order = typeof data?.order_id === 'string' ? data.order_id : null
    if (order) nav(`/orders/${order}`)
    else if (data?.subscription_id) nav('/account/subscriptions')
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-3xl">Notifications{unread > 0 && <span className="ml-3 align-middle font-sans text-sm text-ink-soft">{unread} new</span>}</h2>
        {unread > 0 && <Button variant="ghost" onClick={() => void markAllRead()}>Mark all as read</Button>}
      </div>
      {items.length === 0 ? (
        <div className="mt-6"><EmptyState title="All quiet" body="Delivery updates and reminders will appear here." /></div>
      ) : (
        <ul className="mt-6 divide-y divide-ink/10 rounded-3xl border border-ink/10 bg-white" aria-live="polite">
          {items.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n.id, n.data)} className={`flex min-h-16 w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-cream-2/60 ${n.read_at ? '' : 'bg-saffron/10'}`}>
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-marigold'}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.read_at ? '' : 'font-medium'}`}>{n.title}{!n.read_at && <span className="sr-only"> (unread)</span>}</span>
                  {n.body && <span className="mt-0.5 block text-sm text-ink-soft">{n.body}</span>}
                  <span className="mt-1 block text-xs text-ink-soft">{fmtDateTime(n.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
