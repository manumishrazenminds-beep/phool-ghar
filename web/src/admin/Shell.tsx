import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { backendConfigured } from '../lib/env'
import { AdminLogin } from './AdminLogin'
import { AdminModeProvider, useAdminMode } from './mode'
import { useProfile, type ProfileState } from './useProfile'
import { Button, ToastProvider } from './ui'
import { DemoBar } from './DemoBar'

const CSS = `
@keyframes drawerIn{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
[data-admin-root]{font-size:14px}
[data-admin-root] :focus-visible{outline:2px solid var(--color-marigold);outline-offset:2px}
@media print{
  body *{visibility:hidden}
  [data-admin-root],[data-admin-root] *{visibility:visible}
  #root>*:not([data-admin-root]){display:none!important}
  html,body,#root{height:auto!important;overflow:visible!important}
  [data-admin-root]{position:static!important;overflow:visible!important;background:#fff!important}
  [data-admin-root] .admin-chrome{display:none!important}
  [data-admin-root] main{padding:0!important}
  .grain::after{display:none}
}
`

/** Wraps every admin/delivery screen: providers, fixed full-screen surface (covers storefront chrome), print css. */
export function AdminRoot({ children }: { children: ReactNode }) {
  return (
    <AdminModeProvider>
      <ToastProvider>
        <style>{CSS}</style>
        <div data-admin-root data-lenis-prevent className="fixed inset-0 z-[100] overflow-auto bg-cream font-sans text-ink">
          {children}
        </div>
      </ToastProvider>
    </AdminModeProvider>
  )
}

function Center({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-lg px-5 py-16 text-center">{children}</div>
}

/**
 * Resolves backend/demo/sign-in/role in one place. `render` runs only when the user may be here.
 * area 'admin': admin + staff. area 'delivery': delivery role (admin/staff are sent to /admin).
 */
export function Gate({ area, render }: { area: 'admin' | 'delivery'; render: (p: ProfileState) => ReactNode }) {
  const { demo } = useAdminMode()
  const p = useProfile()
  useEffect(() => { document.title = area === 'admin' ? 'Admin | Phool Ghar' : 'Deliveries | Phool Ghar' }, [area])
  if (p.loading) return <Center><p className="font-mono text-xs uppercase tracking-widest text-ink-soft" role="status">Loading your account...</p></Center>
  if (!p.signedIn) return <AdminLogin title={area === 'admin' ? 'Team sign in' : 'Delivery sign in'} />
  if (p.error || !p.profile)
    return (
      <Center>
        <h1 className="font-display text-4xl">Could not load your account</h1>
        <p className="mt-2 text-sm text-ink-soft">{p.error ?? 'No profile.'}</p>
        <div className="mt-4 flex justify-center gap-2"><Button onClick={p.refresh}>Try again</Button><Button onClick={() => void p.signOut()}>Sign out</Button></div>
      </Center>
    )
  const role = p.profile.role
  if (role === 'customer' || p.profile.active === false)
    return p.profile.active === false && role !== 'customer'
      ? <Center><h1 className="font-display text-4xl">Account deactivated</h1><p className="mt-2 text-sm text-ink-soft">Ask the owner to reactivate your account.</p><Button className="mt-4" onClick={() => void p.signOut()}>Sign out</Button></Center>
      : <Navigate to="/" replace />
  if (area === 'admin' && role === 'delivery') return <Navigate to="/delivery" replace />
  if (area === 'delivery' && role !== 'delivery') return demo && backendConfigured ? <><DemoBar /><Center><h1 className="font-display text-4xl">Switch to the delivery role</h1><p className="mt-2 text-sm text-ink-soft">You are previewing as {role}. Choose Delivery staff in the orange bar above to see this app.</p></Center></> : <Navigate to="/admin" replace />
  return <>{render(p)}</>
}
