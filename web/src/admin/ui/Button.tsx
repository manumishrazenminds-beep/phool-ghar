import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'danger' | 'quiet' | 'leaf'
const V: Record<Variant, string> = {
  primary: 'bg-ink text-cream hover:bg-ink/85 border-ink',
  leaf: 'bg-leaf text-cream hover:bg-leaf/85 border-leaf',
  ghost: 'bg-white text-ink border-ink/15 hover:border-ink/40 hover:bg-cream-2/40',
  quiet: 'bg-transparent text-ink-soft border-transparent hover:bg-ink/5 hover:text-ink',
  danger: 'bg-white text-rose border-rose/30 hover:bg-rose-soft/60',
}
export function Button({
  variant = 'ghost', size = 'md', icon, children, className, type = 'button', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }) {
  return (
    <button
      type={type}
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'min-h-8 px-2.5 text-xs pointer-coarse:min-h-11' : size === 'lg' ? 'min-h-12 px-5 text-base' : 'min-h-9 px-3.5 text-sm pointer-coarse:min-h-11',
        V[variant], className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}
