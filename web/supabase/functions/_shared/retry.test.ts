import { assert, test } from './_testutil.ts'
import { CircuitBreaker, CircuitOpenError, TimeoutError, backoffDelay, withRetry } from './retry.ts'

const noSleep = () => Promise.resolve()

test('backoff grows exponentially, is capped, and is jittered within [0, cap)', () => {
  assert.equal(backoffDelay(0, 100, 5000, () => 0.999999), 99)
  assert.equal(backoffDelay(3, 100, 5000, () => 0.999999), 799)
  assert.equal(backoffDelay(10, 100, 5000, () => 0.999999), 4999)
  assert.equal(backoffDelay(5, 100, 5000, () => 0), 0)
})
test('retries transient errors then succeeds', async () => {
  let n = 0
  const delays: number[] = []
  const out = await withRetry(async () => { if (++n < 3) throw new TypeError('network'); return 'ok' }, {
    retries: 3, sleep: async (ms) => { delays.push(ms) }, random: () => 0.5, baseMs: 100,
  })
  assert.equal(out, 'ok'); assert.equal(n, 3); assert.deepEqual(delays, [50, 100])
})
test('does not retry non-transient errors', async () => {
  let n = 0
  await assert.rejects(withRetry(async () => { n++; throw new Error('bad request') }, { sleep: noSleep }), /bad request/)
  assert.equal(n, 1)
})
test('gives up after retries', async () => {
  let n = 0
  await assert.rejects(withRetry(async () => { n++; throw new TypeError('down') }, { retries: 2, sleep: noSleep }), TypeError)
  assert.equal(n, 3)
})
test('honours server retry-after as a floor', async () => {
  const delays: number[] = []
  let n = 0
  await withRetry(async () => { if (++n < 2) throw new TypeError('x'); return 1 }, {
    sleep: async (ms) => { delays.push(ms) }, random: () => 0, retryAfterMs: () => 2000,
  })
  assert.deepEqual(delays, [2000])
})
test('per-attempt timeout aborts', async () => {
  await assert.rejects(withRetry((signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))), { retries: 0, timeoutMs: 20 }), TimeoutError)
})
test('circuit breaker opens, blocks, half-opens, closes', async () => {
  let t = 0
  const b = new CircuitBreaker('t', { threshold: 2, cooldownMs: 1000, now: () => t })
  const fail = () => withRetry(async () => { throw new TypeError('down') }, { retries: 0, breaker: b, sleep: noSleep })
  await assert.rejects(fail(), TypeError)
  await assert.rejects(fail(), TypeError)
  assert.equal(b.state, 'open')
  await assert.rejects(fail(), CircuitOpenError)
  t = 1500
  assert.equal(b.state, 'half_open')
  assert.equal(await withRetry(async () => 'up', { breaker: b }), 'up')
  assert.equal(b.state, 'closed')
})
test('half-open allows a single probe', () => {
  let t = 0
  const b = new CircuitBreaker('t', { threshold: 1, cooldownMs: 10, now: () => t })
  b.failure(); t = 20
  assert.equal(b.canRequest(), true)
  assert.equal(b.canRequest(), false)
})
