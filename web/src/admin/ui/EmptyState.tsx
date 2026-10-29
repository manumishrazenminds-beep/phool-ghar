import type { ReactNode } from 'react'

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-soft/70" aria-hidden>{icon}</div>}
      <p className="font-display text-2xl">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-ink-soft">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
