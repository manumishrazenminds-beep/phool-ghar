import clsx from 'clsx'
import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'
import { ErrorBanner, Skeleton } from './Page'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
  /** hide below the md breakpoint to keep the table readable on tablets/phones */
  hideOnSmall?: boolean
}

export function Table<T>({
  columns, rows, rowKey, onRowClick, loading, error, onRetry, empty, caption, selection, dense, footer,
}: {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (r: T) => string
  onRowClick?: (r: T) => void
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  empty?: ReactNode
  caption: string
  selection?: { selected: Set<string>; onChange: (next: Set<string>) => void }
  dense?: boolean
  footer?: ReactNode
}) {
  const list = rows ?? []
  const allSel = !!selection && list.length > 0 && list.every((r) => selection.selected.has(rowKey(r)))
  const pad = dense ? 'px-3 py-2' : 'px-3 py-2.5'
  return (
    <div>
      {error && <ErrorBanner message={error} onRetry={onRetry} />}
      <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white print:overflow-visible print:border-0">
        {loading && !rows ? <Skeleton rows={6} /> : (
          <table className="w-full min-w-[640px] border-collapse text-left text-sm print:min-w-0">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-ink/10 bg-cream-2/40">
                {selection && (
                  <th scope="col" className="w-10 px-3 print:hidden">
                    <input type="checkbox" aria-label="Select all rows" checked={allSel} className="h-4 w-4 accent-[#1f3d2b]"
                      onChange={() => selection.onChange(allSel ? new Set() : new Set(list.map(rowKey)))} />
                  </th>
                )}
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={clsx('whitespace-nowrap px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.hideOnSmall && 'hidden md:table-cell', c.className)}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody className={clsx(loading && 'opacity-60')}>
              {list.map((r) => {
                const k = rowKey(r)
                return (
                  <tr key={k}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    onKeyDown={onRowClick ? (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onRowClick(r) } } : undefined}
                    className={clsx('border-b border-ink/5 last:border-0', onRowClick && 'cursor-pointer hover:bg-cream-2/40 focus-visible:bg-cream-2/60', selection?.selected.has(k) && 'bg-saffron/10')}>
                    {selection && (
                      <td className={clsx('print:hidden', pad)} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label="Select row" className="h-4 w-4 accent-[#1f3d2b]" checked={selection.selected.has(k)}
                          onChange={() => { const n = new Set(selection.selected); if (n.has(k)) n.delete(k); else n.add(k); selection.onChange(n) }} />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={clsx(pad, 'align-middle', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.hideOnSmall && 'hidden md:table-cell', c.className)}>{c.cell(r)}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && !error && list.length === 0 && (empty ?? <EmptyState title="Nothing here yet">No records match.</EmptyState>)}
        {footer}
      </div>
    </div>
  )
}
