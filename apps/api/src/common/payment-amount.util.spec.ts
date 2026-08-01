import {
  PAYMENT_AMOUNT_TOLERANCE,
  isUnderpayment,
  paymentAmountMatches,
} from './payment-amount.util'

describe('payment amount tolerance', () => {
  it('is 0.01, not 1 — a 1 BDT shortfall on every order is not rounding', () => {
    expect(PAYMENT_AMOUNT_TOLERANCE).toBe(0.01)
  })

  describe('paymentAmountMatches', () => {
    it('accepts an exact amount', () => {
      expect(paymentAmountMatches(1499, 1499)).toBe(true)
    })

    it('absorbs float representation error at the tolerance edge', () => {
      expect(paymentAmountMatches(1499.005, 1499)).toBe(true)
      expect(paymentAmountMatches(1499, 1499.01)).toBe(true)
    })

    it('rejects the 1 BDT shortfall the old ±1 guard allowed', () => {
      expect(paymentAmountMatches(1498, 1499)).toBe(false)
    })

    it('rejects overpayment beyond tolerance', () => {
      expect(paymentAmountMatches(1500, 1499)).toBe(false)
    })

    it('rejects a non-finite paid amount', () => {
      expect(paymentAmountMatches(Number.NaN, 1499)).toBe(false)
      expect(paymentAmountMatches(Number.POSITIVE_INFINITY, 1499)).toBe(false)
    })
  })

  describe('isUnderpayment', () => {
    it('flags a 1 BDT shortfall', () => {
      expect(isUnderpayment(1498, 1499)).toBe(true)
    })

    it('does not flag an exact or over payment', () => {
      expect(isUnderpayment(1499, 1499)).toBe(false)
      expect(isUnderpayment(1600, 1499)).toBe(false)
    })

    it('treats an unparseable amount as underpayment', () => {
      expect(isUnderpayment(Number.NaN, 1499)).toBe(true)
    })
  })
})
