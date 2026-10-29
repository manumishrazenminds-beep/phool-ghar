import type { CheckoutLine } from './api'
import type { ResolvedLine } from './catalog'

/** Display-only mirror of the server maths. The server (preview_pricing / create_checkout) is authoritative. */

export const paise = (rupees: number) => Math.round(rupees * 100)
export const inrP = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })

export function linePaise(r: ResolvedLine): number {
  const { line, product, variant, plan } = r
  if (line.mode === 'once') return Math.round(paise(product.price) * variant.multiplier) * line.qty
  const perDay = Math.round(paise(product.perDay ?? 0) * variant.multiplier)
  return Math.round(perDay * (plan?.days ?? line.period ?? 0) * (1 - (plan?.discount ?? 0))) * line.qty
}

export interface Breakdown { subtotal: number; discount: number; delivery: number; tax: number; total: number }

export function breakdown(opts: { lines: ResolvedLine[]; discount?: number; feePaise?: number; freeDeliveryForSub?: boolean; minOrder?: number; serverTax?: number }): Breakdown {
  const subtotal = opts.lines.reduce((s, l) => s + linePaise(l), 0)
  const allSub = opts.lines.length > 0 && opts.lines.every((l) => l.line.mode === 'sub')
  const delivery = allSub && opts.freeDeliveryForSub ? 0 : opts.feePaise ?? 0
  const discount = Math.min(opts.discount ?? 0, subtotal)
  return { subtotal, discount, delivery, tax: opts.serverTax ?? 0, total: Math.max(0, subtotal - discount + delivery) }
}

export function toCheckoutLines(lines: ResolvedLine[]): CheckoutLine[] {
  return lines.map((r) => ({ product_slug: r.product.slug, variant_key: r.variant.id, qty: r.line.qty, mode: r.line.mode }))
}

/** Number of delivery days a subscription covers, for the summary text only. */
export const planLabel = (r: ResolvedLine) => (r.plan ? `${r.plan.label}, ${r.plan.days} days` : '')
