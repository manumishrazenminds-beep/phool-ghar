import { Link, useParams } from 'react-router-dom'
import { useSeo } from '../lib/seo'
import { PageShell } from '../lib/ui'

/* Working drafts based on how the shop behaves today. Have them reviewed before launch. */
const POLICIES: Record<string, { title: string; intro: string; sections: [string, string[]][] }> = {
  privacy: {
    title: 'Privacy',
    intro: 'What we collect, why, and how you stay in control.',
    sections: [
      ['What we collect', ['Your name, phone number, email and delivery addresses, and the orders and plans you place.', 'Payments are handled by Razorpay. We never see or store your card or UPI details.']],
      ['How we use it', ['To deliver your flowers, send order and delivery updates by email, WhatsApp or in the app, and to answer support requests.', 'We do not sell your data.']],
      ['Your choices', ['You can turn notification channels on or off in your profile and edit or delete saved addresses at any time.', 'To delete your account and data, contact us and we will do it within a reasonable time, keeping only records the law requires, such as invoices.']],
    ],
  },
  refunds: {
    title: 'Refunds and cancellations',
    intro: 'When you can cancel and how refunds reach you.',
    sections: [
      ['One-time orders', ['You can cancel until we start preparing the order. Paid orders are refunded to the original payment method.', 'If flowers arrive in poor condition, message us on WhatsApp the same morning with a photo and we will replace or refund them.']],
      ['Daily plans', ['Skips and pauses made before 9 PM the evening before move your plan end date out, so no delivery is lost.', 'If you cancel a plan, refunds for unused days follow this policy and go to the original payment method.']],
      ['How long refunds take', ['Refunds are started right away. Banks usually take 5 to 7 working days to show them.']],
    ],
  },
  shipping: {
    title: 'Shipping and delivery',
    intro: 'Where, when and how we deliver.',
    sections: [
      ['Where we deliver', ['Check your pincode on the home page or at checkout. Delivery fees, if any, are shown before you pay. Daily plans have free delivery.']],
      ['When', ['Daily plans arrive between 5 and 8 AM. One-time orders can pick an early, morning or evening slot, subject to availability.', 'Orders for the next morning close at 9 PM.']],
      ['If we cannot deliver', ['If nobody is available at the address, the order is marked not delivered. You can ask for another attempt from the order page.']],
    ],
  },
  terms: {
    title: 'Terms of use',
    intro: 'The simple rules for using the shop.',
    sections: [
      ['Orders', ['An order is confirmed once payment succeeds. Prices are in rupees and include GST where it applies.', 'Flowers are natural products, so colour and size can vary slightly between batches.']],
      ['Your account', ['Keep your login details safe and give accurate delivery details. You are responsible for activity on your account.']],
      ['Changes', ['We may update these terms and the shop from time to time. Continued use means you accept the updated terms.']],
    ],
  },
}

export default function Policy() {
  const { slug = '' } = useParams()
  const p = POLICIES[slug]
  useSeo({ title: p ? p.title : 'Page not found', path: `/policy/${slug}`, description: p?.intro })
  if (!p) {
    return (
      <PageShell title="Page not found"><Link to="/help" className="underline">Go to the help centre</Link></PageShell>
    )
  }
  return (
    <PageShell narrow eyebrow="Policies" title={p.title} intro={p.intro}>
      <div className="space-y-8">
        {p.sections.map(([h, paras]) => (
          <section key={h}>
            <h2 className="font-display text-2xl">{h}</h2>
            {paras.map((t) => <p key={t} className="mt-3 text-ink-soft">{t}</p>)}
          </section>
        ))}
      </div>
      <p className="mt-12 text-sm text-ink-soft">Questions? Visit the <Link to="/help" className="underline">help centre</Link>.</p>
    </PageShell>
  )
}
