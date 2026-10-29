import { CaretDown, ChatCircleText, Envelope, MagnifyingGlass, WhatsappLogo } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { env } from '../lib/env'
import { useSeo } from '../lib/seo'
import { PageShell } from '../lib/ui'

const TOPICS: { id: string; label: string; items: [string, string][] }[] = [
  { id: 'orders', label: 'Orders and delivery', items: [
    ['What time will my flowers arrive?', 'Daily plans are delivered between 5 and 8 AM. One-time orders can choose an early, morning or evening slot at checkout.'],
    ['Which areas do you deliver to?', 'Enter your pincode on the home page or at checkout and we will tell you straight away whether we deliver there and what it costs.'],
    ['Until when can I change or cancel an order?', 'Until we start preparing it. Changes for the next morning close at 9 PM the evening before.'],
    ['Nobody was home. What happens?', 'The order shows as not delivered. Open it from your account and choose "Try delivering again" to pick a new date and slot.'],
  ] },
  { id: 'plans', label: 'Daily plans', items: [
    ['How does a daily plan work?', 'Pick a flower, a plan length and the days you want. You pay once for the whole period and we deliver fresh flowers on each chosen day.'],
    ['Can I skip a day or pause?', 'Yes. Skip a single day or pause for a stretch from Account, Daily plans, before 9 PM the evening before. Skipped and paused days move your plan end date out, so you never lose a delivery.'],
    ['Can I change my days, slot or address?', 'Yes. Use "Change days, slot or address" on your plan. It applies from the next delivery that is still open for changes.'],
    ['How do I renew?', 'A Renew button appears in the last week of your plan and after it ends. It keeps the same flowers, days and slot and takes you to checkout.'],
    ['Can I cancel?', 'Yes, from your plan. Deliveries stop and any refund for unused days follows our refund policy.'],
  ] },
  { id: 'payments', label: 'Payments and refunds', items: [
    ['How can I pay?', 'UPI, cards and net banking through Razorpay. We never see or store your card details.'],
    ['My payment failed but money was deducted.', 'This is usually reversed by your bank within a few days. If the order shows as paid in your account you do not need to do anything. Otherwise write to us with the order number.'],
    ['How do refunds work?', 'Refunds go back to the original payment method. Cancelled paid orders are refunded automatically.'],
    ['Do you give GST invoices?', 'Yes. Open a paid order and choose Invoice.'],
  ] },
  { id: 'quality', label: 'Freshness and care', items: [
    ['What if my flowers arrive wilted?', 'Message us on WhatsApp the same morning with a photo and we will send a replacement or refund.'],
    ['How do I keep flowers fresh?', 'Every product page lists care tips. In general: keep them cool, out of direct sun, and trim stems of cut flowers every second day.'],
  ] },
  { id: 'business', label: 'Business and bulk', items: [
    ['Do you supply temples, shops and events?', 'Yes. Use the business section on the home page or message us on WhatsApp for recurring bulk supply and a quote.'],
  ] },
]

export default function Help() {
  useSeo({
    title: 'Help centre',
    path: '/help',
    description: 'Answers about delivery times, daily flower subscriptions, payments, refunds and flower care.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: TOPICS.flatMap((g) => g.items).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  })
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState('all')
  const [open, setOpen] = useState<string | null>(null)
  const wa = env.whatsappNumber ? `https://wa.me/${env.whatsappNumber.replace(/\D/g, '')}` : null

  const groups = useMemo(() => {
    const t = q.trim().toLowerCase()
    return TOPICS
      .filter((g) => topic === 'all' || g.id === topic)
      .map((g) => ({ ...g, items: g.items.filter(([a, b]) => !t || a.toLowerCase().includes(t) || b.toLowerCase().includes(t)) }))
      .filter((g) => g.items.length)
  }, [q, topic])

  const chip = (on: boolean) => `min-h-11 whitespace-nowrap rounded-full border px-5 text-sm font-medium transition ${on ? 'border-ink bg-ink text-cream' : 'border-ink/15 hover:border-ink/40'}`

  return (
    <PageShell eyebrow="Help centre" title={<>How can we <em>help</em>?</>} intro="Quick answers about orders, daily plans and payments. Still stuck? We reply the same day.">
      <label className="flex max-w-xl items-center gap-3 rounded-full border border-ink/15 bg-white px-5 focus-within:border-marigold">
        <MagnifyingGlass size={18} className="text-ink-soft" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search answers" aria-label="Search help" className="w-full bg-transparent py-3.5 outline-none" />
      </label>
      <div className="no-scrollbar -mx-6 mt-5 flex gap-2 overflow-x-auto px-6">
        <button className={chip(topic === 'all')} onClick={() => setTopic('all')}>All</button>
        {TOPICS.map((g) => <button key={g.id} className={chip(topic === g.id)} onClick={() => setTopic(g.id)}>{g.label}</button>)}
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-10">
          {groups.length === 0 && <p className="text-ink-soft">No answers match that. Try fewer words, or contact us below.</p>}
          {groups.map((g) => (
            <section key={g.id}>
              <h2 className="font-display text-3xl">{g.label}</h2>
              <div className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
                {g.items.map(([a, b]) => {
                  const key = g.id + a
                  const on = open === key
                  return (
                    <div key={key}>
                      <button onClick={() => setOpen(on ? null : key)} aria-expanded={on} className="flex min-h-14 w-full items-center justify-between gap-4 py-4 text-left text-lg font-medium">
                        {a}
                        <motion.span animate={{ rotate: on ? 180 : 0 }} className="shrink-0"><CaretDown size={18} /></motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {on && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-5 text-ink-soft">{b}</motion.p>}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="h-fit rounded-3xl bg-cream-2 p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-2xl">Talk to us</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {wa && <li><a href={wa} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-3 rounded-2xl bg-white px-4 font-medium hover:bg-leaf-soft"><WhatsappLogo size={20} className="text-leaf" /> Chat on WhatsApp</a></li>}
            <li><Link to="/account/support" className="flex min-h-11 items-center gap-3 rounded-2xl bg-white px-4 font-medium hover:bg-leaf-soft"><ChatCircleText size={20} className="text-leaf" /> Raise a support ticket</Link></li>
            <li><a href="mailto:hello@phoolghar.example" className="flex min-h-11 items-center gap-3 rounded-2xl bg-white px-4 font-medium hover:bg-leaf-soft"><Envelope size={20} className="text-leaf" /> Email us</a></li>
          </ul>
          <p className="mt-5 text-xs text-ink-soft">Include your order number and we can help faster.</p>
        </aside>
      </div>
    </PageShell>
  )
}
