import { addDays, fmtDate } from '../lib/dates'
import { Field } from '../lib/ui'

/** A strip of selectable days plus a native date input for anything further out. */
export function DatePicker({ value, onChange, min, count = 14, max }: { value: string; onChange: (d: string) => void; min: string; count?: number; max: string }) {
  const days = Array.from({ length: count }, (_, i) => addDays(min, i))
  return (
    <div>
      <div role="radiogroup" aria-label="Delivery date" className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {days.map((d) => {
          const on = d === value
          const [wd, rest] = [fmtDate(d, { weekday: 'short' }), fmtDate(d, { day: 'numeric', month: 'short' })]
          return (
            <button key={d} type="button" role="radio" aria-checked={on} onClick={() => onChange(d)}
              className={`min-h-14 rounded-2xl border px-2 py-2 text-center transition ${on ? 'border-ink bg-ink text-cream' : 'border-ink/15 bg-white hover:border-ink/40'}`}>
              <span className={`block font-mono text-[11px] uppercase tracking-[0.14em] ${on ? 'text-cream/70' : 'text-ink-soft'}`}>{wd}</span>
              <span className="block text-sm font-medium">{rest}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-4 max-w-xs">
        <Field label="Or choose another date" type="date" min={min} max={max} value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
      </div>
    </div>
  )
}
