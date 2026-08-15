import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldFillCheckoutField } from './customer-draft'

describe('shouldFillCheckoutField', () => {
  it('fills empty pristine fields', () => {
    assert.equal(shouldFillCheckoutField('', 'Ayesha', false), true)
  })

  it('does not overwrite typed values', () => {
    assert.equal(shouldFillCheckoutField('Karim', 'Ayesha', false), false)
  })

  it('does not refill a field the shopper cleared', () => {
    assert.equal(shouldFillCheckoutField('', 'Ayesha', true), false)
  })
})
