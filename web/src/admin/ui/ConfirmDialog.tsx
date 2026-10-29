import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

export function ConfirmDialog({ open, title, children, confirmLabel = 'Confirm', danger, askReason, reasonLabel = 'Reason', reasonRequired, busy, error, onConfirm, onCancel }: {
  open: boolean; title: string; children?: ReactNode; confirmLabel?: string; danger?: boolean
  askReason?: boolean; reasonLabel?: string; reasonRequired?: boolean; busy?: boolean; error?: string | null
  onConfirm: (reason: string) => void; onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    setReason('')
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [open, onCancel])
  if (!open) return null
  const blocked = busy || (askReason && reasonRequired && !reason.trim())
  return createPortal(
    <div className="fixed inset-0 z-[300] grid place-items-center p-4 print:hidden" data-lenis-prevent>
      <div className="absolute inset-0 bg-ink/50" onClick={onCancel} aria-hidden />
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby={id + 't'} tabIndex={-1} className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl outline-none">
        <h2 id={id + 't'} className="font-display text-3xl">{title}</h2>
        {children && <div className="mt-2 text-sm text-ink-soft">{children}</div>}
        {askReason && (
          <div className="mt-4">
            <label htmlFor={id + 'r'} className="mb-1 block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">{reasonLabel}{reasonRequired ? ' (required)' : ''}</label>
            <textarea id={id + 'r'} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-soft/70 p-2.5 text-sm text-rose">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => onConfirm(reason.trim())}>{busy ? 'Working...' : confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
