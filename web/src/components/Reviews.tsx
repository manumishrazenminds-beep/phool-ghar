import { Star } from '@phosphor-icons/react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { backendConfigured } from '../lib/env'
import { supabase } from '../lib/supabase'
import { Alert, Button, TextArea } from '../lib/ui'

interface Review { id: string; rating: number; body: string | null; created_at: string; reviewer: string }

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} weight={i <= Math.round(value) ? 'fill' : 'regular'} className={i <= Math.round(value) ? 'text-saffron' : 'text-ink/25'} />)}
    </span>
  )
}

export function Reviews({ slug, productName }: { slug: string; productName: string }) {
  const { user } = useAuth()
  const [productId, setProductId] = useState<string | null>(null)
  const [list, setList] = useState<Review[] | null>(null)
  const [eligibleOrder, setEligibleOrder] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!backendConfigured) { setList([]); return }
    const { data: p } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle()
    if (!p) { setList([]); return }
    setProductId(p.id as string)
    const { data } = await supabase.from('public_reviews').select('id, rating, body, created_at, reviewer').eq('product_id', p.id).order('created_at', { ascending: false }).limit(30)
    setList((data ?? []) as Review[])
  }, [slug])
  useEffect(() => { void load() }, [load])

  // a customer may review a product from a delivered order they have not reviewed yet
  useEffect(() => {
    if (!user || !productId) { setEligibleOrder(null); return }
    let live = true
    ;(async () => {
      const [items, mine] = await Promise.all([
        supabase.from('order_items').select('order_id, orders!inner(status, user_id)').eq('product_id', productId).eq('orders.status', 'delivered').limit(20),
        supabase.from('reviews').select('order_id').eq('product_id', productId).eq('user_id', user.id),
      ])
      if (!live) return
      const done = new Set(((mine.data ?? []) as { order_id: string }[]).map((r) => r.order_id))
      const pick = ((items.data ?? []) as unknown as { order_id: string }[]).find((i) => !done.has(i.order_id))
      setEligibleOrder(pick?.order_id ?? null)
    })().catch(() => setEligibleOrder(null))
    return () => { live = false }
  }, [user, productId])

  async function submit() {
    if (!user || !productId || !eligibleOrder) return
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('reviews').insert({ product_id: productId, user_id: user.id, order_id: eligibleOrder, rating, body: body.trim() || null })
    setBusy(false)
    if (error) { setMsg({ tone: 'error', text: 'We could not save your review. Please try again.' }); return }
    setMsg({ tone: 'ok', text: 'Thank you. Your review will appear once our team has checked it.' })
    setBody(''); setEligibleOrder(null)
  }

  if (!backendConfigured && !list?.length) return null
  const avg = list && list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0

  return (
    <section className="mt-28" aria-labelledby="reviews-h">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="reviews-h" className="font-display text-4xl">What customers say</h2>
        {list && list.length > 0 && <p className="flex items-center gap-2 text-sm text-ink-soft"><Stars value={avg} /> {avg.toFixed(1)} from {list.length} review{list.length === 1 ? '' : 's'}</p>}
      </div>

      {list === null ? <p className="mt-8 text-ink-soft">Loading reviews</p> : list.length === 0 ? (
        <p className="mt-8 text-ink-soft">No reviews for {productName} yet. Reviews come from customers who have received it.</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className="rounded-3xl border border-ink/10 bg-white p-6">
              <Stars value={r.rating} />
              {r.body && <p className="mt-3 text-ink">{r.body}</p>}
              <p className="mt-3 text-xs text-ink-soft">{r.reviewer}, {new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
            </li>
          ))}
        </ul>
      )}

      {eligibleOrder ? (
        <div className="mt-8 max-w-xl rounded-3xl bg-cream-2 p-6">
          <p className="font-medium">You received this. How was it?</p>
          <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => setRating(i)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-ink/5">
                <Star size={26} weight={i <= rating ? 'fill' : 'regular'} className={i <= rating ? 'text-saffron' : 'text-ink/30'} />
              </button>
            ))}
          </div>
          <div className="mt-3"><TextArea label="Tell us more (optional)" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} /></div>
          <Button className="mt-4" loading={busy} onClick={() => void submit()}>Submit review</Button>
        </div>
      ) : !user && backendConfigured ? (
        <p className="mt-8 text-sm text-ink-soft"><Link to="/login" className="underline">Sign in</Link> to review something you have received.</p>
      ) : null}
      {msg && <div className="mt-4 max-w-xl"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
    </section>
  )
}
