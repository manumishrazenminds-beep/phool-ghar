import { motion } from 'motion/react'
import { Link } from 'react-router-dom'

const OUTER = '#f6b33c'
const INNER = '#e8731a'
const CORE = '#7a1f45'

/** Marigold bloom: two petal rings, a deep core and a leaf. Reads at 24px and up. */
export function LogoMark({ size = 40, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <motion.g
        animate={spin ? { rotate: 360 } : undefined}
        transition={spin ? { repeat: Infinity, duration: 40, ease: 'linear' } : undefined}
        style={{ originX: '20px', originY: '20px' }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <ellipse key={`o${i}`} cx="20" cy="9" rx="4.4" ry="8" fill={OUTER} transform={`rotate(${i * 36} 20 20)`} />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <ellipse key={`i${i}`} cx="20" cy="12.6" rx="3.4" ry="5.6" fill={INNER} transform={`rotate(${i * 36 + 18} 20 20)`} />
        ))}
      </motion.g>
      <circle cx="20" cy="20" r="4.6" fill={CORE} />
      <circle cx="20" cy="20" r="1.6" fill="#fbf5ea" opacity=".85" />
    </svg>
  )
}

export function Logo({ light = false, className = '' }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" aria-label="Phool Ghar, home" className={`group inline-flex items-center gap-2.5 rounded-full outline-offset-4 ${className}`}>
      <span className="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:rotate-[36deg]">
        <LogoMark size={38} />
      </span>
      <span className={`font-display text-[1.75rem] leading-none tracking-[-0.01em] ${light ? 'text-cream' : 'text-ink'}`}>
        Phool <em className={`pr-0.5 ${light ? 'text-saffron' : 'text-marigold'}`}>Ghar</em>
      </span>
    </Link>
  )
}
