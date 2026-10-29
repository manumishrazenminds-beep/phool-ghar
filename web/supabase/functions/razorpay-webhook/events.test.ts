import { assert, test } from '../_shared/_testutil.ts'
import { eventAgeSec, eventId, paymentEntity } from './events.ts'

test('event id prefers the header, falls back to a stable body hash', async () => {
  assert.equal(await eventId('evt_ABC12345', '{}'), 'evt_ABC12345')
  const a = await eventId(null, '{"x":1}')
  assert.equal(a, await eventId('', '{"x":1}'))
  assert.notEqual(a, await eventId(null, '{"x":2}'))
  assert.ok(a.startsWith('h_'))
})
test('entity extraction and age', () => {
  assert.equal(paymentEntity({ payload: { payment: { entity: { id: 'pay_1' } } } }).id, 'pay_1')
  assert.equal(paymentEntity({}), null)
  assert.equal(eventAgeSec({ created_at: 1000 }, 1_600_000), 600)
  assert.equal(eventAgeSec({}, 5), 0)
})
