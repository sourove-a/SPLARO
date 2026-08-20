import { createdAtRange, parseDhakaDayEnd, parseDhakaDayStart } from './created-at-range.util'

describe('createdAtRange', () => {
  it('maps YYYY-MM-DD to inclusive Asia/Dhaka bounds', () => {
    expect(parseDhakaDayStart('2026-08-01')?.toISOString()).toBe('2026-07-31T18:00:00.000Z')
    expect(parseDhakaDayEnd('2026-08-01')?.toISOString()).toBe('2026-08-01T17:59:59.999Z')
  })

  it('returns undefined when both sides are empty or invalid', () => {
    expect(createdAtRange()).toBeUndefined()
    expect(createdAtRange('', 'not-a-date')).toBeUndefined()
  })

  it('swaps inverted from/to', () => {
    const range = createdAtRange('2026-08-10', '2026-08-01')
    expect(range?.gte?.toISOString()).toBe('2026-07-31T18:00:00.000Z')
    expect(range?.lte?.toISOString()).toBe('2026-08-10T17:59:59.999Z')
  })
})
