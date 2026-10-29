import { X } from '@phosphor-icons/react'
import clsx from 'clsx'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Drawer({ open, onClose, title, eyebrow, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[200] print:hidden" data-lenis-prevent>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={clsx('animate-[drawerIn_.22s_ease-out] motion-reduce:animate-none absolute inset-y-0 right-0 flex w-full flex-col bg-cream shadow-2xl outline-none', wide ? 'max-w-2xl' : 'max-w-xl')}>
        <header className="flex items-start justify-between gap-3 border-b border-ink/10 bg-white px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-marigold-deep">{eyebrow}</p>}
            <h2 id={titleId} className="truncate font-display text-3xl">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close panel" className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-ink/5 hover:text-ink">
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink/10 bg-white px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
