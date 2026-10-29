import { CircleNotch, Warning, X } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-marigold', className)}>{children}</p>
}

export function PageShell({ eyebrow, title, intro, children, narrow }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; children: ReactNode; narrow?: boolean }) {
  return (
    <div className={cx('mx-auto px-6 pb-28 pt-36', narrow ? 'max-w-xl' : 'max-w-6xl')}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="font-display mt-3 text-5xl sm:text-6xl">{title}</h1>
      {intro && <p className="mt-4 max-w-xl text-ink-soft">{intro}</p>}
      <div className="mt-10">{children}</div>
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet'; loading?: boolean }
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'primary', loading, className, children, disabled, ...rest }, ref) {
  const v = {
    primary: 'bg-ink text-cream hover:bg-marigold-deep',
    ghost: 'border border-ink/20 text-ink hover:border-ink hover:bg-ink/5',
    danger: 'border border-rose/40 text-rose hover:bg-rose-soft',
    quiet: 'text-ink-soft hover:text-ink hover:bg-ink/5',
  }[variant]
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50', v, className)}
      {...rest}
    >
      {loading && <CircleNotch size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />}
      {children}
    </button>
  )
})

export function LinkButton({ to, children, variant = 'primary', className }: { to: string; children: ReactNode; variant?: 'primary' | 'ghost'; className?: string }) {
  const v = variant === 'primary' ? 'bg-ink text-cream hover:bg-marigold-deep' : 'border border-ink/20 text-ink hover:border-ink hover:bg-ink/5'
  return <Link to={to} className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition', v, className)}>{children}</Link>
}

const inputCls = 'min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-marigold disabled:opacity-60'

interface FieldShell { label: string; hint?: string; error?: string | null }
function Shell({ id, label, hint, error, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p id={id + '-hint'} className="mt-1.5 text-xs text-ink-soft">{hint}</p>}
      {error && <p id={id + '-err'} role="alert" className="mt-1.5 text-xs text-rose">{error}</p>}
    </div>
  )
}
const describe = (id: string, hint?: string, error?: string | null) => (error ? id + '-err' : hint ? id + '-hint' : undefined)

export function Field({ label, hint, error, className, ...rest }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <input id={id} aria-invalid={!!error || undefined} aria-describedby={describe(id, hint, error)} className={cx(inputCls, error ? 'border-rose' : 'border-ink/15', className)} {...rest} />
    </Shell>
  )
}
export function TextArea({ label, hint, error, className, ...rest }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <textarea id={id} rows={3} aria-invalid={!!error || undefined} aria-describedby={describe(id, hint, error)} className={cx(inputCls, 'resize-y', error ? 'border-rose' : 'border-ink/15', className)} {...rest} />
    </Shell>
  )
}
export function Select({ label, hint, error, className, children, ...rest }: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <select id={id} aria-invalid={!!error || undefined} aria-describedby={describe(id, hint, error)} className={cx(inputCls, error ? 'border-rose' : 'border-ink/15', className)} {...rest}>{children}</select>
    </Shell>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-xl bg-ink/[0.07] motion-reduce:animate-none', className)} />
}
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cx('space-y-4', className)}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-24" />)}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function Alert({ tone = 'error', title, children, action }: { tone?: 'error' | 'info' | 'ok' | 'warn'; title?: string; children?: ReactNode; action?: ReactNode }) {
  const t = {
    error: 'border-rose/30 bg-rose-soft/60 text-rose',
    info: 'border-ink/10 bg-cream-2 text-ink',
    ok: 'border-leaf/20 bg-leaf-soft text-leaf',
    warn: 'border-marigold/30 bg-saffron/15 text-ink',
  }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm', t)}>
      {tone === 'error' && <Warning size={18} className="mt-0.5 shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx(title && 'mt-0.5', tone !== 'info' && 'opacity-90')}>{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border border-rose/20 bg-rose-soft/40 px-6 py-10 text-center">
      <p className="font-display text-2xl">Something went wrong</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{message}</p>
      {onRetry && <Button variant="ghost" className="mt-5" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-ink/20 px-6 py-14 text-center">
      <p className="font-display text-3xl">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}

/** Shown on auth/checkout/account surfaces when Supabase env is missing. */
export function BackendOff({ what = 'This page' }: { what?: string }) {
  return (
    <div className="rounded-3xl border border-ink/10 bg-cream-2 px-6 py-12 text-center sm:px-12">
      <Eyebrow>Almost there</Eyebrow>
      <p className="font-display mt-3 text-4xl">The shop is <em>not connected</em> yet</p>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
        {what} needs our account and payment service, which is still being switched on. You can keep browsing and filling your basket; nothing is lost.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <LinkButton to="/shop">Keep browsing</LinkButton>
        <LinkButton to="/" variant="ghost">Back home</LinkButton>
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const prev = useRef<Element | null>(null)
  useEffect(() => {
    if (!open) return
    prev.current = document.activeElement
    const el = ref.current
    el?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea')).filter((x) => x.offsetParent !== null)
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      ;(prev.current as HTMLElement | null)?.focus?.()
    }
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[95] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }}>
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <div ref={ref} role="dialog" aria-modal="true" aria-label={title} data-lenis-prevent className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-cream p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-3xl">{title}</h2>
              <button data-close onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-ink/5"><X size={20} /></button>
            </div>
            <div className="mt-4">{children}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span role="status" className="inline-flex items-center gap-2 text-sm text-ink-soft"><CircleNotch size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />{label}</span>
}
