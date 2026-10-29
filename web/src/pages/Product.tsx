import { ArrowLeft, Drop, Leaf, Repeat, ShoppingBag, Truck } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Reveal } from '../components/Motion'
import { HeartButton } from '../components/HeartButton'
import { Reviews } from '../components/Reviews'
import { AddOns } from '../components/AddOns'
import { ProductCard } from '../components/ProductCard'
import { PLAN_PERIODS, SHOP_PRODUCTS, SLOTS, VARIANTS, WEEKDAYS, findProduct, inr } from '../data/products'
import { useCart } from '../lib/cart'
import { abs, breadcrumbLd, SITE_NAME, useSeo } from '../lib/seo'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const tomorrow = () => iso(new Date(Date.now() + 86400000))

export default function Product() {
  const { slug = '' } = useParams()
  const product = findProduct(slug)
  const { add } = useCart()
  const [img, setImg] = useState(0)
  const [variant, setVariant] = useState('regular')
  const [mode, setMode] = useState<'once' | 'sub'>('once')
  const [date, setDate] = useState(tomorrow())
  const [slot, setSlot] = useState('early')
  const [period, setPeriod] = useState(30)
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])

  useSeo(product ? {
    title: product.name,
    path: `/product/${product.slug}`,
    description: `${product.tagline}. ${product.description}`.slice(0, 200),
    image: product.image,
    type: 'product',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: product.gallery.map(abs),
        sku: product.slug,
        brand: { '@type': 'Brand', name: SITE_NAME },
        category: product.category,
        offers: { '@type': 'Offer', url: abs(`/product/${product.slug}`), priceCurrency: 'INR', price: String(product.price), availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition' },
      },
      breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: product.name, path: `/product/${product.slug}` }]),
    ],
  } : { title: 'Flower not found', path: '/shop' })

  if (!product) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-6 pt-32 text-center">
        <div><p className="font-display text-4xl">We could not find that flower</p><Link to="/shop" className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-cream">Back to shop</Link></div>
      </div>
    )
  }

  const v = VARIANTS.find((x) => x.id === variant)!
  const pl = PLAN_PERIODS.find((x) => x.days === period)!
  const onceTotal = product.price * v.multiplier
  const subTotal = (product.perDay ?? 0) * v.multiplier * period * (1 - pl.discount)
  const total = mode === 'once' ? onceTotal : subTotal
  const toggleDay = (i: number) => setDays((d) => (d.includes(i) ? (d.length > 1 ? d.filter((x) => x !== i) : d) : [...d, i].sort()))
  const slots = mode === 'sub' ? SLOTS.filter((s) => s.id !== 'evening') : SLOTS

  const submit = () => {
    add({ productId: product.id, variantId: variant, mode, qty: 1, date, slot: mode === 'sub' && slot === 'evening' ? 'early' : slot, period: mode === 'sub' ? period : undefined, days: mode === 'sub' ? days : undefined })
  }

  const related = SHOP_PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)

  return (
    <div className="mx-auto max-w-7xl px-6 pb-28 pt-28">
      <Link to="/shop" className="mb-6 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink"><ArrowLeft size={16} /> All flowers</Link>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <motion.div key={img} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }} className="relative aspect-[4/5] overflow-hidden rounded-[36px] bg-cream-2">
            <img src={product.gallery[img]} alt={product.name} className="h-full w-full object-cover" />
            <HeartButton slug={product.slug} name={product.name} className="absolute right-4 top-4" />
          </motion.div>
          {product.gallery.length > 1 && (
            <div className="mt-4 flex gap-3">
              {product.gallery.map((g, i) => (
                <button key={g} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`} className={`h-20 w-20 overflow-hidden rounded-2xl border-2 transition ${i === img ? 'border-marigold' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                  <img src={g} alt={`${product.name}, view ${i + 1}`} width={80} height={80} loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {product.tag && <span className="rounded-full bg-saffron/30 px-3 py-1 text-xs font-semibold text-marigold-deep">{product.tag}</span>}
          <h1 className="font-display mt-3 text-4xl leading-none sm:text-6xl">{product.name}</h1>
          <p className="mt-3 text-lg text-ink-soft">{product.description}</p>

          {product.perDay && (
            <div className="mt-8 grid grid-cols-2 rounded-full bg-cream-2 p-1.5">
              {([['once', 'Buy once'], ['sub', 'Subscribe & save']] as const).map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)} className="relative rounded-full px-4 py-3 text-sm font-medium">
                  {mode === m && <motion.span layoutId="mode" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', damping: 28, stiffness: 320 }} />}
                  <span className={`relative flex items-center justify-center gap-2 ${mode === m ? 'text-cream' : ''}`}>{m === 'sub' && <Repeat size={15} />}{label}</span>
                </button>
              ))}
            </div>
          )}

          <fieldset className="mt-8">
            <legend className="mb-3 text-sm font-semibold">Size</legend>
            <div className="grid grid-cols-3 gap-3">
              {VARIANTS.map((x) => (
                <button key={x.id} onClick={() => setVariant(x.id)} className={`rounded-2xl border p-4 text-left transition ${variant === x.id ? 'border-marigold bg-marigold/5 ring-1 ring-marigold' : 'border-ink/15 hover:border-ink/40'}`}>
                  <p className="font-medium">{x.label}</p><p className="text-xs text-ink-soft">{x.note}</p>
                </button>
              ))}
            </div>
          </fieldset>

          {mode === 'sub' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
              <fieldset className="mt-8">
                <legend className="mb-3 text-sm font-semibold">Plan length</legend>
                <div className="grid grid-cols-3 gap-3">
                  {PLAN_PERIODS.map((x) => (
                    <button key={x.days} onClick={() => setPeriod(x.days)} className={`rounded-2xl border p-4 text-left transition ${period === x.days ? 'border-marigold bg-marigold/5 ring-1 ring-marigold' : 'border-ink/15 hover:border-ink/40'}`}>
                      <p className="font-medium">{x.days} days</p><p className="text-xs text-ink-soft">{x.blurb}</p>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="mt-8">
                <legend className="mb-3 text-sm font-semibold">Delivery days</legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d, i) => (
                    <button key={d} onClick={() => toggleDay(i)} aria-pressed={days.includes(i)} className={`h-12 w-14 rounded-2xl border text-sm font-medium transition ${days.includes(i) ? 'border-leaf bg-leaf text-cream' : 'border-ink/15 hover:border-ink/40'}`}>{d}</button>
                  ))}
                </div>
              </fieldset>
            </motion.div>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-3 block text-sm font-semibold">{mode === 'sub' ? 'Start date' : 'Delivery date'}</span>
              <input type="date" min={tomorrow()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3.5 outline-none focus:border-marigold" />
            </label>
            <label className="block">
              <span className="mb-3 block text-sm font-semibold">Time slot</span>
              <select value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3.5 outline-none focus:border-marigold">
                {slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-8"><AddOns date={date} slot={slot} /></div>

          <div className="mt-8 rounded-3xl bg-cream-2 p-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-ink-soft">{mode === 'sub' ? `${period}-day plan, paid upfront` : 'One-time price'}</p>
                <p className="font-display text-4xl">{inr(total)}</p>
                {mode === 'sub' && <p className="text-sm text-leaf">{inr(total / period)} per day{pl.discount ? `, you save ${pl.discount * 100}%` : ''}</p>}
              </div>
            </div>
            <button onClick={submit} className="group mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-marigold px-6 py-4 text-lg font-medium text-white transition hover:bg-marigold-deep active:scale-[0.99]">
              <ShoppingBag size={20} weight="fill" /> {mode === 'sub' ? 'Start subscription' : 'Add to basket'}
            </button>
          </div>

          <ul className="mt-6 space-y-3 text-sm text-ink-soft">
            <li className="flex gap-3"><Truck size={20} className="shrink-0 text-leaf" /> Delivered at your chosen slot. Free for subscriptions.</li>
            <li className="flex gap-3"><Drop size={20} className="shrink-0 text-leaf" /> {product.care}</li>
            <li className="flex gap-3"><Leaf size={20} className="shrink-0 text-leaf" /> Fresh or replaced: tell us on WhatsApp the same morning.</li>
          </ul>
        </div>
      </div>

      <Reviews key={product.slug} slug={product.slug} productName={product.name} />

      {related.length > 0 && (
        <section className="mt-28">
          <Reveal><h2 className="font-display mb-10 text-4xl">You may also love</h2></Reveal>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}
    </div>
  )
}
