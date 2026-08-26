import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { pageTitleSegment } from './page-title'

describe('pageTitleSegment', () => {
  it('strips a whole brand suffix so the template can add it back once', () => {
    assert.equal(pageTitleSegment('Shop — SPLARO'), 'Shop')
    assert.equal(pageTitleSegment('Shop | SPLARO'), 'Shop')
    assert.equal(pageTitleSegment('Shop | SPLARO Bangladesh'), 'Shop')
  })

  it('strips a brand suffix that was cut off by a length budget', () => {
    // Shipped as "… | SPLAR | SPLARO" before this was handled.
    assert.equal(
      pageTitleSegment('Onitsuka Tiger Mexico 66 Style Retro Casual Sneakers | SPLAR'),
      'Onitsuka Tiger Mexico 66 Style Retro Casual Sneakers',
    )
    assert.equal(pageTitleSegment('Shop | SPLA'), 'Shop')
    assert.equal(pageTitleSegment('Shop | SPL'), 'Shop')
  })

  it('keeps a trailing single letter that is not a brand fragment', () => {
    assert.equal(pageTitleSegment('Tees — S'), 'Tees — S')
    assert.equal(pageTitleSegment('Sizes | SP'), 'Sizes | SP')
  })

  it('leaves a brand mention that is not a suffix alone', () => {
    assert.equal(pageTitleSegment('SPLARO Journal'), 'SPLARO Journal')
    assert.equal(pageTitleSegment('About SPLARO and its makers'), 'About SPLARO and its makers')
  })

  it('returns empty for blank input', () => {
    assert.equal(pageTitleSegment(''), '')
    assert.equal(pageTitleSegment('   '), '')
    assert.equal(pageTitleSegment(null), '')
    assert.equal(pageTitleSegment(undefined), '')
  })
})
