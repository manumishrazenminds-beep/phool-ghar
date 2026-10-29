import { AnimatePresence, motion } from 'motion/react'
import Lenis from 'lenis'
import { useEffect } from 'react'
import { applyRobots } from './lib/seo'
import { Route, Routes, useLocation } from 'react-router-dom'
import { CartDrawer } from './components/CartDrawer'
import { Footer } from './components/Footer'
import { Navbar } from './components/Navbar'
import Help from './pages/Help'
import Policy from './pages/Policy'
import Home from './pages/Home'
import Product from './pages/Product'
import Shop from './pages/Shop'
import { adminRoutes } from './routes.admin'
import { customerRoutes } from './routes.customer'
import { StoryDebug } from './story/Story'

function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 })
    let raf = 0
    const tick = (t: number) => {
      lenis.raf(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])
}

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  useSmoothScroll()
  const location = useLocation()
  useEffect(() => { applyRobots(location.pathname) }, [location.pathname])
  // admin and delivery apps bring their own chrome
  const backoffice = location.pathname.startsWith('/admin') || location.pathname.startsWith('/delivery')
  return (
    <div className={backoffice ? '' : 'grain'}>
      <ScrollToTop />
      {!backoffice && <Navbar />}
      {!backoffice && <CartDrawer />}
      <AnimatePresence mode="wait">
        <motion.main key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/help" element={<Help />} />
            <Route path="/policy/:slug" element={<Policy />} />
            <Route path="/__story" element={<StoryDebug />} />
            <Route path="/product/:slug" element={<Product />} />
            {customerRoutes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
            {adminRoutes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
            <Route path="*" element={<Home />} />
          </Routes>
        </motion.main>
      </AnimatePresence>
      {!backoffice && <Footer />}
    </div>
  )
}
