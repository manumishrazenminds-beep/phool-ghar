import { useCallback, useRef, useState } from 'react'
import { ApiError, checkoutCreate, friendlyError, paymentVerify, type CheckoutBody, type CheckoutResult, type VerifyBody } from '../lib/api'
import { openRazorpay } from '../lib/razorpay'

export type PayPhase = 'idle' | 'creating' | 'paying' | 'verifying'
export interface PayNotice { tone: 'error' | 'warn' | 'info'; title: string; body: string; action?: 'retry' | 'verify' }
export interface PaidRef { order_id?: string; subscription_id?: string }

const IDEM = 'phoolghar.idem.v1'
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

/** Same payload => same idempotency key (survives refresh), so a retry can never create a second order. */
function keyFor(sig: string): string {
  try {
    const raw = sessionStorage.getItem(IDEM)
    if (raw) { const j = JSON.parse(raw) as { sig: string; key: string }; if (j.sig === sig) return j.key }
    const key = newKey()
    sessionStorage.setItem(IDEM, JSON.stringify({ sig, key }))
    return key
  } catch { return newKey() }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function usePayment(onPaid: (r: PaidRef) => void) {
  const [phase, setPhase] = useState<PayPhase>('idle')
  const [notice, setNotice] = useState<PayNotice | null>(null)
  const lock = useRef(false)
  const created = useRef<{ sig: string; res: CheckoutResult } | null>(null)
  const pendingVerify = useRef<{ body: VerifyBody; ref: PaidRef } | null>(null)
  const lastBody = useRef<Omit<CheckoutBody, 'idempotency_key'> | null>(null)

  const verify = useCallback(async (body: VerifyBody, ref: PaidRef) => {
    setPhase('verifying')
    pendingVerify.current = { body, ref }
    let lastErr: unknown
    for (let i = 0; i < 4; i++) {
      try {
        const r = await paymentVerify(body)
        if (r?.status === 'processing') {
          // Authorised but not captured yet: keep the cart and let the customer re-check; the webhook finishes the job.
          setPhase('idle')
          setNotice({ tone: 'info', action: 'verify', title: 'Your payment is being confirmed', body: 'The bank has not confirmed it yet. Do not pay again. Tap below to check, or wait: your order updates automatically once it clears.' })
          return
        }
        pendingVerify.current = null
        created.current = null
        try { sessionStorage.removeItem(IDEM) } catch { /* ignore */ }
        onPaid({ order_id: r?.order_id ?? ref.order_id, subscription_id: r?.subscription_id ?? ref.subscription_id })
        return
      } catch (e) {
        lastErr = e
        if (!(e instanceof ApiError && e.network)) break
        await sleep(1000 * (i + 1))
      }
    }
    setPhase('idle')
    const net = lastErr instanceof ApiError && lastErr.network
    setNotice({
      tone: 'warn', action: 'verify',
      title: 'We are confirming your payment',
      body: net ? 'Your payment went through but we lost connection while confirming it. Do not pay again. Tap below to check, or wait: we also confirm automatically in the background.' : `${friendlyError(lastErr)} If money was deducted, it is safe and will be matched to your order automatically.`,
    })
  }, [onPaid])

  const run = useCallback(async (body: Omit<CheckoutBody, 'idempotency_key'>) => {
    if (lock.current) return
    lock.current = true
    lastBody.current = body
    setNotice(null)
    try {
      const sig = JSON.stringify(body)
      let res = created.current?.sig === sig ? created.current.res : null
      if (!res) {
        setPhase('creating')
        res = await checkoutCreate({ ...body, idempotency_key: keyFor(sig) })
        created.current = { sig, res }
      }
      const ref: PaidRef = { order_id: res.order_id, subscription_id: res.subscription_id }
      setPhase('paying')
      const out = await openRazorpay(res.payment)
      if (out.status === 'paid') { await verify(out.response, ref); return }
      setPhase('idle')
      if (out.status === 'dismissed') setNotice({ tone: 'info', action: 'retry', title: 'Payment window closed', body: 'No money was taken. Your order is held for a short while: you can pay now whenever you are ready.' })
      else setNotice({ tone: 'error', action: 'retry', title: 'Payment did not go through', body: `${out.description} Nothing was charged for a failed attempt. You can try again or use another method.` })
    } catch (e) {
      setPhase('idle')
      if (e instanceof ApiError && e.network) setNotice({ tone: 'warn', action: 'retry', title: 'Connection problem', body: 'We could not reach the server. Nothing was charged. Retrying is safe: it will not create a duplicate order.' })
      else setNotice({ tone: 'error', action: 'retry', title: 'We could not start the payment', body: friendlyError(e) })
    } finally {
      lock.current = false
    }
  }, [verify])

  const retryVerify = useCallback(async () => {
    if (lock.current || !pendingVerify.current) return
    lock.current = true
    setNotice(null)
    try { await verify(pendingVerify.current.body, pendingVerify.current.ref) } finally { lock.current = false }
  }, [verify])

  return { phase, notice, run, retryVerify, busy: phase !== 'idle', lastBody }
}
