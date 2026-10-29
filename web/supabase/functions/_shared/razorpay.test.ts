import { assert, test } from './_testutil.ts'
import { hmacSha256Hex, timingSafeEqual, verifyCheckoutSignature, verifyWebhookSignature } from './razorpay.ts'

// Vectors generated independently with: printf '<msg>' | openssl dgst -sha256 -hmac '<secret>'
const CHECKOUT_SIG = '85cbc6036124891c4d0280fbb7cd83804f87a66f2eb485a89af574086f592cbc'
const WEBHOOK_BODY = '{"event":"payment.captured"}'
const WEBHOOK_SIG = '4f463a57dd128675850163391f0311888616d57bccca75c774c9cdb28134f851'

test('hmac matches openssl vector', async () => {
  assert.equal(await hmacSha256Hex('test_secret', 'order_ABC123|pay_XYZ789'), CHECKOUT_SIG)
})
test('checkout signature accepts the valid vector (any case)', async () => {
  assert.equal(await verifyCheckoutSignature('order_ABC123', 'pay_XYZ789', CHECKOUT_SIG, 'test_secret'), true)
  assert.equal(await verifyCheckoutSignature('order_ABC123', 'pay_XYZ789', CHECKOUT_SIG.toUpperCase(), 'test_secret'), true)
})
test('checkout signature rejects tampering', async () => {
  assert.equal(await verifyCheckoutSignature('order_ABC124', 'pay_XYZ789', CHECKOUT_SIG, 'test_secret'), false)
  assert.equal(await verifyCheckoutSignature('order_ABC123', 'pay_XYZ789', CHECKOUT_SIG, 'other_secret'), false)
  assert.equal(await verifyCheckoutSignature('order_ABC123', 'pay_XYZ789', CHECKOUT_SIG.slice(0, 63) + '0', 'test_secret'), false)
  assert.equal(await verifyCheckoutSignature('order_ABC123', 'pay_XYZ789', '', 'test_secret'), false)
})
test('webhook signature uses raw body', async () => {
  assert.equal(await verifyWebhookSignature(WEBHOOK_BODY, WEBHOOK_SIG, 'whsec_test'), true)
  assert.equal(await verifyWebhookSignature(WEBHOOK_BODY + ' ', WEBHOOK_SIG, 'whsec_test'), false)
  assert.equal(await verifyWebhookSignature(WEBHOOK_BODY, null, 'whsec_test'), false)
})
test('timingSafeEqual', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true)
  assert.equal(timingSafeEqual('abc', 'abd'), false)
  assert.equal(timingSafeEqual('abc', 'abcd'), false)
  assert.equal(timingSafeEqual('', ''), true)
})
