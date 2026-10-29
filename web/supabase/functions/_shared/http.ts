import { corsHeaders } from './cors.ts'

export class HttpError extends Error {
  status: number
  code: string
  retryAfterSec?: number
  extra?: Record<string, unknown>
  constructor(status: number, code: string, message: string, opts: { retryAfterSec?: number; extra?: Record<string, unknown> } = {}) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.retryAfterSec = opts.retryAfterSec
    this.extra = opts.extra
  }
}

function baseHeaders(req: Request, extra: Record<string, string> = {}): Headers {
  const h = new Headers({
    ...corsHeaders(req),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  })
  return h
}

/** Success envelope: { data }. */
export function ok(req: Request, data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ data }), { status, headers: baseHeaders(req, headers) })
}

/** Error envelope: { error: { code, message } }. */
export function fail(
  req: Request,
  status: number,
  code: string,
  message: string,
  opts: { retryAfterSec?: number; headers?: Record<string, string> } = {},
): Response {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (opts.retryAfterSec) headers['Retry-After'] = String(Math.ceil(opts.retryAfterSec))
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers: baseHeaders(req, headers) })
}

export function failFromError(req: Request, e: HttpError): Response {
  return fail(req, e.status, e.code, e.message, { retryAfterSec: e.retryAfterSec })
}

/**
 * Read the raw body as text with a hard byte cap. Checks Content-Length first, then enforces
 * the cap while streaming so a lying or chunked client cannot exceed it.
 */
export async function readBodyText(req: Request, maxBytes = 32 * 1024): Promise<string> {
  const declared = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, 'payload_too_large', `Request body must be at most ${maxBytes} bytes`)
  }
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      try { await reader.cancel() } catch { /* ignore */ }
      throw new HttpError(413, 'payload_too_large', `Request body must be at most ${maxBytes} bytes`)
    }
    chunks.push(value)
  }
  const buf = new Uint8Array(total)
  let o = 0
  for (const c of chunks) { buf.set(c, o); o += c.byteLength }
  return new TextDecoder().decode(buf)
}

export async function readJson(req: Request, maxBytes = 32 * 1024): Promise<unknown> {
  const ct = req.headers.get('content-type') ?? ''
  if (!ct.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json')
  }
  const text = await readBodyText(req, maxBytes)
  if (!text) throw new HttpError(400, 'invalid_json', 'Request body is empty')
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body is not valid JSON')
  }
}

export function newRequestId(): string {
  return crypto.randomUUID()
}
