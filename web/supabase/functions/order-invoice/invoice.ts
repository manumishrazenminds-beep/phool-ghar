// Pure invoice maths and HTML rendering (no Deno, no network): unit-testable under node.
import { escapeHtml, COLORS } from '../_shared/emailTemplates.ts'

export interface InvoiceLine { name: string; variant?: string | null; qty: number; unit_paise: number; line_paise: number }

export interface InvoiceInput {
  orderNo: string
  createdAt: string // ISO timestamp
  deliveryDate?: string | null
  paymentStatus?: string | null
  kind?: string | null
  lines: InvoiceLine[]
  subtotalPaise: number
  discountPaise: number
  deliveryFeePaise: number
  taxPaise: number // as stored on the order; 0 means "derive from gst_percent, prices are GST inclusive"
  totalPaise: number
  couponCode?: string | null
  address: Record<string, unknown>
  customerName?: string | null
  customerEmail?: string | null
  seller: { name: string; gstin?: string | null; address?: string | null; state?: string | null; phone?: string | null }
  gstPercent: number
}

export interface Totals {
  taxPaise: number
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  interState: boolean
  derived: boolean
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()

/** Intra-state: CGST + SGST (half each, odd paisa to SGST). Inter-state (both states known and different): IGST. */
export function computeTotals(totalPaise: number, storedTaxPaise: number, gstPercent: number, sellerState?: string | null, customerState?: unknown): Totals {
  const g = Number.isFinite(gstPercent) && gstPercent > 0 ? gstPercent : 0
  let tax = 0
  let derived = false
  if (storedTaxPaise > 0) tax = Math.min(Math.round(storedTaxPaise), Math.max(totalPaise, 0))
  else if (g > 0 && totalPaise > 0) {
    tax = Math.round((totalPaise * g) / (100 + g)) // prices are tax inclusive
    derived = true
  }
  const interState = !!norm(sellerState) && !!norm(customerState) && norm(sellerState) !== norm(customerState)
  const cgst = interState ? 0 : Math.floor(tax / 2)
  const sgst = interState ? 0 : tax - cgst
  return { taxPaise: tax, taxablePaise: totalPaise - tax, cgstPaise: cgst, sgstPaise: sgst, igstPaise: interState ? tax : 0, interState, derived }
}

export function inr(paise: number): string {
  const r = Math.round(paise) / 100
  return 'Rs. ' + r.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function istDateLabel(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000)
  if (Number.isNaN(d.getTime())) return iso
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getUTCDate()} ${m[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function renderInvoiceHtml(inv: InvoiceInput): { html: string; totals: Totals; title: string } {
  const t = computeTotals(inv.totalPaise, inv.taxPaise, inv.gstPercent, inv.seller.state, inv.address?.state)
  const hasGstin = !!(inv.seller.gstin && inv.seller.gstin.trim())
  const title = hasGstin ? 'Tax Invoice' : 'Invoice'
  const e = escapeHtml
  const a = inv.address ?? {}
  const addrLines = [a.recipient_name, a.line1, a.line2, a.landmark, [a.city, a.pincode].filter(Boolean).join(' - '), a.recipient_phone && `Phone: ${a.recipient_phone}`].filter(Boolean).map((x) => e(x))
  const rows = inv.lines
    .map((l, i) => `<tr><td class="n">${i + 1}</td><td>${e(l.name)}${l.variant ? ` <span class="m">(${e(l.variant)})</span>` : ''}</td><td class="r">${l.qty}</td><td class="r">${inr(l.unit_paise)}</td><td class="r">${inr(l.line_paise)}</td></tr>`)
    .join('')
  const sumRow = (label: string, v: number, strong = false) => `<tr${strong ? ' class="tot"' : ''}><td>${label}</td><td class="r">${inr(v)}</td></tr>`
  const gstRows = t.taxPaise > 0
    ? (t.interState
        ? sumRow(`IGST @ ${inv.gstPercent}%`, t.igstPaise)
        : sumRow(`CGST @ ${inv.gstPercent / 2}%`, t.cgstPaise) + sumRow(`SGST @ ${inv.gstPercent / 2}%`, t.sgstPaise))
    : ''
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} ${e(inv.orderNo)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:${COLORS.cream};color:${COLORS.ink};font:14px/1.5 Helvetica,Arial,sans-serif}
.sheet{max-width:780px;margin:24px auto;background:#fff;border:1px solid ${COLORS.line};padding:36px}
h1{font:normal 30px Georgia,'Times New Roman',serif;margin:0;color:${COLORS.leaf}}h2{font:bold 11px Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${COLORS.muted};margin:0 0 6px}
.top{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;border-bottom:3px solid ${COLORS.marigold};padding-bottom:18px}
.cols{display:flex;gap:32px;flex-wrap:wrap;margin:22px 0}.cols>div{flex:1 1 220px}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.muted};border-bottom:1px solid ${COLORS.ink};padding:8px 6px}
td{padding:9px 6px;border-bottom:1px solid ${COLORS.line};vertical-align:top}.r{text-align:right;white-space:nowrap}th.r{text-align:right}.n{width:32px;color:${COLORS.muted}}.m{color:${COLORS.muted}}
.sum{width:320px;margin:18px 0 0 auto}.sum td{border:0;padding:4px 6px}.sum .tot td{border-top:2px solid ${COLORS.ink};font-weight:bold;font-size:16px;padding-top:8px}
.note{margin-top:26px;font-size:12px;color:${COLORS.muted}}.btn{margin:0 0 16px;padding:10px 18px;background:${COLORS.marigold};border:0;border-radius:6px;font:bold 14px Helvetica,Arial,sans-serif;color:${COLORS.ink};cursor:pointer}
@media print{body{background:#fff}.sheet{border:0;margin:0;padding:0;max-width:none}.btn{display:none}}
@media(max-width:560px){.sheet{padding:18px;margin:0}}
</style></head><body><div class="sheet">
<button class="btn" onclick="window.print()">Print or save as PDF</button>
<div class="top"><div><h1>${e(inv.seller.name)}</h1>${inv.seller.address ? `<div>${e(inv.seller.address)}</div>` : ''}${hasGstin ? `<div>GSTIN: ${e(inv.seller.gstin)}</div>` : ''}${inv.seller.phone ? `<div>${e(inv.seller.phone)}</div>` : ''}</div>
<div style="text-align:right"><h2>${e(title)}</h2><div><strong>${e(inv.orderNo)}</strong></div><div>Date: ${e(istDateLabel(inv.createdAt))}</div>${inv.deliveryDate ? `<div>Delivery: ${e(inv.deliveryDate)}</div>` : ''}${inv.paymentStatus ? `<div>Payment: ${e(inv.paymentStatus)}</div>` : ''}</div></div>
<div class="cols"><div><h2>Billed and delivered to</h2>${addrLines.join('<br>')}${inv.customerEmail ? `<br>${e(inv.customerEmail)}` : ''}</div>
<div><h2>Place of supply</h2>${e(a.city ?? '')}${a.state ? ', ' + e(a.state) : ''}</div></div>
<table><thead><tr><th class="n">#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="m">No line items</td></tr>'}</tbody></table>
<table class="sum"><tbody>
${sumRow('Subtotal', inv.subtotalPaise)}${inv.discountPaise > 0 ? sumRow(`Discount${inv.couponCode ? ' (' + e(inv.couponCode) + ')' : ''}`, -inv.discountPaise) : ''}${sumRow('Delivery fee', inv.deliveryFeePaise)}
${t.taxPaise > 0 ? sumRow('Taxable value', t.taxablePaise) + gstRows : ''}
${sumRow('Total', inv.totalPaise, true)}
</tbody></table>
<p class="note">${t.taxPaise > 0 ? (t.derived ? `Prices include GST at ${inv.gstPercent}%. ` : '') : ''}${inv.totalPaise === 0 && inv.kind === 'subscription_delivery' ? 'This delivery is part of a prepaid subscription plan and is not charged separately. ' : ''}${hasGstin ? '' : 'The seller is not registered for GST; no tax invoice is issued. '}This is a computer generated document and needs no signature.</p>
</div></body></html>`
  return { html, totals: t, title }
}
