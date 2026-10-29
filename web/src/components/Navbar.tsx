import { List, MagnifyingGlass, ShoppingBag, SignOut, UserCircle, X } from '@phosphor-icons/react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useNotifications } from '../account/NotificationsProvider'
import { useAuth } from '../auth/useAuth'
import { useCart } from '../lib/cart'
import { Logo } from './Logo'

const LEFT = [
  { to: '/shop?c=pooja', label: 'Pooja Flowers' },
  { to: '/shop?c=bouquets', label: 'Bouquets' },
  { to: '/shop?type=sub', label: 'Daily Plans' },
]
const RIGHT = [
  { to: '/#story', label: 'How it works' },
  { to: '/#faq', label: 'Help' },
]
const ALL = [...LEFT, ...RIGHT]

export function Navbar() {
  const { count, setOpen } = useCart()
  const { session, role, profile, signOut } = useAuth()
  const nav = useNavigate()
  const [acct, setAcct] = useState(false)
  const acctRef = useRef<HTMLDivElement>(null)
  const leave = async () => { setAcct(false); setMenu(false); await signOut(); nav('/') }
  const { unread } = useNotifications()
  const loc = useLocation()
  const [menu, setMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const { scrollY } = useScroll()
  const onDark = loc.pathname === '/' && !scrolled

  // Close the account menu on outside click or Escape. (A fixed overlay would be trapped by the nav's backdrop-filter.)
  useEffect(() => {
    if (!acct) return
    const down = (e: MouseEvent) => { if (!acctRef.current?.contains(e.target as Node)) setAcct(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setAcct(false) }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [acct])
  useEffect(() => { setAcct(false) }, [loc.pathname])

  useMotionValueEvent(scrollY, 'change', (v) => {
    const prev = scrollY.getPrevious() ?? 0
    setScrolled(v > 24)
    // hide on the way down once past the fold, bring back on any upward scroll
    setHidden(v > 480 && v > prev)
  })

  const isActive = (to: string) => !to.includes('#') && loc.pathname + loc.search === to
  const link = (l: { to: string; label: string }) => (
    <Link
      key={l.label}
      to={l.to}
      aria-current={isActive(l.to) ? 'page' : undefined}
      className={`group relative py-2 text-[13px] font-medium tracking-wide transition-colors duration-200 ${onDark ? 'text-cream/80 hover:text-white' : 'text-ink-soft hover:text-ink'} ${isActive(l.to) ? (onDark ? '!text-white' : '!text-ink') : ''}`}
    >
      {l.label}
      <span className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-marigold transition-transform duration-300 ${isActive(l.to) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
    </Link>
  )
  const iconBtn = `relative grid h-11 w-11 place-items-center rounded-full transition-colors duration-200 ${onDark ? 'text-cream hover:bg-white/10' : 'text-ink hover:bg-ink/5'}`

  return (
    <>
      <motion.header
        animate={{ y: hidden && !menu ? '-130%' : 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6"
      >
        <motion.nav
          aria-label="Main"
          animate={{ backgroundColor: scrolled ? 'rgba(251,245,234,0.86)' : 'rgba(251,245,234,0)' }}
          className={`relative mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 rounded-full pl-4 pr-2 transition-shadow duration-300 sm:pl-6 sm:pr-4 ${scrolled ? 'shadow-[0_10px_34px_-14px_rgba(31,26,23,.35)] ring-1 ring-ink/5 backdrop-blur-xl' : ''}`}
        >
          {/* left: logo */}
          <Logo light={onDark} />

          {/* centre: links (desktop) */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex">
            {LEFT.map(link)}
            <div className="hidden items-center gap-7 xl:flex">{RIGHT.map(link)}</div>
          </div>

          {/* right: actions */}
          <div className="flex items-center gap-1">
            <Link to="/shop" aria-label="Search flowers" className={`${iconBtn} hidden sm:grid`}><MagnifyingGlass size={21} /></Link>
            {session ? (
              <div ref={acctRef} className="relative hidden md:block">
                <button type="button" onClick={() => setAcct((v) => !v)} aria-label="Your account menu" aria-expanded={acct} className={`${iconBtn} grid`}>
                  <UserCircle size={23} />
                  {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-marigold" />}
                </button>
                {acct && (
                  <>
                    <div role="menu" className="absolute right-0 top-14 z-50 w-60 overflow-hidden rounded-2xl border border-ink/10 bg-white p-1.5 text-ink shadow-[0_24px_60px_-20px_rgba(31,26,23,0.35)]">
                      <p className="truncate px-3 pb-2 pt-2.5 text-xs text-ink-soft">{profile?.full_name ?? profile?.email ?? 'Signed in'}</p>
                      {[{ to: '/account/orders', label: 'Orders' }, { to: '/account/subscriptions', label: 'Daily plans' }, { to: '/account/addresses', label: 'Addresses' }, ...(role === 'admin' || role === 'staff' ? [{ to: '/admin', label: 'Admin console' }] : []), ...(role === 'delivery' ? [{ to: '/delivery', label: 'My deliveries' }] : [])].map((l) => (
                        <Link key={l.to} to={l.to} role="menuitem" onClick={() => setAcct(false)} className="flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-cream-2">{l.label}</Link>
                      ))}
                      <button type="button" role="menuitem" onClick={() => void leave()} className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl border-t border-ink/10 px-3 text-sm text-rose hover:bg-rose-soft/50"><SignOut size={16} aria-hidden />Sign out</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link to="/login" aria-label="Sign in" className={`${iconBtn} hidden md:grid`}><UserCircle size={23} /></Link>
            )}
            <button onClick={() => setOpen(true)} aria-label={`Open basket, ${count} items`} className={iconBtn}>
              <ShoppingBag size={22} />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span key={count} initial={{ scale: 0.3 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-marigold px-1 text-[11px] font-bold text-white">
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <Link to="/shop?type=sub" className={`ml-1 hidden h-11 items-center rounded-full px-5 text-[13px] font-medium transition-colors duration-200 lg:inline-flex ${onDark ? 'bg-cream text-ink hover:bg-saffron' : 'bg-ink text-cream hover:bg-marigold-deep'}`}>
              Start a plan
            </Link>
            <button onClick={() => setMenu(true)} aria-label="Open menu" className={`${iconBtn} lg:hidden`}>
              <List size={24} />
            </button>
          </div>
        </motion.nav>
      </motion.header>

      <AnimatePresence>
        {menu && (
          <motion.div
            role="dialog" aria-label="Menu"
            initial={{ clipPath: 'circle(0% at 92% 6%)' }} animate={{ clipPath: 'circle(150% at 92% 6%)' }} exit={{ clipPath: 'circle(0% at 92% 6%)' }}
            transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-[70] flex flex-col bg-leaf px-6 py-5 text-cream"
          >
            <div className="flex items-center justify-between">
              <Logo light />
              <button onClick={() => setMenu(false)} aria-label="Close menu" className="grid h-11 w-11 place-items-center rounded-full bg-white/10"><X size={22} /></button>
            </div>
            <ul className="mt-14 flex flex-col">
              {ALL.map((l, i) => (
                <motion.li key={l.label} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.07 }} className="border-b border-white/10">
                  <Link to={l.to} onClick={() => setMenu(false)} className="flex items-baseline gap-4 py-4 font-display text-[2.6rem] leading-none">
                    <span className="font-mono text-[11px] tracking-widest text-saffron">0{i + 1}</span>{l.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <div className="mt-auto flex gap-3 pb-4 pt-8">
              {session ? (
                <>
                  <Link to={role === 'admin' || role === 'staff' ? '/admin' : role === 'delivery' ? '/delivery' : '/account'} onClick={() => setMenu(false)} className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-white/25 text-sm font-medium">{role === 'admin' || role === 'staff' ? 'Admin console' : role === 'delivery' ? 'My deliveries' : 'My account'}</Link>
                  <button type="button" onClick={() => void leave()} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/25 text-sm font-medium"><SignOut size={16} aria-hidden />Sign out</button>
                </>
              ) : (
                <Link to="/login" onClick={() => setMenu(false)} className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-white/25 text-sm font-medium">Sign in</Link>
              )}
            </div>
            <Link to="/shop?type=sub" onClick={() => setMenu(false)} className="inline-flex h-14 items-center justify-center rounded-full bg-marigold text-base font-medium text-white">Start a daily plan</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
