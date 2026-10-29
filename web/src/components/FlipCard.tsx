import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'

/**
 * 3D flip card. Hover flips on desktop, tap toggles on touch.
 * Keyboard: Enter/Space toggles.
 */
export function FlipCard({
  front, back, className = '', rotate = 0,
}: { front: ReactNode; back: ReactNode; className?: string; rotate?: number }) {
  const [flipped, setFlipped] = useState(false)
  const face = { backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } as const
  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      onMouseEnter={() => window.matchMedia('(hover: hover)').matches && setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setFlipped((f) => !f))}
      initial={{ opacity: 0, y: 40, rotate }}
      whileInView={{ opacity: 1, y: 0, rotate }}
      whileHover={{ rotate: 0, y: -8 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`relative cursor-pointer outline-none [perspective:1200px] focus-visible:ring-2 focus-visible:ring-marigold ${className}`}
    >
      <motion.div animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 140, damping: 18 }} style={{ transformStyle: 'preserve-3d' }} className="relative h-full w-full">
        <div style={face} className="absolute inset-0">{front}</div>
        <div style={{ ...face, transform: 'rotateY(180deg)' }} className="absolute inset-0">{back}</div>
      </motion.div>
    </motion.div>
  )
}
