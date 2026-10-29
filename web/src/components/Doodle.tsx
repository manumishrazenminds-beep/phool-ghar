import { motion } from 'motion/react'
import { C, Leaf, Marigold, Mogra, Rose } from '../story/art'

type Kind = 'marigold' | 'rose' | 'sprig' | 'mogra'

/** A hand-inked flower that pops in when scrolled into view. Pure decoration. */
export function Doodle({ kind, className = '', delay = 0 }: { kind: Kind; className?: string; delay?: number }) {
  return (
    <motion.svg
      viewBox="-60 -70 120 140"
      aria-hidden
      className={className}
      initial={{ opacity: 0, rotate: -18, scale: 0.7 }}
      whileInView={{ opacity: 1, rotate: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {kind === 'marigold' && <Marigold r={52} />}
      {kind === 'rose' && <Rose r={46} />}
      {kind === 'mogra' && (
        <g>
          <g transform="translate(-22 14)"><Mogra r={26} /></g>
          <g transform="translate(24 8)"><Mogra r={26} /></g>
          <g transform="translate(0 -22)"><Mogra r={26} /></g>
        </g>
      )}
      {kind === 'sprig' && (
        <g>
          <path d="M0 66 Q-10 10 4 -34" fill="none" stroke={C.ink} strokeWidth={8} strokeLinecap="round" />
          <path d="M0 66 Q-10 10 4 -34" fill="none" stroke={C.leafD} strokeWidth={4.4} strokeLinecap="round" />
          <g transform="translate(-4 30)"><Leaf len={46} rot={-35} /></g>
          <g transform="translate(-6 8)"><Leaf len={42} rot={-145} /></g>
          <g transform="translate(4 -34)"><Marigold r={26} tone={1} /></g>
        </g>
      )}
    </motion.svg>
  )
}
