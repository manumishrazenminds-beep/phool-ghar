import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'
import { AdminRoot, Gate } from './Shell'
import type { Perm } from './types'
import type { ProfileState } from './useProfile'
import { EmptyState, Panel, Skeleton } from './ui'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Today = lazy(() => import('./pages/Today'))
const Orders = lazy(() => import('./pages/Orders'))
const Subscriptions = lazy(() => import('./pages/Subscriptions'))
const Customers = lazy(() => import('./pages/Customers'))
const Products = lazy(() => import('./pages/Products'))
const Categories = lazy(() => import('./pages/Categories'))
const Stock = lazy(() => import('./pages/Stock'))
const Plans = lazy(() => import('./pages/Plans'))
const DeliverySettings = lazy(() => import('./pages/DeliverySettings'))
const Coupons = lazy(() => import('./pages/Coupons'))
const Reviews = lazy(() => import('./pages/Reviews'))
const Reports = lazy(() => import('./pages/Reports'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Team = lazy(() => import('./pages/Team'))
const Settings = lazy(() => import('./pages/Settings'))

function Need({ p, perm, adminOnly, children }: { p: ProfileState; perm?: Perm; adminOnly?: boolean; children: ReactNode }) {
  const ok = adminOnly ? p.isAdmin : perm ? p.can(perm) : true
  return ok ? <>{children}</> : <Panel><EmptyState title="Not available for your account">Ask the owner to give your account the "{perm ?? 'team'}" permission if you need this section.</EmptyState></Panel>
}

export default function AdminApp() {
  return (
    <AdminRoot>
      <Gate area="admin" render={(p) => (
        <AdminLayout profile={p}>
          <Suspense fallback={<Skeleton rows={6} />}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="today" element={<Need p={p} perm="orders"><Today /></Need>} />
              <Route path="orders" element={<Need p={p} perm="orders"><Orders /></Need>} />
              <Route path="subscriptions" element={<Need p={p} perm="subscriptions"><Subscriptions /></Need>} />
              <Route path="customers" element={<Need p={p} perm="customers"><Customers /></Need>} />
              <Route path="products" element={<Need p={p} perm="products"><Products /></Need>} />
              <Route path="categories" element={<Need p={p} perm="products"><Categories /></Need>} />
              <Route path="stock" element={<Need p={p} perm="stock"><Stock /></Need>} />
              <Route path="plans" element={<Need p={p} perm="products"><Plans /></Need>} />
              <Route path="delivery-settings" element={<Need p={p} perm="settings"><DeliverySettings /></Need>} />
              <Route path="reviews" element={<Need p={p} perm="products"><Reviews /></Need>} />
              <Route path="coupons" element={<Need p={p} perm="coupons"><Coupons /></Need>} />
              <Route path="reports" element={<Need p={p} perm="reports"><Reports /></Need>} />
              <Route path="notifications" element={<Need p={p} perm="orders"><Notifications /></Need>} />
              <Route path="team" element={<Need p={p} adminOnly><Team /></Need>} />
              <Route path="settings" element={<Need p={p} perm="settings"><Settings /></Need>} />
              <Route path="*" element={<Panel><EmptyState title="Page not found">Use the menu to pick a section.</EmptyState></Panel>} />
            </Routes>
          </Suspense>
        </AdminLayout>
      )} />
    </AdminRoot>
  )
}
