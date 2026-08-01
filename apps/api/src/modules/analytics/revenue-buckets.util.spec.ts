import { buildRevenueBuckets } from './revenue-buckets.util'

const at = (iso: string, total: number) => ({ total, createdAt: new Date(iso) })

/** Every date in a day-grouped series must be exactly one day after the last. */
function isContiguousByDay(rows: { date: string }[]): boolean {
  for (let i = 1; i < rows.length; i += 1) {
    const prev = Date.parse(`${rows[i - 1]!.date}T00:00:00Z`)
    const cur = Date.parse(`${rows[i]!.date}T00:00:00Z`)
    if (cur - prev !== 86_400_000) return false
  }
  return true
}

describe('buildRevenueBuckets', () => {
  const since = new Date('2026-07-01T09:30:00Z')
  const until = new Date('2026-07-07T18:00:00Z')

  it('emits one bucket per day inclusive of both ends', () => {
    const rows = buildRevenueBuckets([], since, until)
    expect(rows).toHaveLength(7)
    expect(rows[0]!.date).toBe('2026-07-01')
    expect(rows[6]!.date).toBe('2026-07-07')
    expect(isContiguousByDay(rows)).toBe(true)
  })

  it('leaves quiet days at zero instead of dropping them', () => {
    const rows = buildRevenueBuckets(
      [at('2026-07-01T10:00:00Z', 1000), at('2026-07-05T10:00:00Z', 2500)],
      since,
      until,
    )
    expect(rows).toHaveLength(7)
    expect(isContiguousByDay(rows)).toBe(true)
    expect(rows.map((r) => r.revenue)).toEqual([1000, 0, 0, 0, 2500, 0, 0])
    expect(rows.filter((r) => r.orders === 0)).toHaveLength(5)
  })

  it('sums several orders landing on the same day', () => {
    const rows = buildRevenueBuckets(
      [
        at('2026-07-03T01:00:00Z', 500),
        at('2026-07-03T13:00:00Z', 700),
        at('2026-07-03T23:59:00Z', 300),
      ],
      since,
      until,
    )
    const third = rows.find((r) => r.date === '2026-07-03')
    expect(third).toEqual({ date: '2026-07-03', revenue: 1500, orders: 3 })
  })

  it('coerces Prisma Decimal-like totals', () => {
    const rows = buildRevenueBuckets(
      [{ total: '1250.50', createdAt: new Date('2026-07-02T10:00:00Z') }],
      since,
      until,
    )
    expect(rows.find((r) => r.date === '2026-07-02')!.revenue).toBe(1250.5)
  })

  it('groups by calendar month when asked', () => {
    const rows = buildRevenueBuckets(
      [at('2026-05-04T10:00:00Z', 100), at('2026-07-09T10:00:00Z', 900)],
      new Date('2026-05-20T00:00:00Z'),
      new Date('2026-07-14T00:00:00Z'),
      'month',
    )
    expect(rows.map((r) => r.date)).toEqual(['2026-05', '2026-06', '2026-07'])
    expect(rows.map((r) => r.revenue)).toEqual([100, 0, 900])
  })

  it('keeps revenue from an order that falls outside the seeded window', () => {
    // Dropping it would quietly under-report the total the chart footer shows.
    const rows = buildRevenueBuckets([at('2026-06-28T10:00:00Z', 400)], since, until)
    expect(rows.find((r) => r.date === '2026-06-28')).toEqual({
      date: '2026-06-28',
      revenue: 400,
      orders: 1,
    })
    expect(rows[0]!.date).toBe('2026-06-28')
  })

  it('returns a single bucket when the window is one day', () => {
    const day = new Date('2026-07-04T12:00:00Z')
    expect(buildRevenueBuckets([], day, day)).toHaveLength(1)
  })
})
