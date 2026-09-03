import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatCount, formatTaka } from './tokens'

describe('formatTaka', () => {
  it('groups in lakh/crore, not thousands', () => {
    assert.equal(formatTaka(360000), '৳3,60,000')
    assert.equal(formatTaka(21400800), '৳2,14,00,800')
  })

  it('rounds to whole taka and survives junk', () => {
    assert.equal(formatTaka(1849.6), '৳1,850')
    assert.equal(formatTaka(Number.NaN), '৳0')
  })
})

describe('formatCount', () => {
  it('uses the same grouping money uses', () => {
    assert.equal(formatCount(2418), '2,418')
    assert.equal(formatCount(2418000), '24,18,000')
  })

  it('never prints a bare unformatted number', () => {
    // The Operations Hub used to render `String(available)` and print `2418`
    // next to the `2,418` on the screen it links to.
    assert.notEqual(formatCount(2418), '2418')
  })

  it('falls back to zero rather than NaN', () => {
    assert.equal(formatCount(Number.NaN), '0')
    assert.equal(formatCount(0), '0')
  })
})
