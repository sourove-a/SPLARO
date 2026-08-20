import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isProfitLossEmpty } from './profit-loss-view'

describe('isProfitLossEmpty', () => {
  it('treats 0 orders and 0 revenue as empty, not break-even', () => {
    assert.equal(isProfitLossEmpty(0, 0), true)
  })

  it('keeps a real zero-margin period with orders', () => {
    assert.equal(isProfitLossEmpty(4, 0), false)
  })
})
