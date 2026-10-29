import { lazy, Suspense, type ReactElement } from 'react'

const AdminApp = lazy(() => import('./admin/AdminApp'))
const DeliveryApp = lazy(() => import('./delivery/DeliveryApp'))

const Loading = () => <div className="fixed inset-0 z-[100] grid place-items-center bg-[#fbf5ea] font-mono text-xs uppercase tracking-widest text-[#5b5149]" role="status">Loading...</div>

/**
 * Admin (/admin/*) and delivery (/delivery/*) routes. Each element is code-split, has its own Suspense, renders its
 * own full-screen surface and brings its own providers, so the integrator only maps these into <Routes>.
 */
export const adminRoutes: { path: string; element: ReactElement }[] = [
  { path: '/admin/*', element: <Suspense fallback={<Loading />}><AdminApp /></Suspense> },
  { path: '/delivery/*', element: <Suspense fallback={<Loading />}><DeliveryApp /></Suspense> },
]
