// Small hand-rolled validators (no dependency). Each throws HttpError 400 invalid_input.
import { HttpError } from './http.ts'

export const RE = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  date: /^\d{4}-\d{2}-\d{2}$/,
  idem: /^[A-Za-z0-9_:.-]{8,100}$/,
  rzpOrder: /^order_[A-Za-z0-9]{6,40}$/,
  rzpPayment: /^pay_[A-Za-z0-9]{6,40}$/,
  hex64: /^[0-9a-f]{64}$/i,
  slug: /^[a-z0-9][a-z0-9_-]{0,63}$/i,
}

function bad(path: string, msg: string): never {
  throw new HttpError(400, 'invalid_input', `${path}: ${msg}`)
}

export function asObject(v: unknown, path = 'body'): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) bad(path, 'must be an object')
  return v as Record<string, unknown>
}

export function str(v: unknown, path: string, o: { min?: number; max?: number; re?: RegExp; optional?: boolean } = {}): string | undefined {
  if (v === undefined || v === null || v === '') {
    if (o.optional) return undefined
    bad(path, 'is required')
  }
  if (typeof v !== 'string') bad(path, 'must be a string')
  const s = (v as string).trim()
  if (o.min !== undefined && s.length < o.min) bad(path, `must be at least ${o.min} characters`)
  if (s.length > (o.max ?? 500)) bad(path, `must be at most ${o.max ?? 500} characters`)
  if (o.re && !o.re.test(s)) bad(path, 'has an invalid format')
  return s
}

export function reqStr(v: unknown, path: string, o: { min?: number; max?: number; re?: RegExp } = {}): string {
  return str(v, path, o) as string
}

export function int(v: unknown, path: string, o: { min?: number; max?: number; optional?: boolean } = {}): number | undefined {
  if (v === undefined || v === null) {
    if (o.optional) return undefined
    bad(path, 'is required')
  }
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) bad(path, 'must be an integer')
  const n = v as number
  if (o.min !== undefined && n < o.min) bad(path, `must be >= ${o.min}`)
  if (o.max !== undefined && n > o.max) bad(path, `must be <= ${o.max}`)
  return n
}

export function reqInt(v: unknown, path: string, o: { min?: number; max?: number } = {}): number {
  return int(v, path, o) as number
}

export function arr(v: unknown, path: string, o: { min?: number; max: number }): unknown[] {
  if (!Array.isArray(v)) bad(path, 'must be an array')
  const a = v as unknown[]
  if (a.length < (o.min ?? 0)) bad(path, `must have at least ${o.min} items`)
  if (a.length > o.max) bad(path, `must have at most ${o.max} items`)
  return a
}

/** Real calendar date check on top of the YYYY-MM-DD regex. */
export function dateStr(v: unknown, path: string, optional = false): string | undefined {
  const s = str(v, path, { re: RE.date, optional })
  if (s === undefined) return undefined
  const d = new Date(s + 'T00:00:00Z')
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) bad(path, 'is not a real date')
  return s
}
