// Outbound-call resilience: per-attempt timeout, exponential backoff with full jitter,
// and a small in-memory circuit breaker (per isolate; good enough to stop hammering a dead API).

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`operation timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

export class CircuitOpenError extends Error {
  retryAfterMs: number
  constructor(name: string, retryAfterMs: number) {
    super(`circuit '${name}' is open`)
    this.name = 'CircuitOpenError'
    this.retryAfterMs = retryAfterMs
  }
}

export class CircuitBreaker {
  name: string
  threshold: number
  cooldownMs: number
  private failures = 0
  private openedAt = 0
  private probing = false
  private now: () => number

  constructor(name: string, opts: { threshold?: number; cooldownMs?: number; now?: () => number } = {}) {
    this.name = name
    this.threshold = opts.threshold ?? 5
    this.cooldownMs = opts.cooldownMs ?? 30_000
    this.now = opts.now ?? Date.now
  }

  get state(): 'closed' | 'open' | 'half_open' {
    if (this.failures < this.threshold) return 'closed'
    return this.now() - this.openedAt >= this.cooldownMs ? 'half_open' : 'open'
  }

  remainingMs(): number {
    return Math.max(0, this.cooldownMs - (this.now() - this.openedAt))
  }

  /** True if a call may go out. In half_open only one probe is allowed at a time. */
  canRequest(): boolean {
    const s = this.state
    if (s === 'closed') return true
    if (s === 'open') return false
    if (this.probing) return false
    this.probing = true
    return true
  }

  success(): void {
    this.failures = 0
    this.probing = false
  }

  failure(): void {
    this.failures += 1
    this.probing = false
    if (this.failures >= this.threshold) this.openedAt = this.now()
  }
}

/** Full jitter: uniform(0, min(maxMs, baseMs * 2^attempt)). attempt starts at 0. */
export function backoffDelay(attempt: number, baseMs = 300, maxMs = 5000, random: () => number = Math.random): number {
  const cap = Math.min(maxMs, baseMs * 2 ** attempt)
  return Math.floor(random() * cap)
}

export interface RetryOptions {
  retries?: number // extra attempts after the first
  baseMs?: number
  maxMs?: number
  timeoutMs?: number // per attempt
  shouldRetry?: (e: unknown, attempt: number) => boolean
  retryAfterMs?: (e: unknown) => number | undefined // honour a server Retry-After
  breaker?: CircuitBreaker
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  onRetry?: (e: unknown, attempt: number, delayMs: number) => void
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function isNetworkError(e: unknown): boolean {
  return e instanceof TimeoutError || e instanceof TypeError || (e as any)?.name === 'AbortError'
}

async function runWithTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => {
      rej(new TimeoutError(timeoutMs)) // reject first so it wins over the abort-induced rejection
      ctrl.abort()
    }, timeoutMs)
  })
  try {
    return await Promise.race([fn(ctrl.signal), timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function withRetry<T>(fn: (signal: AbortSignal) => Promise<T>, o: RetryOptions = {}): Promise<T> {
  const retries = o.retries ?? 3
  const timeoutMs = o.timeoutMs ?? 8000
  const shouldRetry = o.shouldRetry ?? isNetworkError
  const sleep = o.sleep ?? defaultSleep
  for (let attempt = 0; ; attempt++) {
    if (o.breaker && !o.breaker.canRequest()) throw new CircuitOpenError(o.breaker.name, o.breaker.remainingMs())
    try {
      const out = await runWithTimeout(fn, timeoutMs)
      o.breaker?.success()
      return out
    } catch (e) {
      const transient = shouldRetry(e, attempt)
      if (transient) o.breaker?.failure()
      else o.breaker?.success() // a clean 4xx means the service is up
      if (!transient || attempt >= retries) throw e
      const hinted = o.retryAfterMs?.(e)
      const delay = Math.max(hinted ?? 0, backoffDelay(attempt, o.baseMs, o.maxMs, o.random))
      o.onRetry?.(e, attempt + 1, delay)
      await sleep(delay)
    }
  }
}
