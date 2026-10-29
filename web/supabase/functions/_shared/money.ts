// Money is integer paise everywhere. These helpers keep it that way.

export function isPaise(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
}

export function assertPaise(n: unknown, label = 'amount'): number {
  if (!isPaise(n)) throw new RangeError(`${label} must be a non-negative integer number of paise`)
  return n
}

/** 12345 -> "123.45" (no currency symbol, no grouping). */
export function paiseToRupeesString(paise: number): string {
  assertPaise(paise)
  const r = Math.floor(paise / 100)
  const p = paise % 100
  return `${r}.${String(p).padStart(2, '0')}`
}

/** 12345 -> "Rs 123.45" with Indian digit grouping, e.g. 1234567 -> "Rs 12,345.67". */
export function formatINR(paise: number): string {
  assertPaise(paise)
  const r = Math.floor(paise / 100)
  const p = String(paise % 100).padStart(2, '0')
  const s = String(r)
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3
  return `Rs ${grouped}.${p}`
}

/** Strict parse of "123", "123.4", "123.45" to paise. Rejects anything else. */
export function rupeesToPaise(input: string): number {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(input.trim())
  if (!m) throw new RangeError('invalid rupee amount')
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0')
}

export function sumPaise(values: number[]): number {
  let t = 0
  for (const v of values) t += assertPaise(v)
  if (!Number.isSafeInteger(t)) throw new RangeError('sum overflow')
  return t
}

/** Compare a provider amount (number or numeric string) with ours, both in paise. */
export function paiseEqual(a: unknown, b: unknown): boolean {
  const x = typeof a === 'string' && /^\d+$/.test(a) ? Number(a) : a
  const y = typeof b === 'string' && /^\d+$/.test(b) ? Number(b) : b
  return isPaise(x) && isPaise(y) && x === y
}
