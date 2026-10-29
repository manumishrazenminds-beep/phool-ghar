import { assert, test } from './_testutil.ts'
import { originMatches, corsHeaders } from './cors.ts'
import { redact } from './logger.ts'
import { amountMatches } from './payments.ts'
import { storageKey } from './idempotency.ts'
import { readJson } from './http.ts'
import { EnvError, requireEnv } from './env.ts'

test('cors allow-list: exact, wildcard label, and never reflects unknown origins', () => {
  assert.equal(originMatches('https://a.example.com', 'https://a.example.com'), true)
  assert.equal(originMatches('https://pr-1.site.pages.dev', 'https://*.site.pages.dev'), true)
  assert.equal(originMatches('https://evil.com/.site.pages.dev', 'https://*.site.pages.dev'), false)
  const mk = (o: string) => new Request('https://x.test', { headers: { origin: o } })
  assert.equal(corsHeaders(mk('https://shop.test'), ['https://shop.test'])['Access-Control-Allow-Origin'], 'https://shop.test')
  assert.equal(corsHeaders(mk('https://evil.test'), ['https://shop.test'])['Access-Control-Allow-Origin'], undefined)
})
test('logger redacts secrets and payment-ish fields, truncates long strings', () => {
  const out: any = redact({ razorpay_signature: 'abc', card: { number: '4111' }, vpa: 'a@b', ok: 1, nested: { api_key: 'k', fine: 'x' }, long: 'y'.repeat(1000) })
  assert.equal(out.razorpay_signature, '[redacted]'); assert.equal(out.card, '[redacted]'); assert.equal(out.vpa, '[redacted]')
  assert.equal(out.nested.api_key, '[redacted]'); assert.equal(out.nested.fine, 'x'); assert.equal(out.ok, 1)
  assert.ok(out.long.length < 400)
})
test('amount mismatch detection', () => {
  const row = { amount_paise: 49900, currency: 'INR' }
  assert.equal(amountMatches(row, 49900, 'INR'), true)
  assert.equal(amountMatches(row, 49800, 'INR'), false)
  assert.equal(amountMatches(row, 49900, 'USD'), false)
})
test('idempotency storage key is scoped per user', () => {
  assert.notEqual(storageKey('checkout', 'u1', 'k'), storageKey('checkout', 'u2', 'k'))
})
test('readJson enforces content type, size, and validity', async () => {
  const mk = (body: string, ct = 'application/json') => new Request('https://x.test', { method: 'POST', body, headers: { 'content-type': ct } })
  assert.deepEqual(await readJson(mk('{"a":1}')), { a: 1 })
  await assert.rejects(readJson(mk('{"a":1}', 'text/plain')), (e: any) => e.status === 415)
  await assert.rejects(readJson(mk('{bad')), (e: any) => e.status === 400)
  await assert.rejects(readJson(mk('{"a":"' + 'x'.repeat(100) + '"}'), 50), (e: any) => e.status === 413)
})
test('env is lazy and descriptive', () => {
  assert.throws(() => requireEnv('DEFINITELY_NOT_SET_XYZ', 'testing'), (e: any) => e instanceof EnvError && /DEFINITELY_NOT_SET_XYZ/.test(e.message))
})
