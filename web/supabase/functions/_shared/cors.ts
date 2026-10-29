import { readEnv } from './env.ts'

const DEV_DEFAULTS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://localhost:3000']

const BASE_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
}

/** Pattern forms: exact origin, "*" (any), or "https://*.example.com" (one wildcard label). */
export function originMatches(origin: string, pattern: string): boolean {
  if (pattern === '*') return true
  if (!pattern.includes('*')) return origin === pattern
  const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')
  return new RegExp(`^${esc}$`, 'i').test(origin)
}

export function allowedOriginList(raw: string | undefined = readEnv('ALLOWED_ORIGINS')): string[] {
  const list = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return list.length ? list : DEV_DEFAULTS // safe default: local dev only, never "*"
}

/** Returns the CORS headers for this request. Unknown origins get no allow-origin header. */
export function corsHeaders(req: Request, list: string[] = allowedOriginList()): Record<string, string> {
  const origin = req.headers.get('origin')
  const h: Record<string, string> = { ...BASE_HEADERS }
  if (origin && list.some((p) => originMatches(origin, p))) {
    h['Access-Control-Allow-Origin'] = origin
  }
  return h
}

export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}
