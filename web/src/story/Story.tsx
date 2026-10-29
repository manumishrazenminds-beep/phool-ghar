import { Leaf } from '@phosphor-icons/react'
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { MV } from './art'
import { Scene1, Scene2, Scene3, Scene4, Scene5, Scene6 } from './scenes'


const CHAPTERS = [
  { place: 'The field', title: 'Plucked at dusk', body: 'In the cool of the evening our pickers walk the rows and cut each bloom at its fullest, by hand and never by machine. Petals are firmest after the heat of the day has gone.', points: ['Cut after 5 PM, when petals are firmest', 'Only fully open blooms are picked', 'Never machine-harvested, never cold-stored'], Scene: Scene1 },
  { place: 'The workshop', title: 'Strung while still warm', body: 'Back at the workshop, marigolds are threaded into garlands and mogra into fragrant strings. Everything is made the same night so it reaches you at its freshest.', points: ['Marigold garlands in three lengths', 'Mogra strings tied by the dozen', 'Strung and sprinkled the same night'], Scene: Scene2 },
  { place: 'The workshop', title: 'Hand-tied, never rushed', body: 'Stems are fanned, trimmed on an angle and bound into bouquets by hand. Each one is wrapped in recycled kraft paper and finished with a ribbon.', points: ['Stems trimmed on an angle', 'Recycled kraft paper wrap', 'Finished with a satin ribbon'], Scene: Scene3 },
  { place: 'The packing table', title: 'Packed to stay fresh', body: 'Every order gets a damp-wrapped base, a care tag with day-by-day tips and our stamp. Packing happens just before dawn, never the night before.', points: ['Damp-wrapped stem base', 'Care tag with simple tips', 'Sealed with our stamp'], Scene: Scene4 },
  { place: 'On the road', title: 'Out before sunrise', body: 'Our riders cover Pune and Mumbai between 5 and 8 AM, in insulated boxes, so flowers reach you at their best and before your day begins.', points: ['5 to 8 AM, every day', 'Insulated delivery boxes', 'Updates on WhatsApp'], Scene: Scene5 },
  { place: 'Your doorstep', title: 'Fresh at your door', body: 'Left at your door or handed over, ready for the altar, the vase or the day ahead. If anything is not right, tell us the same morning and we will fix it.', points: ['Left at the door or handed over', 'Photo confirmation on delivery', 'Fresh-or-replaced promise'], Scene: Scene6 },
]
const N = CHAPTERS.length

function Defs() {
  return (
    <defs>
      <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6c39a" /><stop offset="0.7" stopColor="#fde5c2" /></linearGradient>
      <linearGradient id="sky5" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd3ec" /><stop offset="0.75" stopColor="#fde9cb" /></linearGradient>
      <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="5" r="2.6" fill="rgba(42,33,28,.2)" />
        <circle cx="13" cy="14" r="2.6" fill="rgba(42,33,28,.2)" />
      </pattern>
      <filter id="rough" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="4" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" />
      </filter>
    </defs>
  )
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const on = () => setNarrow(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

function Stage({ scenes, narrow }: { scenes: React.ReactNode; narrow: boolean }) {
  return (
    <svg
      viewBox={narrow ? '330 0 540 620' : '0 0 1200 620'}
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Illustrated story of flowers travelling from field to doorstep"
    >
      <Defs />
      <g className="rough-lines">{scenes}</g>
    </svg>
  )
}

function SceneLayer({ p, i, children }: { p: MV; i: number; children: React.ReactNode }) {
  const a = i / N
  const b = (i + 1) / N
  const o = useTransform(p, [a - 0.03, a + 0.012, b - 0.012, b + 0.03], [i === 0 ? 1 : 0, 1, 1, i === N - 1 ? 1 : 0])
  return <motion.g style={{ opacity: o }}>{children}</motion.g>
}

function Caption({ active, center = false }: { active: number; center?: boolean }) {
  const ch = CHAPTERS[active]
  return (
    <div className={center ? 'text-center' : 'max-w-[30rem]'}>
      <AnimatePresence mode="wait">
        <motion.div key={active} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.45 }}>
          <h2 className="font-display text-5xl leading-[0.98] sm:text-6xl lg:text-7xl"><em>{ch.title}</em></h2>
          <p className={`mt-5 text-[15px] leading-relaxed text-ink-soft sm:text-base ${center ? 'mx-auto max-w-[40ch]' : 'max-w-[44ch]'}`}>{ch.body}</p>
          {!center && (
            <ul className="mt-6 space-y-2.5 border-t border-ink/15 pt-5">
              {ch.points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-ink">
                  <Leaf size={16} weight="fill" className="mt-0.5 shrink-0 text-marigold" />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function Story() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [active, setActive] = useState(0)
  const narrow = useNarrow()
  useMotionValueEvent(p, 'change', (v) => setActive(Math.min(N - 1, Math.max(0, Math.floor(v * N)))))
  const lps = CHAPTERS.map((_, i) => useTransform(p, [i / N, (i + 1) / N], [0, 1], { clamp: true }))

  return (
    <section id="story" aria-label="From field to doorstep" className="relative bg-cream">
      <div ref={ref} style={{ height: `${N * 105}vh` }} className="relative">
        <div className="sticky top-0 h-screen overflow-hidden">
          {/* scene: full screen on desktop, above the caption on phones */}
          <div className="absolute inset-x-0 top-0 bottom-[210px] md:bottom-0">
            <Stage
              narrow={narrow}
              scenes={CHAPTERS.map((c, i) => (
                <SceneLayer key={i} p={p} i={i}><c.Scene lp={lps[i]} /></SceneLayer>
              ))}
            />
          </div>

          {/* desktop: heading + sub text on the left, over a soft fade */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-[48%] bg-gradient-to-r from-cream via-cream/85 to-transparent md:block" />
          <div className="absolute left-10 top-1/2 hidden -translate-y-1/2 md:block lg:left-16">
            <Caption active={active} />
          </div>

          {/* phones: caption ledger under the scene */}
          <div className="absolute inset-x-0 bottom-0 h-[210px] border-t-2 border-ink/80 bg-cream px-6 pt-5 md:hidden">
            <Caption active={active} center />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Freeze one scene at a given local progress: /__story?scene=2&lp=0.5 */
export function StoryDebug() {
  const q = new URLSearchParams(window.location.search)
  const scene = Math.max(1, Math.min(N, Number(q.get('scene') ?? 1))) - 1
  const lp = useMotionValue(Number(q.get('lp') ?? 0.5))
  const narrow = useNarrow()
  const { Scene } = CHAPTERS[scene]
  return (
    <div className="relative h-screen bg-cream">
      <Stage narrow={narrow} scenes={<Scene lp={lp} />} />
    </div>
  )
}
