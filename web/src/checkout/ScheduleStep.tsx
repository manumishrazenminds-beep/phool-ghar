import { useMemo } from 'react'
import { WEEKDAYS } from '../data/products'
import type { SlotInfo } from '../lib/catalog'
import { addDays, earliestDate, fmtDate } from '../lib/dates'
import { useSettings } from '../lib/settings'
import { Alert, Button, TextArea } from '../lib/ui'
import { DatePicker } from './DatePicker'
import type { PayGroup, Schedule } from './types'

export type SlotLoad = Record<string, number | null | undefined>

export function ScheduleStep({ group, value, onChange, slots, remaining, onNext }: {
  group: PayGroup; value: Schedule; onChange: (s: Schedule) => void; slots: SlotInfo[]; remaining: SlotLoad; onNext: () => void
}) {
  const { cutoffMinutes } = useSettings()
  const min = useMemo(() => earliestDate(cutoffMinutes), [cutoffMinutes])
  const sub = group.kind === 'sub'
  const days = sub ? group.lines[0].line.days ?? [] : []
  const usable = slots.filter((s) => !sub || s.subscriptionOk)
  const date = value.date < min ? min : value.date
  const slotOk = usable.some((s) => s.id === value.slot) && remaining[value.slot] !== 0
  const note = value.giftNote.length

  return (
    <div className="space-y-10">
      <section aria-labelledby="d-h">
        <h3 id="d-h" className="font-display text-2xl">{sub ? 'When should your plan start?' : 'Delivery date'}</h3>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Orders placed before {Math.floor(cutoffMinutes / 60) % 12 || 12}{cutoffMinutes % 60 ? `:${String(cutoffMinutes % 60).padStart(2, '0')}` : ''} {cutoffMinutes >= 720 ? 'PM' : 'AM'} can be delivered tomorrow. Earliest available: {fmtDate(min)}.
        </p>
        <DatePicker value={date} min={min} max={addDays(min, 60)} onChange={(d) => onChange({ ...value, date: d })} />
        {sub && days.length > 0 && <p className="mt-4 text-sm text-ink-soft">Delivering on {days.map((d) => WEEKDAYS[d]).join(', ')}. The first delivery is the first of these days on or after {fmtDate(date)}.</p>}
      </section>

      <section aria-labelledby="s-h">
        <h3 id="s-h" className="font-display text-2xl">Time slot</h3>
        <div role="radiogroup" aria-labelledby="s-h" className="mt-4 grid gap-3 sm:grid-cols-3">
          {usable.map((s) => {
            const left = remaining[s.id]
            const full = left === 0
            const on = value.slot === s.id
            return (
              <button key={s.id} type="button" role="radio" aria-checked={on} disabled={full} onClick={() => onChange({ ...value, slot: s.id })}
                className={`min-h-20 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-ink bg-white ring-1 ring-ink' : 'border-ink/15 bg-white hover:border-ink/40'}`}>
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block text-xs text-ink-soft">{s.note}</span>
                {full ? <span className="mt-1 block text-xs font-medium text-rose">Fully booked</span>
                  : left != null && left <= 5 ? <span className="mt-1 block text-xs font-medium text-marigold-deep">Only {left} left</span> : null}
              </button>
            )
          })}
        </div>
        {sub && slots.some((s) => !s.subscriptionOk) && <p className="mt-3 text-xs text-ink-soft">Evening slots are for one-time orders. Daily plans arrive in the morning.</p>}
      </section>

      {!sub && (
        <section className="space-y-4">
          <TextArea label="Gift note (optional)" maxLength={240} hint={`${note}/240. We print it on a small card.`} value={value.giftNote} onChange={(e) => onChange({ ...value, giftNote: e.target.value })} />
          <TextArea label="Delivery instructions (optional)" rows={2} maxLength={240} value={value.instructions} onChange={(e) => onChange({ ...value, instructions: e.target.value })} />
        </section>
      )}
      {sub && <TextArea label="Delivery instructions (optional)" rows={2} maxLength={240} value={value.instructions} onChange={(e) => onChange({ ...value, instructions: e.target.value })} />}

      {!slotOk && <Alert tone="warn">Please choose an available time slot to continue.</Alert>}
      <Button disabled={!slotOk} onClick={() => { if (date !== value.date) onChange({ ...value, date }); onNext() }}>Review and pay</Button>
    </div>
  )
}
