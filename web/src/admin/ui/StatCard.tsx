import clsx from 'clsx'
import type { ReactNode } from 'react'

export function StatCard({ label, value, hint, tone = 'default', icon, to }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'alert' | 'good'; icon?: ReactNode; to?: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">{label}</p>
        {icon && <span className="text-ink-soft" aria-hidden>{icon}</span>}
      </div>
      <p className={clsx('mt-2 font-display text-4xl leading-none', tone === 'alert' ? 'text-rose' : tone === 'good' ? 'text-leaf' : 'text-ink')}>{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-soft">{hint}</p>}
    </>
  )
  const cls = 'block rounded-xl border border-ink/10 bg-white p-4'
  return to ? <a href={to} className={clsx(cls, 'transition-colors hover:border-ink/30')}>{body}</a> : <div className={cls}>{body}</div>
}
