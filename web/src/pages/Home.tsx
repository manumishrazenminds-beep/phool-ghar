import { useSeo } from '../lib/seo'
import { ArrowRight, Buildings, CaretDown, ChatCircleDots, HandHeart, Leaf, MapPin, Moon, PauseCircle, ShieldCheck, Sun, Van } from '@phosphor-icons/react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DeliveryMap } from '../components/DeliveryMap'
import { Doodle } from '../components/Doodle'
import { FlipCard } from '../components/FlipCard'
import { ParallaxImage, Reveal, SplitWords } from '../components/Motion'
import { Petals } from '../components/Petals'
import { ProductCard } from '../components/ProductCard'
import { SplineHero } from '../components/SplineHero'
import { Story } from '../story/Story'
import { CATEGORIES, PLAN_PERIODS, SHOP_PRODUCTS, inr, type Product } from '../data/products'

const MARQUEE = ['Marigold', 'Mogra', 'Lotus', 'Garden Roses', 'Shevanti', 'Tulsi', 'Jasmine', 'Hibiscus']
const EYEBROW = 'font-mono text-[11px] font-medium uppercase tracking-[0.18em]'

/** Full-bleed photo background with a dull overlay. Children sit on top. */
function Backdrop({ src, tone = 'bg-ink/60', strength = 60 }: { src: string; tone?: string; strength?: number }) {
  return (
    <>
      <ParallaxImage src={src} alt="" className="absolute inset-0 -z-10" strength={strength} scale={1.25} />
      <div className={`absolute inset-0 -z-10 ${tone}`} />
    </>
  )
}

/* ---------------------------------------------------------------- hero */

function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 160])
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.25])
  const textY = useTransform(scrollYProgress, [0, 1], [0, 90])
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  return (
    <section ref={ref} className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden text-cream">
      {/* Background slot: swap this photo for video / Spline / anything else. */}
      <motion.div style={{ y: bgY, scale: bgScale }} className="absolute inset-0 -z-20">
        <img src="/img/hero-marigold.jpg" alt="" className="h-full w-full object-cover" fetchPriority="high" />
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/75 via-ink/55 to-ink/85" />
      <Petals />
      <SplineHero className="absolute inset-0 z-0" />

      <motion.div style={{ y: textY, opacity: fade }} className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-44 pt-32 text-center">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur ${EYEBROW} !tracking-[0.14em]`}>
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-saffron opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-saffron" /></span>
          Delivering today in Pune and Mumbai
        </motion.div>

        <h1 className="font-display mt-8 text-[clamp(3rem,8.4vw,7rem)] leading-[0.96] tracking-[-0.02em]">
          <SplitWords text="Fresh blooms at your door" delay={0.2} />
          <br />
          <em className="text-saffron"><SplitWords text="before sunrise." delay={0.55} /></em>
        </h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95, duration: 0.8 }} className="mt-7 max-w-[46ch] text-[17px] leading-[1.7] text-cream/85 sm:text-lg">
          Pooja flowers and hand-tied bouquets, picked the evening before and at your door between 5 and 8 AM. Buy once, or subscribe and skip any day with a tap.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.8 }} className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/shop" className="group inline-flex h-14 items-center gap-2 rounded-full bg-marigold px-8 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-marigold-deep">
            Shop flowers <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <Link to="/shop?type=sub" className="inline-flex h-14 items-center rounded-full border border-white/35 bg-white/10 px-8 text-[15px] font-medium backdrop-blur transition-colors duration-200 hover:bg-white hover:text-ink">
            Start a daily plan
          </Link>
        </motion.div>
      </motion.div>

      {/* readout strip, in the spirit of an editorial field-notes HUD */}
      <motion.dl initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.35, duration: 0.8 }} className="absolute inset-x-0 bottom-0 z-10 mx-auto grid max-w-5xl grid-cols-3 divide-x divide-white/20 border-t border-white/20 px-2 text-center">
        {[
          ['Delivery window', '5 to 8 AM'],
          ['Plans from', `${inr(54)} a day`],
          ['Your schedule', 'Skip anytime'],
        ].map(([k, v]) => (
          <div key={k} className="px-2 py-5 sm:py-6">
            <dt className={`${EYEBROW} !text-[11px] text-cream/60`}>{k}</dt>
            <dd className="font-display mt-1.5 text-xl text-cream sm:text-3xl">{v}</dd>
          </div>
        ))}
      </motion.dl>
    </section>
  )
}

function Marquee() {
  const row = [...MARQUEE, ...MARQUEE]
  return (
    <div className="marquee overflow-hidden bg-leaf py-4 text-cream">
      <div className="marquee-track flex w-max gap-10">
        {[...row, ...row].map((w, i) => (
          <span key={i} className="flex items-center gap-10 text-xl font-light italic">
            {w} <Leaf size={18} weight="fill" className="text-saffron" />
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- categories */

function Categories() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-28 pt-28 sm:pt-36">
      <Doodle kind="sprig" className="pointer-events-none absolute -left-6 top-0 hidden w-32 -rotate-12 sm:block" />
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <p className={`${EYEBROW} text-marigold`}>Shop by what you need</p>
        <h2 className="font-display mt-3 text-5xl sm:text-7xl">Pick your <em className="text-marigold">bloom</em></h2>
      </div>
      <div className="grid gap-12 md:grid-cols-3 md:gap-8">
        {CATEGORIES.map((c, i) => (
          <Reveal key={c.id} delay={i * 0.12} className={i === 1 ? 'md:mt-16' : i === 2 ? 'md:mt-32' : ''}>
            <Link to={`/shop?c=${c.id}`} className="group relative block">
              <div className="relative aspect-[3/4] overflow-hidden rounded-t-[999px] rounded-b-[28px] ring-1 ring-ink/10">
                <ParallaxImage src={c.image} alt={c.label} className="absolute inset-0" strength={26} scale={1.2} />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </div>
              <Doodle kind={(['marigold', 'rose', 'mogra'] as const)[i]} className="pointer-events-none absolute -right-5 -top-3 w-24 sm:w-28" delay={0.3 + i * 0.1} />
              <div className="mt-6 flex items-baseline justify-between gap-4 border-b border-ink/15 pb-4">
                <div>
                  <p className={`${EYEBROW} text-ink-soft`}>0{i + 1}</p>
                  <h3 className="font-display mt-1 text-4xl"><em>{c.label}</em></h3>
                </div>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ink/20 transition-colors duration-300 group-hover:border-marigold group-hover:bg-marigold group-hover:text-white"><ArrowRight size={18} /></span>
              </div>
              <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-ink-soft">{c.blurb}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ featured */

const TABS: { id: string; label: string; pick: (p: Product) => boolean; sort?: (a: Product, b: Product) => number }[] = [
  { id: 'best', label: 'Best sellers', pick: () => true },
  { id: 'new', label: 'New arrivals', pick: () => true, sort: (a, b) => SHOP_PRODUCTS.indexOf(b) - SHOP_PRODUCTS.indexOf(a) },
  { id: 'budget', label: 'Under ' + inr(150), pick: (p) => p.price <= 150 },
  { id: 'sub', label: 'Daily plans', pick: (p) => p.perDay !== null },
]

function Featured() {
  const [tab, setTab] = useState('best')
  const t = TABS.find((x) => x.id === tab)!
  const items = SHOP_PRODUCTS.filter(t.pick).sort(t.sort ?? (() => 0)).slice(0, 12)
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="mb-10 text-center">
        <p className={`${EYEBROW} text-marigold`}>This week's picks</p>
        <h2 className="font-display mt-3 text-4xl sm:text-6xl"><SplitWords text="Loved by early risers" /></h2>
      </div>
      <div className="no-scrollbar mx-auto mb-12 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-cream-2 p-1.5" role="tablist">
        {TABS.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className="relative whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium">
            {tab === x.id && <motion.span layoutId="featured-tab" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', damping: 28, stiffness: 320 }} />}
            <span className={`relative ${tab === x.id ? 'text-cream' : 'text-ink-soft'}`}>{x.label}</span>
          </button>
        ))}
      </div>
      <motion.div layout className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
        <AnimatePresence mode="popLayout">
          {items.map((p, i) => (
            <motion.div layout key={p.id} className="h-full" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.4 }}>
              <ProductCard product={p} index={i} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      <div className="mt-14 text-center">
        <Link to="/shop" className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-8 py-4 font-medium transition hover:bg-ink hover:text-cream">View all flowers <ArrowRight size={18} /></Link>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- plans */

const TEETH = 22
const TORN = `polygon(0 0, 100% 0, 100% calc(100% - 10px), ${Array.from({ length: TEETH }, (_, i) => {
  const x = 100 - ((i + 0.5) * 100) / TEETH
  const x2 = 100 - ((i + 1) * 100) / TEETH
  return `${x.toFixed(2)}% 100%, ${x2.toFixed(2)}% calc(100% - 10px)`
}).join(', ')}, 0 calc(100% - 10px))`

function Barcode({ seed }: { seed: number }) {
  const bars = Array.from({ length: 46 }, (_, i) => 1 + ((i * 7 + seed * 5) % 4))
  return (
    <svg viewBox="0 0 184 34" className="h-9 w-full" aria-hidden preserveAspectRatio="none">
      {(() => {
        let x = 0
        return bars.map((w, i) => {
          const el = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={34} fill="#2a211c" /> : null
          x += w
          return el
        })
      })()}
    </svg>
  )
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 ${strong ? 'text-ink' : 'text-ink/75'}`}>
      <span className="shrink-0">{k}</span>
      <span aria-hidden className="mb-1 min-w-4 flex-1 border-b border-dotted border-ink/40" />
      <span className="shrink-0 tabular-nums">{v}</span>
    </div>
  )
}

function Receipt({ days, discount, label, index, featured }: { days: number; discount: number; label: string; index: number; featured: boolean }) {
  const rate = 60
  const subtotal = rate * days
  const off = Math.round(subtotal * discount)
  const total = subtotal - off
  const tilt = [-2.2, 0, 2][index] ?? 0
  return (
    // The in-view trigger sits on an unclipped wrapper: a fully clipped element has no visible
    // area, so an observer on the clipped element itself would never fire.
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} className="relative">
    <motion.article
      aria-label={`${label} plan receipt`}
      variants={{ hidden: { clipPath: 'inset(0 0 100% 0)', y: -12, opacity: 0.6 }, show: { clipPath: 'inset(0 0 0% 0)', y: 0, opacity: 1 } }}
      transition={{ duration: 1.1, delay: index * 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      <div style={{ transform: `rotate(${tilt}deg)` }} className="transition-transform duration-500 ease-[var(--ease-out-expo)] hover:!rotate-0 hover:-translate-y-2">
        <div style={{ clipPath: TORN }} className={`relative bg-[#fffdf7] px-6 pb-12 pt-7 font-mono text-[12.5px] leading-relaxed text-ink shadow-2xl ${featured ? 'md:scale-[1.04]' : ''}`}>
          <div className="text-center">
            <p className="font-display text-3xl leading-none">Phool <em className="text-marigold">Ghar</em></p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-ink/60">Daily flower plan</p>
          </div>
          <div className="my-4 border-t-2 border-dashed border-ink/30" />
          <div className="space-y-1.5">
            <Row k="Receipt" v={`#0${days}`} />
            <Row k="Plan" v={label} />
            <Row k="Delivery" v="5 to 8 AM" />
          </div>
          <div className="my-4 border-t-2 border-dashed border-ink/30" />
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-ink/55">Items</p>
          <div className="space-y-1.5">
            <Row k={`Pooja Mix x ${days} days`} v={inr(subtotal)} />
            <Row k={`Rate ${inr(rate)}/day`} v="" />
            <Row k={discount ? `Plan discount ${Math.round(discount * 100)}%` : 'Plan discount'} v={off ? `-${inr(off)}` : 'none'} />
            <Row k="Delivery" v="FREE" />
            <Row k="Skip or pause" v="anytime" />
          </div>
          <div className="my-4 border-t-2 border-dashed border-ink/30" />
          <div className="flex items-end justify-between">
            <span className="text-[11px] uppercase tracking-[0.2em]">Total</span>
            <span className="font-display text-5xl leading-none">{inr(total)}</span>
          </div>
          <p className="mt-1 text-right text-[11px] text-ink/60">{inr(total / days)} per day</p>
          <div className="my-5"><Barcode seed={days} /></div>
          <p className="text-center text-[11px] uppercase tracking-[0.2em] text-ink/55">Thank you. See you at sunrise.</p>
          <Link to="/shop?type=sub" className={`mt-5 flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-medium transition-colors duration-200 ${featured ? 'bg-marigold text-white hover:bg-marigold-deep' : 'bg-ink text-cream hover:bg-leaf'}`} style={{ fontFamily: 'var(--font-sans)' }}>Choose this plan <ArrowRight size={16} /></Link>
        </div>
        {featured && (
          <div aria-hidden className="absolute -right-4 -top-5 z-10 grid h-[88px] w-[88px] rotate-[14deg] place-items-center rounded-full border-[3px] border-double border-rose bg-[#fffdf7]/70 text-center text-rose shadow-sm">
            <span className="font-mono text-[11px] font-bold uppercase leading-tight tracking-[0.12em]">Best<br />value<br /><span className="text-[11px]">save {Math.round(discount * 100)}%</span></span>
          </div>
        )}
      </div>
    </motion.article>
    </motion.div>
  )
}

function Plans() {
  return (
    <section className="relative isolate overflow-hidden bg-leaf py-28 text-cream">
      <Doodle kind="marigold" className="pointer-events-none absolute -left-10 top-6 w-52 opacity-25" />
      <Doodle kind="rose" className="pointer-events-none absolute -right-8 bottom-8 w-48 opacity-25" delay={0.2} />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className={`${EYEBROW} text-saffron`}>Daily plans</p>
          <h2 className="font-display mt-3 text-5xl sm:text-7xl">Pay once. <em className="text-saffron">Flowers every morning.</em></h2>
          <p className="mt-5 text-cream/70">Here is exactly what a plan costs, line by line. Example: Pooja Mix at {inr(60)} a day.</p>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl items-start gap-12 md:grid-cols-3 md:gap-8">
          {PLAN_PERIODS.map((p, i) => (
            <Receipt key={p.days} days={p.days} discount={p.discount} label={p.label} index={i} featured={p.days === 30} />
          ))}
        </div>
        <ul className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-cream/70">
          {['Free delivery on every plan', 'Skip or pause before 9 PM', 'WhatsApp reminders'].map((f) => <li key={f} className="flex items-center gap-2"><Leaf size={15} weight="fill" className="text-saffron" /> {f}</li>)}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- sunrise */

function Sunrise() {
  return (
    <section className="relative isolate flex min-h-[85vh] items-center justify-center overflow-hidden text-center text-cream">
      <Backdrop src="/img/marigold-field.jpg" tone="bg-ink/55" strength={100} />
      <div className="px-6">
        <div className="flex items-center justify-center gap-3 text-saffron"><Moon size={20} weight="fill" /> <span className={EYEBROW}>Picked at dusk</span> <Sun size={20} weight="fill" /></div>
        <h2 className="font-display mx-auto mt-6 max-w-3xl text-4xl sm:text-6xl"><SplitWords text="Harvested the evening before. Yours by sunrise." /></h2>
        <p className="mx-auto mt-6 max-w-lg text-cream/80">We work with small Maharashtra farms and women-led collection groups. No cold-store, no middlemen, no wilting.</p>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- polaroids */

const POLAROIDS = [
  { img: '/img/marigold-garden.jpg', cap: 'Marigold, at dusk', story: 'Cut in the cool of the evening so the petals hold their colour through the next morning.', rot: -5 },
  { img: '/img/jasmine-hands.jpg', cap: 'Mogra, strung by hand', story: 'Each string is threaded the same night, bud by bud, so the fragrance opens on your altar.', rot: 3 },
  { img: '/img/market-woman.jpg', cap: 'The 4 AM market', story: 'Sorted and packed by the women who grew them. Nothing sits in a cold store overnight.', rot: -2 },
  { img: '/img/lotus-petals.jpg', cap: 'Lotus, for the altar', story: 'Buds and loose petals, kept in water until the moment they are wrapped for you.', rot: 5 },
]

function Polaroids() {
  return (
    <section className="relative overflow-hidden py-28">
      <Doodle kind="mogra" className="pointer-events-none absolute -right-6 top-10 hidden w-36 sm:block" />
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <p className={`${EYEBROW} text-marigold`}>From the farm</p>
          <h2 className="font-display mt-3 text-4xl sm:text-6xl"><SplitWords text="Snapshots from our mornings" /></h2>
          <p className="mt-4 text-sm text-ink-soft">Hover or tap a photo to read its story.</p>
        </div>
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {POLAROIDS.map((p) => (
            <FlipCard
              key={p.cap}
              rotate={p.rot}
              className="aspect-[3/4]"
              front={
                <div className="relative flex h-full flex-col rounded-md bg-white p-3 pb-4 shadow-[0_18px_40px_-18px_rgba(31,26,23,.45)] ring-1 ring-ink/5">
                  <span className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-3 bg-saffron/70" />
                  <img src={p.img} alt={p.cap} loading="lazy" className="min-h-0 w-full flex-1 rounded-sm object-cover" />
                  <p className="font-display mt-3 text-center text-xl"><em>{p.cap}</em></p>
                </div>
              }
              back={
                <div className="flex h-full flex-col justify-center rounded-md bg-leaf p-6 text-cream shadow-[0_18px_40px_-18px_rgba(31,26,23,.45)]">
                  <Leaf size={24} weight="fill" className="text-saffron" />
                  <p className="font-display mt-4 text-2xl"><em>{p.cap}</em></p>
                  <p className="mt-3 text-sm leading-relaxed text-cream/75">{p.story}</p>
                </div>
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- why */

const WHY = [
  { icon: ShieldCheck, title: 'Freshness guarantee', front: 'Fresh or replaced', back: 'Message us on WhatsApp the same morning with a photo. We send a replacement or refund, no questions.' },
  { icon: HandHeart, title: 'Women-led sourcing', front: 'Fair to the farm', back: 'We buy directly from small farms and women-led collection groups, and pay them a fair price.' },
  { icon: PauseCircle, title: 'Skip anytime', front: 'Your plan, your pace', back: 'Skip a day or pause before 9 PM the night before. Skipped days move to the end of your plan.' },
  { icon: ChatCircleDots, title: 'Real people on WhatsApp', front: 'Ask us anything', back: 'Change an address, add a festival pack or report a problem. A person replies, usually within minutes.' },
]

function WhyUs() {
  return (
    <section className="relative overflow-hidden bg-cream-2 py-28">
      <Doodle kind="sprig" className="pointer-events-none absolute -left-4 bottom-4 hidden w-36 rotate-6 sm:block" />
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <p className={`${EYEBROW} text-marigold`}>Why Phool Ghar</p>
          <h2 className="font-display mt-3 text-4xl sm:text-6xl"><SplitWords text="Small promises, kept every morning" /></h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => (
            <FlipCard
              key={w.title}
              className="h-64"
              front={
                <div className="flex h-full flex-col justify-between rounded-3xl border border-ink/10 bg-white p-7">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-marigold/10 text-marigold"><w.icon size={24} weight="duotone" /></span>
                  <div><p className="font-display text-2xl leading-tight">{w.title}</p><p className="mt-1 text-sm text-ink-soft">{w.front}</p></div>
                </div>
              }
              back={
                <div className="flex h-full flex-col justify-center rounded-3xl bg-gradient-to-br from-marigold to-rose p-7 text-white shadow-xl">
                  <p className="font-display text-2xl">{w.title}</p>
                  <p className="mt-3 text-sm leading-relaxed text-white/90">{w.back}</p>
                </div>
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- reviews */

const REVIEWS = [
  { q: 'The marigolds are still fragrant at 9 AM. My mother says it is the first time in years the pooja flowers are truly fresh.', n: 'Sneha K.', l: 'Kothrud, Pune' },
  { q: 'Skipping a day when we travel takes two taps. The delivery is always before I am up.', n: 'Rahul M.', l: 'Andheri, Mumbai' },
  { q: 'We run a small clinic and the daily rose plan makes the reception feel cared for.', n: 'Dr. Anita S.', l: 'Baner, Pune' },
]

function Reviews() {
  return (
    <section className="relative isolate overflow-hidden bg-rose py-28 text-cream">
      <Doodle kind="marigold" className="pointer-events-none absolute -right-12 -top-8 w-60 opacity-30" />
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="font-display mb-14 text-center text-4xl sm:text-6xl"><SplitWords text="Kind words from our mornings" /></h2>
        <div className="grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-white/20">
          {REVIEWS.map((r, i) => (
            <Reveal key={r.n} delay={i * 0.1}>
              <figure className="flex h-full flex-col justify-between border-t border-white/20 pt-8 md:border-t-0 md:px-10 md:pt-0">
                <blockquote className="text-lg leading-relaxed">&ldquo;{r.q}&rdquo;</blockquote>
                <figcaption className="mt-8 text-sm"><span className="font-semibold">{r.n}</span><span className="text-cream/60"> &middot; {r.l}</span></figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ photo reel */

const REEL = [
  { img: '/img/marigold-field.jpg', tag: 'Marigold', title: 'Gold by the armful', body: 'Dense, fragrant genda for the daily altar, torans and garlands.', to: '/shop?c=pooja' },
  { img: '/img/roses-pink.jpg', tag: 'Roses', title: 'Soft, full and scented', body: 'Garden roses for offerings, vases and gifts.', to: '/shop?c=cut' },
  { img: '/img/bouquet-peach.jpg', tag: 'Bouquets', title: 'Tied by hand, never rushed', body: 'Loose, romantic bunches wrapped in recycled paper.', to: '/shop?c=bouquets' },
  { img: '/img/lotus-petals.jpg', tag: 'Lotus', title: 'Petals for the sacred', body: 'Buds and loose petals for abhishek and festivals.', to: '/shop?c=pooja' },
  { img: '/img/jasmine-hands.jpg', tag: 'Mogra', title: 'Strung bud by bud', body: 'Fragrant strings threaded the same night they are cut.', to: '/shop?c=pooja' },
]

function PhotoReel() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [i, setI] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setI(Math.min(REEL.length - 1, Math.max(0, Math.floor(v * REEL.length)))))
  const r = REEL[i]
  return (
    <section aria-label="The bloom reel" className="relative">
      <div ref={ref} style={{ height: `${REEL.length * 85}vh` }} className="relative">
        <div className="sticky top-0 h-screen overflow-hidden text-cream">
          <AnimatePresence>
            <motion.img key={r.img} src={r.img} alt="" initial={{ opacity: 0, scale: 1.14 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} className="absolute inset-0 h-full w-full object-cover" />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/50 to-ink/15" />
          <div className="relative z-10 flex h-full items-center px-6 sm:px-10 lg:px-16">
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.5 }} className="max-w-md">
                <p className={`${EYEBROW} text-saffron`}>{r.tag}</p>
                <h2 className="font-display mt-4 text-5xl leading-[0.98] sm:text-7xl"><em>{r.title}</em></h2>
                <p className="mt-5 max-w-[36ch] text-lg leading-relaxed text-cream/80">{r.body}</p>
                <Link to={r.to} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full border border-white/40 px-6 text-sm font-medium transition-colors duration-200 hover:bg-white hover:text-ink">Shop {r.tag.toLowerCase()} <ArrowRight size={16} /></Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- festivals */

const FESTIVALS = [
  { name: 'Navratri', season: 'Sep to Oct', flowers: 'Marigold garlands, red hibiscus, roses', img: '/img/marigold-garden.jpg' },
  { name: 'Ganesh Chaturthi', season: 'Aug to Sep', flowers: 'Red hibiscus, durva, marigold, lotus', img: '/img/lotus-petals.jpg' },
  { name: 'Diwali', season: 'Oct to Nov', flowers: 'Marigold toran, rose petals for rangoli', img: '/img/marigold-bloom.jpg' },
  { name: 'Raksha Bandhan', season: 'Aug', flowers: 'Roses and hand-tied gift bouquets', img: '/img/roses-soft.jpg' },
  { name: 'Wedding season', season: 'Nov to Feb', flowers: 'Garlands, mogra strings, bridal bouquets', img: '/img/jasmine-hands.jpg' },
]

function Festivals() {
  return (
    <section className="relative overflow-hidden py-28">
      <Doodle kind="marigold" className="pointer-events-none absolute -left-14 bottom-6 hidden w-56 opacity-20 sm:block" />
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-xl">
          <p className={`${EYEBROW} text-marigold`}>The flower calendar</p>
          <h2 className="font-display mt-3 text-5xl sm:text-7xl">Every festival, <em className="text-marigold">in bloom</em></h2>
          <p className="mt-4 max-w-[40ch] text-ink-soft">Order festival packs a few days ahead and we will reserve your flowers at the best of the season.</p>
        </div>
        <ul className="border-t border-ink/15">
          {FESTIVALS.map((f, i) => (
            <li key={f.name}>
              <Link to="/shop?c=pooja" className="group relative flex items-center gap-5 border-b border-ink/15 py-7 transition-colors duration-300 hover:bg-cream-2/70 sm:gap-8 sm:px-4">
                <span className={`${EYEBROW} w-8 text-ink-soft`}>0{i + 1}</span>
                <span className="font-display flex-1 text-3xl leading-none transition-transform duration-500 group-hover:translate-x-2 sm:text-5xl"><em>{f.name}</em></span>
                <span className="hidden max-w-[28ch] text-sm text-ink-soft md:block">{f.flowers}</span>
                <span className={`${EYEBROW} hidden text-marigold sm:block`}>{f.season}</span>
                <img src={f.img} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 sm:h-20 sm:w-20" />
                <ArrowRight size={20} className="shrink-0 text-ink-soft transition-all duration-300 group-hover:translate-x-1 group-hover:text-marigold" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ business */

function Business() {
  return (
    <section className="relative isolate overflow-hidden py-32 text-cream">
      <Backdrop src="/img/bouquet-pink.jpg" tone="bg-gradient-to-r from-ink/90 via-ink/65 to-ink/35" strength={70} />
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-xl">
          <p className={`${EYEBROW} text-saffron`}>For temples, offices and events</p>
          <h2 className="font-display mt-4 text-5xl leading-[0.98] sm:text-7xl">Fresh flowers, <em className="text-saffron">on a schedule.</em></h2>
          <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-cream/80">Daily altar flowers for temples and shops, weekly arrangements for reception desks and clinics, and bulk garlands for events. One plan, one invoice.</p>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-white/20 pt-8">
            {[['Daily', 'altar and shop plans'], ['Weekly', 'office arrangements'], ['Bulk', 'events and weddings']].map(([k, v]) => (
              <div key={k}><dt className="font-display text-3xl"><em>{k}</em></dt><dd className="mt-1 text-xs leading-snug text-cream/70">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#faq" className="inline-flex h-12 items-center gap-2 rounded-full bg-marigold px-7 text-sm font-medium text-white transition-colors duration-200 hover:bg-marigold-deep"><Buildings size={18} /> Get a business quote</a>
            <a href="#faq" className="inline-flex h-12 items-center rounded-full border border-white/35 px-7 text-sm font-medium transition-colors duration-200 hover:bg-white hover:text-ink">Chat on WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- map */

const CITIES = {
  pune: {
    label: 'Pune', center: [18.5420, 73.8560] as [number, number], zoom: 12,
    areas: [
      { name: 'Kothrud', lat: 18.5074, lng: 73.8077, side: 'l' as const }, { name: 'Baner', lat: 18.559, lng: 73.7868, side: 'l' as const }, { name: 'Aundh', lat: 18.558, lng: 73.8075, side: 'r' as const },
      { name: 'Shivajinagar', lat: 18.5308, lng: 73.8475 }, { name: 'Koregaon Park', lat: 18.5362, lng: 73.894 }, { name: 'Viman Nagar', lat: 18.5679, lng: 73.9143 },
      { name: 'Hadapsar', lat: 18.5089, lng: 73.926 }, { name: 'Wakad', lat: 18.5975, lng: 73.7898 },
    ],
  },
  mumbai: {
    label: 'Mumbai', center: [19.12, 72.87] as [number, number], zoom: 11,
    areas: [
      { name: 'Borivali', lat: 19.2307, lng: 72.8567 }, { name: 'Malad', lat: 19.1874, lng: 72.8484 }, { name: 'Andheri', lat: 19.1136, lng: 72.8697 },
      { name: 'Juhu', lat: 19.1075, lng: 72.8263 }, { name: 'Powai', lat: 19.1176, lng: 72.906 }, { name: 'Bandra', lat: 19.0596, lng: 72.8295 },
      { name: 'Dadar', lat: 19.0178, lng: 72.8478 }, { name: 'Worli', lat: 19.0176, lng: 72.8157 },
    ],
  },
}
type CityKey = keyof typeof CITIES

function MapSection() {
  const [city, setCity] = useState<CityKey>('pune')
  const [hover, setHover] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [state, setState] = useState<'idle' | 'ok' | 'no'>('idle')
  const c = CITIES[city]
  return (
    <section id="area" className="relative overflow-hidden bg-cream-2 py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className={`${EYEBROW} text-marigold`}>Where we deliver</p>
          <h2 className="font-display mt-3 text-5xl leading-[0.98] sm:text-7xl">Do we reach <em className="text-marigold">your door?</em></h2>
          <p className="mt-5 max-w-[40ch] text-ink-soft">Every morning between 5 and 8 AM across these neighbourhoods. Enter your pincode to check.</p>

          <div className="mt-8 inline-flex rounded-full bg-cream p-1.5" role="tablist" aria-label="City">
            {(Object.keys(CITIES) as CityKey[]).map((k) => (
              <button key={k} role="tab" aria-selected={city === k} onClick={() => { setCity(k); setHover(null) }} className="relative h-11 rounded-full px-6 text-sm font-medium">
                {city === k && <motion.span layoutId="city-tab" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', damping: 28, stiffness: 320 }} />}
                <span className={`relative ${city === k ? 'text-cream' : 'text-ink-soft'}`}>{CITIES[k].label}</span>
              </button>
            ))}
          </div>
          <ul className="mt-6 flex flex-wrap gap-2">
            {c.areas.map((p) => (
              <li key={p.name}>
                <button onMouseEnter={() => setHover(p.name)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.name)} onBlur={() => setHover(null)} className={`rounded-full border px-4 py-2 text-sm transition-colors duration-200 ${hover === p.name ? 'border-marigold bg-marigold text-white' : 'border-ink/15 bg-cream hover:border-ink/40'}`}>{p.name}</button>
              </li>
            ))}
          </ul>

          <form onSubmit={(e) => { e.preventDefault(); setState(/^(41|40)\d{4}$/.test(pin) ? 'ok' : 'no') }} className="mt-8 flex max-w-md items-center gap-2 rounded-full border border-ink/15 bg-white p-1.5 focus-within:border-marigold">
            <MapPin size={20} weight="fill" className="ml-3 shrink-0 text-marigold" />
            <input value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setState('idle') }} inputMode="numeric" placeholder="Your 6-digit pincode" aria-label="Pincode" className="min-w-0 flex-1 bg-transparent px-2 py-3 outline-none placeholder:text-ink-soft/60" />
            <button className="h-11 rounded-full bg-marigold px-6 font-medium text-white transition-colors duration-200 hover:bg-marigold-deep">Check</button>
          </form>
          <div className="mt-3 h-6 text-sm" aria-live="polite">
            {state === 'ok' && <p className="flex items-center gap-2 font-medium text-leaf"><Van size={18} /> Yes, we deliver to {pin}. Next slot: tomorrow, 5 to 8 AM.</p>}
            {state === 'no' && <p className="text-rose">Not in your area yet. We are in Pune and Mumbai today.</p>}
          </div>
        </div>

        <div className="relative">
          <Doodle kind="sprig" className="pointer-events-none absolute -left-8 -top-10 z-10 hidden w-24 -rotate-12 sm:block" />
          <div className="overflow-hidden rounded-[32px] border-2 border-ink/80 shadow-[10px_10px_0_0_rgba(31,26,23,.9)]">
            <DeliveryMap view={c} active={hover} cityKey={city} />
          </div>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.label + ' Maharashtra')}`} target="_blank" rel="noreferrer" className={`${EYEBROW} mt-3 inline-block py-2.5 text-ink-soft underline-offset-4 hover:underline`}>Open {c.label} in maps</a>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- final cta */

function FinalCta() {
  return (
    <section className="relative isolate flex min-h-[80vh] items-center justify-center overflow-hidden text-center text-cream">
      <Backdrop src="/img/marigold-bloom.jpg" tone="bg-ink/60" strength={90} />
      <div className="px-6">
        <h2 className="font-display mx-auto max-w-3xl text-5xl leading-[0.98] sm:text-8xl">Wake up to <em className="text-saffron">fresh flowers.</em></h2>
        <p className="mx-auto mt-6 max-w-[44ch] text-lg text-cream/80">Start a daily plan in under a minute. Skip, pause or cancel any time before 9 PM.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/shop?type=sub" className="inline-flex h-14 items-center gap-2 rounded-full bg-marigold px-9 font-medium text-white transition-colors duration-200 hover:bg-marigold-deep">Start a daily plan <ArrowRight size={18} /></Link>
          <Link to="/shop" className="inline-flex h-14 items-center rounded-full border border-white/40 px-9 font-medium transition-colors duration-200 hover:bg-white hover:text-ink">Browse flowers</Link>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- faq */

const FAQ = [
  ['What time will my flowers arrive?', 'Subscriptions are delivered between 5 and 8 AM. One-time orders can also pick an evening slot.'],
  ['Can I skip a day or pause?', 'Yes. Skip or pause any day before 9 PM the previous night. Skipped days are added to the end of your plan.'],
  ['How does payment work?', 'You pay for the plan period in advance using UPI, cards or net banking. We never store card details.'],
  ['What if my flowers arrive wilted?', 'Message us on WhatsApp the same morning with a photo and we will send a replacement or refund.'],
  ['Which areas do you deliver to?', 'Pune and Mumbai today. Enter your pincode above and we will tell you instantly.'],
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-28">
      <h2 className="font-display mb-10 text-center text-3xl sm:text-4xl">Questions, answered</h2>
      <div className="divide-y divide-ink/10 border-y border-ink/10">
        {FAQ.map(([q, a], i) => (
          <div key={q}>
            <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-medium">
              {q}
              <motion.span animate={{ rotate: open === i ? 180 : 0 }}><CaretDown size={18} /></motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-5 text-ink-soft">{a}</motion.p>}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Home() {
  useSeo({ title: 'Fresh flowers delivered daily in Pune and Mumbai', path: '/', description: 'Order fresh pooja flowers, hand-tied bouquets and cut flowers, or subscribe to daily flower delivery before 8 AM. Skip or pause any day.' })
  return (
    <>
      <Hero />
      <Marquee />
      <Categories />
      <Story />
      <Featured />
      <PhotoReel />
      <Plans />
      <Festivals />
      <Polaroids />
      <WhyUs />
      <Business />
      <MapSection />
      <Sunrise />
      <Reviews />
      <Faq />
      <FinalCta />
    </>
  )
}
