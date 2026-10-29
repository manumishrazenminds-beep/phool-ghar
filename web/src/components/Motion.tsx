import { motion, useScroll, useTransform } from 'motion/react'
import { useRef, type ReactNode } from 'react'

/** Fade + rise when scrolled into view. */
export function Reveal({
  children, delay = 0, y = 32, className,
}: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** Headline that reveals word by word, each word masked and sliding up. */
export function SplitWords({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    // The trigger lives on the unclipped outer span: a word translated fully out of its
    // overflow-hidden mask has zero visible area, so it can never trip an in-view observer itself.
    <motion.span className={className} aria-label={text} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }}>
      {text.split(' ').map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]" aria-hidden>
          <motion.span
            className="inline-block"
            variants={{ hidden: { y: '110%' }, show: { y: 0 } }}
            transition={{ duration: 0.9, delay: delay + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
}

/** Image that drifts against the scroll inside a fixed frame. */
export function ParallaxImage({
  src, alt, className, strength = 60, scale = 1.18,
}: { src: string; alt: string; className?: string; strength?: number; scale?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength])
  return (
    <div ref={ref} className={`overflow-hidden ${className ?? ''}`}>
      <motion.img src={src} alt={alt} loading="lazy" style={{ y, scale }} className="h-full w-full object-cover will-change-transform" />
    </div>
  )
}
