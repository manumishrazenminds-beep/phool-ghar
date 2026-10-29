import { assert, test } from './_testutil.ts'
import { RE, arr, dateStr, reqInt, reqStr } from './validate.ts'
import { parseBody } from '../checkout-create/parse.ts'

test('validators', () => {
  assert.equal(dateStr('2026-10-24', 'd'), '2026-10-24')
  assert.throws(() => dateStr('2026-02-30', 'd'), (e: any) => e.status === 400)
  assert.throws(() => reqInt(1.5, 'n'), (e: any) => e.code === 'invalid_input')
  assert.throws(() => reqStr('x', 's', { min: 3 }))
  assert.throws(() => arr([1, 2, 3], 'a', { max: 2 }))
  assert.ok(RE.rzpOrder.test('order_Nabc123XYZ'))
})
test('checkout body parsing', () => {
  const ok = parseBody({
    idempotency_key: 'abcdefgh-1234', slot_id: 'morning', date: '2026-10-25', coupon_code: 'welcome10',
    lines: [{ product_slug: 'rose-bouquet', qty: 2 }], address: { recipient_name: 'Asha', recipient_phone: '+919999999999', line1: '12 MG Road', pincode: '560001' },
  })
  assert.equal(ok.payload.coupon_code, 'WELCOME10')
  assert.throws(() => parseBody({ idempotency_key: 'short', slot_id: 'morning', lines: [] }))
  assert.throws(() => parseBody({ idempotency_key: 'abcdefgh-1234', slot_id: 'morning', date: '2026-10-25', lines: [{ qty: 1 }], address_id: '11111111-1111-1111-1111-111111111111' }), (e: any) => /product_id/.test(e.message))
  assert.throws(() => parseBody({ idempotency_key: 'abcdefgh-1234', slot_id: 'morning', date: '2026-10-25', lines: [{ product_slug: 'a', qty: 1 }] }), (e: any) => /address/.test(e.message))
})
