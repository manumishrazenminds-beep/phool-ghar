import { assert, test } from './_testutil.ts'
import { clientIp, enforceRateLimit, rlKey } from './ratelimit.ts'

const req = (h: Record<string, string>) => new Request('https://x.test/', { headers: h })

test('rlKey is namespaced and sanitised', () => {
  assert.equal(rlKey('checkout', 'user', 'abc-123'), 'rl:checkout:user:abc-123')
  assert.equal(rlKey('checkout', 'ip', '1.2.3.4'), 'rl:checkout:ip:1.2.3.4')
  assert.equal(rlKey('a b', 'ip', 'x y/z'), 'rl:a_b:ip:x_y_z')
  assert.ok(rlKey('s', 'user', 'x'.repeat(500)).length < 120)
})
test('clientIp precedence', () => {
  assert.equal(clientIp(req({ 'cf-connecting-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1' })), '9.9.9.9')
  assert.equal(clientIp(req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })), '1.1.1.1')
  assert.equal(clientIp(req({})), 'unknown')
})
const fakeDb = (results: Record<string, boolean | Error>) => ({
  rpc: async (_n: string, a: any) => {
    const r = results[a.p_key] ?? true
    return r instanceof Error ? { data: null, error: { message: r.message } } : { data: r, error: null }
  },
})
test('enforce: blocks with 429 when over the limit', async () => {
  const db = fakeDb({ 'rl:s:user:u1': false })
  await assert.rejects(enforceRateLimit(db, req({ 'cf-connecting-ip': '1.1.1.1' }), { scope: 's', userId: 'u1', user: { max: 1, windowSec: 60 }, ip: { max: 5, windowSec: 60 } }), (e: any) => e.status === 429 && e.retryAfterSec === 60)
})
test('enforce: allows when under, and fails open on limiter error', async () => {
  await enforceRateLimit(fakeDb({}), req({}), { scope: 's', userId: 'u1', user: { max: 1, windowSec: 60 }, ip: { max: 5, windowSec: 60 } })
  let reported = 0
  await enforceRateLimit(fakeDb({ 'rl:s:ip:unknown': new Error('db down') }), req({}), { scope: 's', ip: { max: 5, windowSec: 60 }, onError: () => { reported++ } })
  assert.equal(reported, 1)
})
