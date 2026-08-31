import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { mediaIdentity } from './media-url'

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
