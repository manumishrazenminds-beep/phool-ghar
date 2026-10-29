import { paiseEqual } from './money.ts'
import type { Db } from './supabase.ts'

export interface PaymentRow {
  id: string
  user_id: string
  order_id: string | null
  subscription_id: string | null
  provider_order_id: string
  provider_payment_id: string | null
  amount_paise: number
  currency: string
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded'
}

export const PAYMENT_COLUMNS = 'id, user_id, order_id, subscription_id, provider_order_id, provider_payment_id, amount_paise, currency, status'

/** The provider's amount and currency must equal what our payment row says we charged. */
export function amountMatches(row: Pick<PaymentRow, 'amount_paise' | 'currency'>, providerAmount: unknown, providerCurrency: unknown): boolean {
  return paiseEqual(row.amount_paise, providerAmount) && String(providerCurrency ?? '').toUpperCase() === String(row.currency || 'INR').toUpperCase()
}

/** Keep only non-sensitive, useful fields of a Razorpay payment entity for storage and logs. */
export function sanitizePayment(p: any): Record<string, unknown> {
  if (!p || typeof p !== 'object') return {}
  return {
    id: p.id, order_id: p.order_id, amount: p.amount, currency: p.currency, status: p.status,
    method: p.method, captured: p.captured, error_code: p.error_code ?? null, error_description: p.error_description ?? null,
    created_at: p.created_at,
  }
}

export function sanitizeRefund(r: any): Record<string, unknown> {
  if (!r || typeof r !== 'object') return {}
  return { id: r.id, payment_id: r.payment_id, amount: r.amount, currency: r.currency, status: r.status, created_at: r.created_at }
}

export async function loadPaymentByOrder(db: Db, providerOrderId: string): Promise<PaymentRow | null> {
  const { data, error } = await db.from('payments').select(PAYMENT_COLUMNS).eq('provider_order_id', providerOrderId).maybeSingle()
  if (error) throw new Error(`payments lookup failed: ${error.message}`)
  return data ?? null
}

/** Idempotent in SQL: safe from both payment-verify and the webhook, in either order. */
export async function markCaptured(db: Db, providerOrderId: string, providerPaymentId: string, method: string | null, raw: Record<string, unknown>) {
  const { data, error } = await db.rpc('mark_payment_captured', {
    p_provider_order_id: providerOrderId,
    p_provider_payment_id: providerPaymentId,
    p_method: method,
    p_raw: raw,
  })
  if (error) throw new Error(`mark_payment_captured failed: ${error.message}`)
  return data
}
