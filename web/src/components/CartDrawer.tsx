import { ArrowRight, Minus, Plus, Repeat, ShoppingBag, Trash, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AddOns } from './AddOns'
import { PRODUCTS, VARIANTS, inr } from '../data/products'
import { linePrice, useCart } from '../lib/cart'

export function CartDrawer() {
  const { lines, open, setOpen, setQty, remove, subtotal } = useCart()
  const navigate = useNavigate()
  const firstOnce = lines.find((l) => l.mode === 'once' && PRODUCTS.find((p) => p.id === l.productId)?.category !== 'addon')

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-[80] bg-ink/40 backdrop-blur-sm" />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 280 }}
            className="fixed inset-y-0 right-0 z-[90] flex w-full max-w-md flex-col bg-cream shadow-2xl"
            role="dialog" aria-label="Cart" data-lenis-prevent
          >
            <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
              <h2 className="font-display text-2xl font-semibold">Your basket</h2>
              <button onClick={() => setOpen(false)} aria-label="Close cart" className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5">
                <X size={20} />
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="grid flex-1 place-items-center px-8 text-center">
                <div>
                  <ShoppingBag size={44} className="mx-auto text-marigold" />
                  <p className="mt-4 font-display text-2xl">Nothing here yet</p>
                  <p className="mt-1 text-sm text-ink-soft">Fresh blooms are a tap away.</p>
                </div>
              </div>
            ) : (
              <ul className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {lines.map((l) => {
                  const p = PRODUCTS.find((x) => x.id === l.productId)!
                  const v = VARIANTS.find((x) => x.id === l.variantId)!
                  return (
                    <motion.li layout key={l.key} className="flex gap-4">
                      <img src={p.image} alt={p.name} className="h-24 w-20 rounded-2xl object-cover" />
                      <div className="flex-1">
                        <div className="flex justify-between gap-2">
                          <p className="font-display text-lg leading-tight">{p.name}</p>
                          <button onClick={() => remove(l.key)} aria-label={`Remove ${p.name}`} className="text-ink-soft hover:text-rose">
                            <Trash size={18} />
                          </button>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-soft">
                          {v.label}
                          {l.mode === 'sub' && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-leaf-soft px-2 py-0.5 font-medium text-leaf">
                              <Repeat size={11} /> {l.period} days
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">{l.mode === 'sub' ? 'Starts' : 'Delivers'} {l.date}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 rounded-full border border-ink/15 px-1.5 py-1">
                            <button onClick={() => setQty(l.key, l.qty - 1)} aria-label="Decrease" className="grid h-6 w-6 place-items-center rounded-full hover:bg-ink/5"><Minus size={13} /></button>
                            <span className="w-4 text-center text-sm font-medium">{l.qty}</span>
                            <button onClick={() => setQty(l.key, l.qty + 1)} aria-label="Increase" className="grid h-6 w-6 place-items-center rounded-full hover:bg-ink/5"><Plus size={13} /></button>
                          </div>
                          <p className="font-medium">{inr(linePrice(l))}</p>
                        </div>
                      </div>
                    </motion.li>
                  )
                })}
              </ul>
            )}

            {lines.length > 0 && firstOnce && (
              <div className="border-t border-ink/10 px-6 py-4"><AddOns compact date={firstOnce.date} slot={firstOnce.slot} /></div>
            )}

            {lines.length > 0 && (
              <div className="border-t border-ink/10 bg-cream-2 px-6 py-5">
                <div className="flex justify-between text-sm text-ink-soft"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
                <div className="mt-1 flex justify-between text-sm text-ink-soft"><span>Delivery</span><span>Calculated at checkout</span></div>
                <button onClick={() => { setOpen(false); navigate('/checkout') }} className="group mt-4 flex w-full items-center justify-between rounded-full bg-ink px-6 py-4 font-medium text-cream transition hover:bg-marigold-deep">
                  <span>Checkout</span>
                  <span className="flex items-center gap-2">{inr(subtotal)} <ArrowRight size={18} className="transition group-hover:translate-x-1" /></span>
                </button>
                <p className="mt-3 text-center text-xs text-ink-soft">Secure payment via UPI, cards and net banking.</p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
