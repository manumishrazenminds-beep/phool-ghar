import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { BackendOff, PageShell, SkeletonList } from '../lib/ui'
import { useAuth } from './useAuth'

/** Gate for signed-in pages. Without a backend it shows the friendly "not connected" panel instead of redirecting. */
export function RequireAuth({ children, what }: { children: ReactNode; what?: string }) {
  const { configured, loading, session } = useAuth()
  const loc = useLocation()
  if (!configured) return <PageShell title="Your account"><BackendOff what={what ?? 'Your account'} /></PageShell>
  if (loading) return <PageShell title="One moment"><SkeletonList rows={2} /></PageShell>
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <>{children}</>
}
