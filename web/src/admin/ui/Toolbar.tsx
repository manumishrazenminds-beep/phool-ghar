import clsx from 'clsx'
import type { ReactNode } from 'react'

/** Sticky filter bar. Place directly above a Table. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="search" className={clsx('z-20 -mx-1 lg:sticky lg:top-[52px] mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-ink/10 bg-cream/95 px-3 py-2.5 backdrop-blur print:hidden', className)}>
      {children}
    </div>
  )
}
