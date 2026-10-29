import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useEffect, useMemo } from 'react'

const COLORS = ['#e8731a', '#f6b33c', '#f08aa5', '#7a1f45', '#ffd68a']

function PetalShape({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 40 56" className="h-full w-full" aria-hidden>
      <path d="M20 2C32 14 38 30 20 54C2 30 8 14 20 2Z" fill={color} />
      <path d="M20 8C20 24 20 38 20 52" stroke="rgba(255,255,255,.35)" strokeWidth="1.2" fill="none" />
    </svg>
  )
}

/** Floating petals whose depth layers react to the pointer. */
export function Petals({ count = 14 }: { count?: number }) {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 60, damping: 20 })
  const sy = useSpring(my, { stiffness: 60, damping: 20 })

  useEffect(() => {
    const move = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5)
      my.set(e.clientY / window.innerHeight - 0.5)
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [mx, my])

  const petals = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
        return {
          id: i,
          left: r(1) * 100,
          top: 14 + r(2) * 86,
          size: 18 + r(3) * 34,
          depth: 0.4 + r(4) * 1.6,
          rot: r(5) * 360,
          dur: 6 + r(6) * 7,
          color: COLORS[i % COLORS.length],
          blur: r(7) > 0.7 ? 2 : 0,
        }
      }),
    [count],
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {petals.map((p) => (
        <div key={p.id} className={p.id >= 6 ? 'hidden sm:block' : undefined}>
          <Petal p={p} sx={sx} sy={sy} />
        </div>
      ))}
    </div>
  )
}

function Petal({ p, sx, sy }: { p: { left: number; top: number; size: number; depth: number; rot: number; dur: number; color: string; blur: number }; sx: ReturnType<typeof useSpring>; sy: ReturnType<typeof useSpring> }) {
  const x = useTransform(sx, (v) => v * 60 * p.depth)
  const y = useTransform(sy, (v) => v * 60 * p.depth)
  return (
    <motion.div style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size * 1.4, x, y, rotate: p.rot, filter: p.blur ? `blur(${p.blur}px)` : undefined }} className="absolute opacity-80">
      <div style={{ animation: `drift ${p.dur}s ease-in-out infinite` }} className="h-full w-full">
        <PetalShape color={p.color} />
      </div>
    </motion.div>
  )
}
