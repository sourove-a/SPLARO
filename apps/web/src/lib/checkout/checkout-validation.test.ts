import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getCheckoutProgressLine,
  getCheckoutStepStatuses,
  getCheckoutSteps,
} from './checkout-validation'

describe('getCheckoutSteps', () => {
  it('uses Delivery → Confirm when only COD is available', () => {
    assert.deepEqual(getCheckoutSteps(false, true), ['Delivery', 'Confirm'])
  })

  it('inserts Promo between Delivery and Confirm for COD-only', () => {
    assert.deepEqual(getCheckoutSteps(true, true), ['Delivery', 'Promo code', 'Confirm'])
  })

  it('keeps Delivery → Payment → Confirm when digital methods exist', () => {
    assert.deepEqual(getCheckoutSteps(false, false), ['Delivery', 'Payment', 'Confirm'])
  })
})

describe('getCheckoutStepStatuses', () => {
  it('marks Confirm active after delivery for COD-only without paymentEngaged', () => {
    assert.deepEqual(
      getCheckoutStepStatuses(true, false, false, false, true),
      ['complete', 'active'],
    )
  })

  it('keeps Confirm active while submitting COD-only', () => {
    assert.deepEqual(
      getCheckoutStepStatuses(true, false, true, false, true),
      ['complete', 'active'],
    )
  })

  it('waits on paymentEngaged for digital Payment step', () => {
    assert.deepEqual(
      getCheckoutStepStatuses(true, false, false, false, false),
      ['complete', 'active', 'pending'],
    )
  })
})

describe('getCheckoutProgressLine', () => {
  it('fills the first half while COD-only delivery is in progress', () => {
    assert.equal(getCheckoutProgressLine(false, 0.5, false, true), 25)
  })

  it('reaches 100 once delivery is complete', () => {
    assert.equal(getCheckoutProgressLine(true, 1, false, true), 100)
  })
})
