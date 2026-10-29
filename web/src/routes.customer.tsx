import type { JSX, ReactNode } from 'react'
import { NotificationsProvider } from './account/NotificationsProvider'
import { AuthProvider } from './auth/AuthProvider'
import Account from './pages/Account'
import Checkout from './pages/Checkout'
import Forgot from './pages/Forgot'
import Login from './pages/Login'
import OrderDetail from './pages/OrderDetail'
import OrderSuccess from './pages/OrderSuccess'
import Reset from './pages/Reset'
import Signup from './pages/Signup'

export { RequireAuth } from './auth/RequireAuth'
export { useAuth } from './auth/useAuth'
export { useNotifications } from './account/NotificationsProvider'

/** Mount once, above the router's <Routes> and the Navbar, so everything can call useAuth(). */
export function CustomerProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificationsProvider>{children}</NotificationsProvider>
    </AuthProvider>
  )
}

export const customerRoutes: { path: string; element: JSX.Element }[] = [
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  { path: '/forgot-password', element: <Forgot /> },
  { path: '/reset-password', element: <Reset /> },
  { path: '/checkout', element: <Checkout /> },
  { path: '/order/success', element: <OrderSuccess /> },
  { path: '/orders/:id', element: <OrderDetail /> },
  { path: '/account', element: <Account /> },
  { path: '/account/:tab', element: <Account /> },
]
