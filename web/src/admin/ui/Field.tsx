import clsx from 'clsx'
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const CONTROL = 'w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/35 min-h-9 pointer-coarse:min-h-11 disabled:bg-ink/5 disabled:text-ink-soft'

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={clsx('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">{label}</label>
      {children(id)}
      {hint && !error && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose" role="alert">{error}</p>}
    </div>
  )
}

type Common = { label: string; hint?: string; error?: string; wrapperClassName?: string }
export function TextField({ label, hint, error, wrapperClassName, className, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={label} hint={hint} error={error} className={wrapperClassName}>{(id) => <input id={id} {...rest} className={clsx(CONTROL, className)} />}</Field>
}
export function TextArea({ label, hint, error, wrapperClassName, className, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Field label={label} hint={hint} error={error} className={wrapperClassName}>{(id) => <textarea id={id} rows={3} {...rest} className={clsx(CONTROL, 'py-2', className)} />}</Field>
}
export function SelectField({ label, hint, error, wrapperClassName, className, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return <Field label={label} hint={hint} error={error} className={wrapperClassName}>{(id) => <select id={id} {...rest} className={clsx(CONTROL, 'pr-8', className)}>{children}</select>}</Field>
}
export function Toggle({ label, checked, onChange, hint, disabled, compact }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean; compact?: boolean }) {
  const id = useId()
  return (
    <div className="flex min-h-9 items-center gap-3 pointer-coarse:min-h-11">
      <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-leaf' : 'bg-ink/20')}>
        <span className={clsx('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none', checked && 'translate-x-5')} />
        <span className="sr-only">{label}</span>
      </button>
      {!compact && <label htmlFor={id} className="cursor-pointer text-sm">{label}{hint && <span className="block text-xs text-ink-soft">{hint}</span>}</label>}
    </div>
  )
}
export function SearchBox({ value, onChange, placeholder = 'Search', label = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  return <TextField label={label} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} wrapperClassName="min-w-52 flex-1 sm:max-w-xs" />
}
