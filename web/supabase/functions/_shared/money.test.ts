import { assert, test } from './_testutil.ts'
import { assertPaise, formatINR, paiseEqual, paiseToRupeesString, rupeesToPaise, sumPaise } from './money.ts'

test('paise to rupees string', () => {
  assert.equal(paiseToRupeesString(0), '0.00'); assert.equal(paiseToRupeesString(5), '0.05'); assert.equal(paiseToRupeesString(12345), '123.45')
})
test('formatINR uses Indian grouping', () => {
  assert.equal(formatINR(49900), 'Rs 499.00'); assert.equal(formatINR(123456789), 'Rs 12,34,567.89'); assert.equal(formatINR(100000), 'Rs 1,000.00')
})
test('rupeesToPaise is strict', () => {
  assert.equal(rupeesToPaise('499'), 49900); assert.equal(rupeesToPaise('499.5'), 49950); assert.equal(rupeesToPaise('0.07'), 7)
  for (const bad of ['', '-1', '1.234', 'abc', '1e3', '1,000']) assert.throws(() => rupeesToPaise(bad), RangeError)
})
test('assertPaise rejects floats, negatives, NaN', () => {
  for (const bad of [1.5, -1, NaN, '5', null]) assert.throws(() => assertPaise(bad), RangeError)
  assert.equal(assertPaise(0), 0)
})
test('sum and equality', () => {
  assert.equal(sumPaise([100, 250, 1]), 351)
  assert.equal(paiseEqual(49900, 49900), true); assert.equal(paiseEqual('49900', 49900), true)
  assert.equal(paiseEqual(49900, 49901), false); assert.equal(paiseEqual(499.0, 'x'), false)
})
