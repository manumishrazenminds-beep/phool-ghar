/** Date helpers pinned to Asia/Kolkata. Dates are ISO `YYYY-MM-DD` strings throughout. */

const TZ = 'Asia/Kolkata'

function istParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const o: Record<string, string> = {}
  for (const p of f.formatToParts(d)) o[p.type] = p.value
  const hour = Number(o.hour) % 24
  return { date: `${o.year}-${o.month}-${o.day}`, minutes: hour * 60 + Number(o.minute) }
}

export const todayIST = () => istParts().date
export const minutesNowIST = () => istParts().minutes

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 0 = Monday ... 6 = Sunday, same as WEEKDAYS in data/products. */
export function weekdayIndex(iso: string): number {
  return (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7
}

export function diffDays(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000)
}

export function parseCutoff(v: string | undefined | null): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(v ?? '21:00')
  return m ? Number(m[1]) * 60 + Number(m[2]) : 21 * 60
}

/** Earliest date a change or new order can target, given the cut-off (default 21:00 IST). */
export function earliestDate(cutoffMinutes: number): string {
  const today = todayIST()
  return minutesNowIST() >= cutoffMinutes ? addDays(today, 2) : addDays(today, 1)
}

/** True when the date can no longer be skipped, paused or changed. */
export function isLocked(iso: string, cutoffMinutes: number): boolean {
  return iso < earliestDate(cutoffMinutes)
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' })
}

export function fmtDateTime(ts: string): string {
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ })
}
