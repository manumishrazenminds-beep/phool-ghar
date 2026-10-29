import type { AddressSnap, DeliveryRow, Order } from './types'

export const rupees = (paise: number | null | undefined) => {
  const p = Math.round(paise ?? 0)
  return '\u20B9' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })
}

/** Today's date in India as YYYY-MM-DD, independent of the browser timezone. */
export function todayISO(offsetDays = 0): string {
  const base = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  return offsetDays ? addDays(base, offsetDays) : base
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '-'
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
  return d.toLocaleDateString('en-IN', { timeZone: iso.length <= 10 ? undefined : 'Asia/Kolkata', ...opts })
}
export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}
export const weekdayOf = (iso: string) => (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7 // 0 = Monday
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const humanize = (s: string | null | undefined) => (s ?? '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export function digitsPhone(p: string | null | undefined): string {
  const d = (p ?? '').replace(/\D/g, '')
  if (d.length === 10) return '91' + d
  if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1)
  return d
}
export const telLink = (p: string | null | undefined) => (p ? `tel:+${digitsPhone(p)}` : undefined)
export const waLink = (p: string | null | undefined, text?: string) =>
  p ? `https://wa.me/${digitsPhone(p)}${text ? `?text=${encodeURIComponent(text)}` : ''}` : undefined

export function addressLine(a: AddressSnap | DeliveryRow | null | undefined, withLandmark = true): string {
  if (!a) return ''
  return [a.line1, a.line2, withLandmark ? a.landmark : '', a.city, a.pincode].filter(Boolean).join(', ')
}
export const mapsLink = (a: AddressSnap | DeliveryRow | null | undefined) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(a))}`

export function orderToDelivery(o: Order, summary = '', staffName: string | null = null): DeliveryRow {
  const a = o.address ?? {}
  return {
    order_id: o.id, order_no: o.order_no, kind: o.kind, slot_id: o.slot_id, status: o.status, payment_status: o.payment_status,
    assigned_to: o.assigned_to, assigned_name: staffName,
    recipient_name: a.recipient_name ?? '', recipient_phone: a.recipient_phone ?? '', line1: a.line1 ?? '', line2: a.line2 ?? '',
    landmark: a.landmark ?? '', city: a.city ?? '', area: '', pincode: a.pincode ?? '', instructions: a.instructions ?? '',
    gift_note: o.gift_note ?? '', items_summary: summary, total_paise: o.total_paise,
  }
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n')
}
export function downloadCsv(filename: string, rows: Record<string, unknown>[], columns?: string[]) {
  const blob = new Blob(['﻿' + toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Turn Postgres / PostgREST / network errors into a sentence a shop owner can act on. */
export function readableError(e: unknown): string {
  if (!e) return 'Something went wrong.'
  const err = e as { message?: string; code?: string; hint?: string; details?: string }
  const msg = err.message ?? String(e)
  const code = err.code ?? ''
  if (code === '42501' || /row-level security|permission denied/i.test(msg))
    return 'Permission denied by the database (row-level security). Your account is not allowed to do this. Ask the owner to check your permissions.'
  if (code === '23505' || /duplicate key/i.test(msg)) return 'That already exists (a unique value is repeated). ' + (err.details ?? '')
  if (code === '23503') return 'This record is still used by other records, or refers to something that does not exist. ' + (err.details ?? '')
  if (code === '23514' || code === '23502') return `A value is missing or out of range. ${err.details ?? msg}`
  if (code === 'PGRST301' || /jwt/i.test(msg)) return 'Your session has expired. Sign in again.'
  if (code === '42P01' || code === 'PGRST205' || /does not exist|schema cache/i.test(msg))
    return `The database is missing something this screen needs (${msg}). Run the latest migrations.`
  if (code === '42883' || /function .* does not exist|Could not find the function/i.test(msg))
    return `A database function is missing (${msg}). Run the latest migrations.`
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Cannot reach the server. Check the internet connection and the Supabase URL.'
  return [msg, err.hint].filter(Boolean).join(' ')
}
