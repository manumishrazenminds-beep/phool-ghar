import { SignOut } from '@phosphor-icons/react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Favourites } from '../account/Favourites'
import { Addresses } from '../account/Addresses'
import { Notifications } from '../account/Notifications'
import { useNotifications } from '../account/NotificationsProvider'
import { Orders } from '../account/Orders'
import { ProfileForm } from '../account/ProfileForm'
import { Subscriptions } from '../account/Subscriptions'
import { Support } from '../account/Support'
import { RequireAuth } from '../auth/RequireAuth'
import { useAuth } from '../auth/useAuth'
import { PageShell } from '../lib/ui'

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'subscriptions', label: 'Daily plans' },
  { id: 'favourites', label: 'Favourites' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'profile', label: 'Profile' },
  { id: 'support', label: 'Support' },
] as const

function Inner() {
  const { tab } = useParams()
  const { profile, user, signOut } = useAuth()
  const nav = useNavigate()
  const { unread } = useNotifications()
  if (!tab) return <Navigate to="/account/orders" replace />
  if (!TABS.some((t) => t.id === tab)) return <Navigate to="/account/orders" replace />
  const first = (profile?.full_name ?? user?.email ?? '').split(/[ @]/)[0]
  return (
    <PageShell eyebrow="Your account" title={first ? <>Hello, <em>{first}</em></> : 'Your account'}>
      <div className="-mt-6 mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <Link to="/shop" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">Back to shop</Link>
        <button type="button" onClick={() => void signOut().then(() => nav('/'))} className="inline-flex min-h-11 items-center gap-1.5 text-ink-soft hover:text-rose"><SignOut size={16} aria-hidden />Sign out</button>
      </div>
      <nav aria-label="Account sections" className="no-scrollbar -mx-6 mb-10 flex gap-1 overflow-x-auto border-b border-ink/10 px-6">
        {TABS.map((t) => (
          <Link key={t.id} to={`/account/${t.id}`} aria-current={tab === t.id ? 'page' : undefined}
            className={`relative flex min-h-11 shrink-0 items-center px-4 text-sm font-medium transition ${tab === t.id ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-marigold' : 'text-ink-soft hover:text-ink'}`}>
            {t.label}
            {t.id === 'notifications' && unread > 0 && <span className="ml-2 rounded-full bg-marigold px-1.5 text-[11px] text-white">{unread}</span>}
          </Link>
        ))}
      </nav>
      {tab === 'orders' && <Orders />}
      {tab === 'subscriptions' && <Subscriptions />}
      {tab === 'favourites' && <Favourites />}
      {tab === 'addresses' && <Addresses />}
      {tab === 'notifications' && <Notifications />}
      {tab === 'profile' && <ProfileForm key={profile?.id ?? 'p'} />}
      {tab === 'support' && <Support />}
    </PageShell>
  )
}

export default function Account() {
  return <RequireAuth><Inner /></RequireAuth>
}
