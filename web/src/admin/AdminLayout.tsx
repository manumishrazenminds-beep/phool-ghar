import {
  ArrowLeft, Bell, CalendarBlank, ChartBar, Gauge, Gear, List, MapPin, Package, Receipt, Repeat, SignOut, Storefront, Tag, Ticket, Truck, UserGear, Users, X, Flower, Star,
} from '@phosphor-icons/react'
import clsx from 'clsx'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogoMark } from '../components/Logo'
import { backendConfigured } from '../lib/env'
import { DemoBar } from './DemoBar'
import { useAdminMode } from './mode'
import type { ProfileState } from './useProfile'
import type { Perm } from './types'
import { StatusBadge } from './ui'

export interface NavItem { to: string; label: string; icon: ReactNode; perm?: Perm; adminOnly?: boolean; group: string }
const I = (C: typeof Gauge) => <C size={18} />
export const NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: I(Gauge), group: 'Operate' },
  { to: '/admin/today', label: "Today's deliveries", icon: I(Truck), perm: 'orders', group: 'Operate' },
  { to: '/admin/orders', label: 'Orders', icon: I(Receipt), perm: 'orders', group: 'Operate' },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: I(Repeat), perm: 'subscriptions', group: 'Operate' },
  { to: '/admin/customers', label: 'Customers', icon: I(Users), perm: 'customers', group: 'Operate' },
  { to: '/admin/products', label: 'Products', icon: I(Flower), perm: 'products', group: 'Catalogue' },
  { to: '/admin/reviews', label: 'Reviews', icon: I(Star), perm: 'products', group: 'Catalogue' },
  { to: '/admin/categories', label: 'Categories', icon: I(Tag), perm: 'products', group: 'Catalogue' },
  { to: '/admin/stock', label: 'Stock', icon: I(Package), perm: 'stock', group: 'Catalogue' },
  { to: '/admin/plans', label: 'Plans', icon: I(CalendarBlank), perm: 'products', group: 'Catalogue' },
  { to: '/admin/delivery-settings', label: 'Delivery settings', icon: I(MapPin), perm: 'settings', group: 'Store' },
  { to: '/admin/coupons', label: 'Coupons', icon: I(Ticket), perm: 'coupons', group: 'Store' },
  { to: '/admin/reports', label: 'Reports', icon: I(ChartBar), perm: 'reports', group: 'Store' },
  { to: '/admin/notifications', label: 'Notifications', icon: I(Bell), perm: 'orders', group: 'Store' },
  { to: '/admin/team', label: 'Team', icon: I(UserGear), adminOnly: true, group: 'Store' },
  { to: '/admin/settings', label: 'Settings', icon: I(Gear), perm: 'settings', group: 'Store' },
]
export const allowed = (n: NavItem, p: ProfileState) => (n.adminOnly ? p.isAdmin : n.perm ? p.can(n.perm) : true)

/** Same marigold mark and wordmark as the storefront, so the console reads as part of the site. */
function Brand() {
  return (
    <Link to="/admin" aria-label="Phool Ghar admin, dashboard" className="group mb-5 flex items-center gap-2.5 px-3 pt-2">
      <span className="transition-transform duration-500 group-hover:rotate-[36deg]"><LogoMark size={34} /></span>
      <span>
        <span className="block font-display text-[1.6rem] leading-none">Phool <em className="pr-0.5 text-marigold">Ghar</em></span>
        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-marigold-deep">Admin</span>
      </span>
    </Link>
  )
}

export function AdminLayout({ profile, children }: { profile: ProfileState; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { demo, setDemo } = useAdminMode()
  const items = NAV.filter((n) => allowed(n, profile))
  const groups = Array.from(new Set(items.map((n) => n.group)))
  const role = profile.profile?.role ?? 'staff'
  const loc = useLocation()
  const navigate = useNavigate()
  const isRoot = loc.pathname.replace(/\/$/, '') === '/admin'
  const goBack = () => { if ((window.history.state?.idx ?? 0) > 0) navigate(-1); else navigate('/admin') }

  const nav = (
    <nav aria-label="Admin sections" className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <p className="px-3 pb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft/70">{g}</p>
          <ul>
            {items.filter((n) => n.group === g).map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.to === '/admin'} onClick={() => setOpen(false)}
                  className={({ isActive }) => clsx('flex min-h-9 items-center gap-2.5 rounded-lg px-3 text-sm pointer-coarse:min-h-11', isActive ? 'bg-ink text-cream' : 'text-ink-soft hover:bg-ink/5 hover:text-ink')}>
                  {n.icon}{n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="flex min-h-full flex-col">
      <DemoBar />
      <div className="flex min-h-0 flex-1">
        <aside className="admin-chrome sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-ink/10 bg-white/60 p-3 lg:flex">
          <Brand />
          {nav}
        </aside>

        {open && (
          <div className="admin-chrome fixed inset-0 z-[150] lg:hidden">
            <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-cream p-3 shadow-2xl">
              <div className="mb-3 flex items-center justify-between px-3 pt-2">
                <Brand />
                <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-ink/5"><X size={20} /></button>
              </div>
              {nav}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="admin-chrome sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/10 bg-cream/95 px-4 py-2 backdrop-blur">
            <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-ink/5 lg:hidden"><List size={22} /></button>
            {!isRoot && <button type="button" onClick={goBack} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink pointer-coarse:min-h-11"><ArrowLeft size={16} aria-hidden />Back</button>}
            <div className="flex-1" />
            {!backendConfigured ? null : (
              <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="h-4 w-4 accent-[#e8731a]" />
                Demo data
              </label>
            )}
            <StatusBadge status={role} label={role === 'admin' ? 'Owner' : role === 'staff' ? 'Sub-admin' : 'Delivery'} />
            <span className="max-w-40 truncate text-sm font-medium" title={profile.profile?.full_name ?? ''}>{profile.profile?.full_name ?? 'Signed in'}</span>
            <a href="/" className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-ink-soft hover:bg-ink/5 pointer-coarse:min-h-11" aria-label="View the store"><Storefront size={16} /><span className="hidden sm:inline">Store</span></a>
            {(
              <button type="button" aria-label="Sign out" onClick={() => void profile.signOut()} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-ink-soft hover:bg-ink/5 pointer-coarse:min-h-11"><SignOut size={16} /><span className="hidden sm:inline">Sign out</span></button>
            )}
          </header>
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
