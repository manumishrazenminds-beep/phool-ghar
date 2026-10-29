import { env } from './env'
import type { PaymentSession, VerifyBody } from './api'

const SRC = 'https://checkout.razorpay.com/v1/checkout.js'

interface RzpInstance { open: () => void; on: (ev: string, cb: (r: { error?: { code?: string; description?: string; reason?: string } }) => void) => void }
type RzpCtor = new (opts: Record<string, unknown>) => RzpInstance
declare global { interface Window { Razorpay?: RzpCtor } }

let loading: Promise<void> | null = null
export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { loading = null; s.remove(); reject(new Error('Could not load the payment window. Check your connection and try again.')) }
    document.head.appendChild(s)
  })
  return loading
}

export type PayOutcome =
  | { status: 'paid'; response: VerifyBody }
  | { status: 'dismissed' }
  | { status: 'failed'; code: string; description: string }

/** Opens Razorpay Checkout for a server-created order. Resolves exactly once. */
export async function openRazorpay(s: PaymentSession, theme = '#e8731a'): Promise<PayOutcome> {
  await loadRazorpay()
  if (!window.Razorpay) throw new Error('Payment window unavailable.')
  return new Promise<PayOutcome>((resolve) => {
    let done = false
    let lastFail: { code: string; description: string } | null = null
    const finish = (o: PayOutcome) => { if (!done) { done = true; resolve(o) } }
    const rzp = new window.Razorpay!({
      key: s.key_id || env.razorpayKeyId,
      order_id: s.razorpay_order_id,
      amount: s.amount_paise,
      currency: s.currency || 'INR',
      name: s.name || 'Phool Ghar',
      description: 'Fresh flowers, delivered',
      prefill: s.prefill,
      theme: { color: theme },
      retry: { enabled: true, max_count: 3 },
      handler: (r: VerifyBody) => finish({ status: 'paid', response: r }),
      modal: { ondismiss: () => finish(lastFail ? { status: 'failed', ...lastFail } : { status: 'dismissed' }), confirm_close: true },
    })
    // Razorpay lets the customer retry inside the popup, so a failure is only reported if they then close it.
    rzp.on('payment.failed', (r) => { lastFail = { code: r.error?.code ?? 'payment_failed', description: r.error?.description ?? 'The payment did not go through.' } })
    rzp.open()
  })
}
