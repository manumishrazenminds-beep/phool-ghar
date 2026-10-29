import { corsHeaders, preflight } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/supabase.ts'

// Cached for a few seconds so uptime monitors and load balancers cannot turn health checks into DB load.
let last: { at: number; db: boolean } | null = null
const TTL_MS = 5000

async function checkDb(): Promise<boolean> {
  if (last && Date.now() - last.at < TTL_MS) return last.db
  let db = false
  try {
    const { error } = await serviceClient().from('app_settings').select('key').limit(1)
    db = !error
  } catch {
    db = false // includes missing env: the function still boots and reports db:false
  }
  last = { at: Date.now(), db }
  return db
}

async function handle(req: Request): Promise<Response> {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: { code: 'method_not_allowed', message: 'Use GET' } }), {
      status: 405,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json', Allow: 'GET, HEAD' },
    })
  }
  const db = await checkDb()
  // Shape per contract: { ok, time, db }. Mirrored under data for envelope-aware clients.
  const body = { ok: db, time: new Date().toISOString(), db }
  return new Response(req.method === 'HEAD' ? null : JSON.stringify({ ...body, data: body }), {
    status: db ? 200 : 503,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

Deno.serve(handle)
