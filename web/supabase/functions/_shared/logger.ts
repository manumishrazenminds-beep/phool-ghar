import { readEnv } from './env.ts'

export type Level = 'debug' | 'info' | 'warn' | 'error'
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

// Any key matching this is replaced wholesale. Card and payment payloads are never logged:
// callers pass small summaries, and this is the safety net behind them.
const SENSITIVE_KEY =
  /secret|signature|token|password|passwd|authorization|api[-_]?key|apikey|cookie|card|cvv|cvc|pan|vpa|upi|bank|account_number|ifsc|otp|raw|email|contact|phone|address/i

const MAX_STR = 300
const MAX_DEPTH = 4
const MAX_KEYS = 30

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return value.length > MAX_STR ? value.slice(0, MAX_STR) + '...[truncated]' : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Error) return { name: value.name, message: redact(value.message) }
  if (depth >= MAX_DEPTH) return '[depth]'
  if (Array.isArray(value)) return value.slice(0, 10).map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1)
    }
    return out
  }
  return String(value)
}

export interface LogCtx {
  source: string
  requestId?: string
  actor?: string | null
  url?: string
  userAgent?: string | null
}

export function ctxFromRequest(source: string, req: Request, requestId?: string, actor?: string | null): LogCtx {
  let url = req.url
  try { const u = new URL(req.url); url = u.pathname } catch { /* keep */ }
  return { source, requestId, actor: actor ?? null, url, userAgent: (req.headers.get('user-agent') ?? '').slice(0, 200) || null }
}

export async function log(level: Level, ctx: LogCtx, code: string, message: string, detail: Record<string, unknown> = {}): Promise<void> {
  const min = (ORDER as Record<string, number>)[readEnv('LOG_LEVEL')?.toLowerCase() ?? 'info'] ?? 20
  if (ORDER[level] < min) return
  const safeDetail = redact({ ...detail, request_id: ctx.requestId }) as Record<string, unknown>
  const line = { level, source: ctx.source, code, message: String(message).slice(0, 500), detail: safeDetail }
  // stdout always (Supabase function logs), DB for warn+ so app_logs stays small on the free tier.
  console.log(JSON.stringify(line))
  if (ORDER[level] < ORDER.warn) return
  try {
    const { serviceClient } = await import('./supabase.ts')
    await serviceClient().from('app_logs').insert({
      level,
      source: ctx.source,
      code,
      message: line.message,
      detail: safeDetail,
      actor: ctx.actor ?? null,
      url: ctx.url ?? null,
      user_agent: ctx.userAgent ?? null,
    })
  } catch (e) {
    console.log(JSON.stringify({ level: 'error', source: 'logger', code: 'log_write_failed', message: String((e as Error)?.message ?? e).slice(0, 200) }))
  }
}

export function makeLogger(ctx: LogCtx) {
  return {
    debug: (code: string, msg: string, d?: Record<string, unknown>) => log('debug', ctx, code, msg, d),
    info: (code: string, msg: string, d?: Record<string, unknown>) => log('info', ctx, code, msg, d),
    warn: (code: string, msg: string, d?: Record<string, unknown>) => log('warn', ctx, code, msg, d),
    error: (code: string, msg: string, d?: Record<string, unknown>) => log('error', ctx, code, msg, d),
  }
}
export type Logger = ReturnType<typeof makeLogger>
