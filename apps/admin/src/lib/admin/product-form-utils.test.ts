import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  discountPercentFromPrices,
  displayPriceFields,
  resolveSellingPrices,
  salePriceFromDiscountPercent,
} from './product-form-utils'

describe('product prices', () => {
  it('saves sale as the selling price and main as compare-at', () => {
    const out = resolveSellingPrices('5000', '4000')
    assert.equal(out.sellingPrice, 4000)
    assert.equal(out.compareAt, 5000)
  })

  it('has no compare-at when sale is empty', () => {
    const out = resolveSellingPrices('5000', '')
    assert.equal(out.sellingPrice, 5000)
    assert.equal(out.compareAt, undefined)
  })

  it('shows auto discount from main + sale', () => {
    assert.equal(discountPercentFromPrices('5000', '4000'), 20)
    assert.equal(discountPercentFromPrices('5000', ''), null)
    assert.equal(discountPercentFromPrices('4000', '5000'), null)
  })

  it('applies a percent onto main to get sale', () => {
    assert.equal(salePriceFromDiscountPercent('5000', '20'), '4000')
    assert.equal(salePriceFromDiscountPercent('5000', ''), '')
  })

  it('reloads API prices back into main + sale fields', () => {
    assert.deepEqual(displayPriceFields(4000, 5000), { regular: '5000', sale: '4000' })
    assert.deepEqual(displayPriceFields(5000, null), { regular: '5000', sale: '' })
  })
})
