import { resolveFinanceWindow } from './finance-window.util'

describe('resolveFinanceWindow', () => {
  const now = new Date('2026-08-10T15:30:00+06:00')

  it('today is the current local day', () => {
    const w = resolveFinanceWindow({ preset: 'today', now })
    expect(w.from.getHours()).toBe(0)
    expect(w.to.getHours()).toBe(23)
    expect(w.from.toDateString()).toBe(now.toDateString())
  })

  it('yesterday is the previous full day', () => {
    const w = resolveFinanceWindow({ preset: 'yesterday', now })
    expect(w.from.toDateString()).toBe(w.to.toDateString())
    expect(w.to.getTime()).toBeLessThan(now.getTime())
  })

  it('7d spans about a week ending today', () => {
    const w = resolveFinanceWindow({ preset: '7d', now })
    const days = (w.to.getTime() - w.from.getTime()) / 86_400_000
    expect(days).toBeGreaterThan(5)
    expect(days).toBeLessThan(8)
    expect(w.to.toDateString()).toBe(now.toDateString())
  })

  it('this_month starts on the 1st', () => {
    const w = resolveFinanceWindow({ preset: 'this_month', now })
    expect(w.from.getDate()).toBe(1)
    expect(w.from.getMonth()).toBe(now.getMonth())
  })

  it('custom from/to is honoured', () => {
    const w = resolveFinanceWindow({ preset: 'custom', from: '2026-08-01', to: '2026-08-05', now })
    expect(w.from.getTime()).toBeLessThanOrEqual(w.to.getTime())
    expect(w.to.getTime() - w.from.getTime()).toBeGreaterThan(3 * 86_400_000)
  })
})
