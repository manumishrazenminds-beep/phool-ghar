import clsx from 'clsx'
import type { ReactNode } from 'react'
import { WarningCircle } from '@phosphor-icons/react'
import { Button } from './Button'

export function PageHeader({ eyebrow, title, actions, children }: { eyebrow: string; title: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 print:mb-3">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-marigold-deep">{eyebrow}</p>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl">{title}</h1>
        {children && <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </header>
  )
}

export function Panel({ title, actions, children, className, pad = true }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx('rounded-xl border border-ink/10 bg-white', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">{title}</h2>
          {actions}
        </div>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-rose/25 bg-rose-soft/60 p-3.5 text-sm text-rose">
      <WarningCircle size={20} weight="duotone" className="mt-0.5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 break-words">{message}</p>
      {onRetry && <Button size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  )
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-md bg-ink/5 motion-reduce:animate-none" />)}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string; count?: number }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 rounded-lg bg-ink/5 p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} type="button" onClick={() => onChange(t.id)}
          className={clsx('min-h-8 rounded-md px-3 text-sm font-medium transition-colors pointer-coarse:min-h-11', value === t.id ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink')}>
          {t.label}{t.count != null && <span className="ml-1.5 font-mono text-[11px] text-ink-soft">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
