import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PLAN_PERIODS, VARIANTS, findProduct, PRODUCTS } from '../data/products'

export interface CartLine {
  key: string
  productId: string
  variantId: string
  mode: 'once' | 'sub'
  qty: number
  /** one-time: ISO delivery date. subscription: ISO start date */
  date: string
  slot: string
  /** subscription only */
  period?: number
  days?: number[]
}

interface CartCtx {
  lines: CartLine[]
  open: boolean
  setOpen: (v: boolean) => void
  add: (line: Omit<CartLine, 'key'>) => void
  remove: (key: string) => void
  setQty: (key: string, qty: number) => void
  clear: () => void
  count: number
  subtotal: number
}

const Ctx = createContext<CartCtx | null>(null)
const STORAGE = 'phoolghar.cart.v1'

export function linePrice(line: CartLine): number {
  const product = PRODUCTS.find((p) => p.id === line.productId)
  const variant = VARIANTS.find((v) => v.id === line.variantId)
  if (!product || !variant) return 0
  if (line.mode === 'once') return product.price * variant.multiplier * line.qty
  const perDay = (product.perDay ?? 0) * variant.multiplier
  const period = PLAN_PERIODS.find((p) => p.days === line.period) ?? PLAN_PERIODS[2]
  return perDay * period.days * (1 - period.discount) * line.qty
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE)
      return raw ? (JSON.parse(raw) as CartLine[]).filter((l) => findProduct(PRODUCTS.find((p) => p.id === l.productId)?.slug ?? '')) : []
    } catch {
      return []
    }
  })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(lines))
    } catch {
      /* storage unavailable */
    }
  }, [lines])

  const add = useCallback((line: Omit<CartLine, 'key'>) => {
    const key = [line.productId, line.variantId, line.mode, line.date, line.slot, line.period, line.days?.join('')].join('|')
    setLines((prev) => {
      const hit = prev.find((l) => l.key === key)
      if (hit) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + line.qty } : l))
      return [...prev, { ...line, key }]
    })
    setOpen(true)
  }, [])

  const remove = useCallback((key: string) => setLines((p) => p.filter((l) => l.key !== key)), [])
  const setQty = useCallback(
    (key: string, qty: number) => setLines((p) => (qty <= 0 ? p.filter((l) => l.key !== key) : p.map((l) => (l.key === key ? { ...l, qty } : l)))),
    [],
  )
  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartCtx>(
    () => ({
      lines, open, setOpen, add, remove, setQty, clear,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + linePrice(l), 0),
    }),
    [lines, open, add, remove, setQty, clear],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCart outside CartProvider')
  return c
}
