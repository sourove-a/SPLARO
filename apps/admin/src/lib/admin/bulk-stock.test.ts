import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { clampStock, parseBulkStock } from './bulk-stock'

const SIZES = ['S', 'M', 'L', 'XL']

describe('parseBulkStock', () => {
  it('reads the "S 10, M 20" shape a supplier actually sends', () => {
    const { entries, ignored, positional } = parseBulkStock('S 10, M 20, L 15', SIZES)
    assert.equal(positional, false)
    assert.deepEqual(ignored, [])
    assert.deepEqual(entries, [
      { size: 'S', qty: 10, raw: 'S 10', matched: true },
      { size: 'M', qty: 20, raw: 'M 20', matched: true },
      { size: 'L', qty: 15, raw: 'L 15', matched: true },
    ])
  })

  it('accepts =, :, - and x between size and quantity', () => {
    const { entries } = parseBulkStock('S=10\nM:20\nL-5\nXL x7', SIZES)
    assert.deepEqual(
      entries.map((e) => [e.size, e.qty]),
      [
        ['S', 10],
        ['M', 20],
        ['L', 5],
        ['XL', 7],
      ],
    )
  })

  it('matches sizes case- and space-insensitively', () => {
    const { entries } = parseBulkStock('xl 4', SIZES)
    assert.equal(entries[0]?.size, 'XL')
    assert.equal(entries[0]?.matched, true)
  })

  it('flags a size outside the run instead of inventing one', () => {
    const { entries } = parseBulkStock('XXL 9', SIZES)
    assert.equal(entries[0]?.size, 'XXL')
    assert.equal(entries[0]?.matched, false)
  })

  it('maps a list of bare numbers onto the size run in order', () => {
    const { entries, positional } = parseBulkStock('10, 20, 5, 2', SIZES)
    assert.equal(positional, true)
    assert.deepEqual(
      entries.map((e) => [e.size, e.qty]),
      [
        ['S', 10],
        ['M', 20],
        ['L', 5],
        ['XL', 2],
      ],
    )
  })

  it('drops extra bare numbers rather than writing them to nothing', () => {
    const { entries, ignored } = parseBulkStock('10, 20, 5, 2, 99', SIZES)
    assert.equal(entries.length, 4)
    assert.deepEqual(ignored, ['99'])
  })

  it('ignores tokens with no quantity', () => {
    const { entries, ignored } = parseBulkStock('S 10, restock soon', SIZES)
    assert.equal(entries.length, 1)
    assert.deepEqual(ignored, ['restock soon'])
  })

  it('returns nothing for empty input', () => {
    assert.deepEqual(parseBulkStock('   ', SIZES), { entries: [], ignored: [], positional: false })
  })
})

describe('clampStock', () => {
  it('keeps quantities inside the range the matrix stores', () => {
    assert.equal(clampStock(-5), 0)
    assert.equal(clampStock(12.4), 12)
    assert.equal(clampStock(10_000_000), 999999)
    assert.equal(clampStock(Number.NaN), 0)
  })
})
