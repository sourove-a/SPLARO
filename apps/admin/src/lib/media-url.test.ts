import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { hiddenMediaKeys, mediaIdentity } from './media-url'

describe('mediaIdentity', () => {
  it('matches absolute and root-relative versions of the same upload', () => {
    assert.equal(
      mediaIdentity('https://splaro.co/uploads/products-men/shirt.webp?width=1200'),
      mediaIdentity('/uploads/products-men/shirt.webp'),
    )
  })

  it('returns an empty identity for blank values', () => {
    assert.equal(mediaIdentity('  '), '')
  })
})

describe('hiddenMediaKeys', () => {
  const own = ['/uploads/products-men/own.webp']
  const used = ['https://splaro.co/uploads/products-men/other-product.webp?width=1200']

  it('hides this product photos and every catalogue photo by default', () => {
    const keys = hiddenMediaKeys(own, used, false)
    assert.ok(keys.has(mediaIdentity('/uploads/products-men/own.webp')))
    assert.ok(keys.has(mediaIdentity('/uploads/products-men/other-product.webp')))
  })

  it('keeps this product photos hidden when used photos are shown', () => {
    const keys = hiddenMediaKeys(own, used, true)
    assert.ok(keys.has(mediaIdentity('/uploads/products-men/own.webp')))
    assert.equal(keys.has(mediaIdentity('/uploads/products-men/other-product.webp')), false)
  })

  it('drops blank entries instead of hiding everything', () => {
    assert.equal(hiddenMediaKeys(['', '  '], [], false).size, 0)
  })
})
