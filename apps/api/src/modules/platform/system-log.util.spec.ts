import {
  dedupeTelegramTestSuccess,
  filterSystemLogs,
  formatAbsoluteDhaka,
  formatLogWhen,
  mapAuditLevel,
  paginateSystemLogs,
  relTime,
  type SystemLogRow,
} from './system-log.util'

describe('system-log.util', () => {
  it('formats relative and absolute Dhaka timestamps together', () => {
    const date = new Date('2026-08-19T07:45:22.000Z')
    expect(formatAbsoluteDhaka(date)).toBe('19 Aug 2026, 13:45:22')
    expect(formatLogWhen(date, new Date('2026-08-19T07:57:22.000Z'))).toBe(
      '12m ago · 19 Aug 2026, 13:45:22',
    )
    expect(relTime(date, new Date('2026-08-19T07:45:40.000Z'))).toBe('Just now')
  })

  it('maps audit actions onto info/warning/error/critical', () => {
    expect(mapAuditLevel('EXPORT')).toBe('info')
    expect(mapAuditLevel('TEST_SUCCESS')).toBe('info')
    expect(mapAuditLevel('TEST_FAILED')).toBe('error')
    expect(mapAuditLevel('WARN_RETRY')).toBe('warning')
    expect(mapAuditLevel('IP_BLOCKED')).toBe('critical')
  })

  it('collapses repeated Telegram TEST_SUCCESS pings inside the window', () => {
    const base = Date.now()
    const rows: SystemLogRow[] = [0, 2, 4, 6].map((mins, i) => ({
      id: `tg-${i}`,
      level: 'info',
      msg: 'TEST_SUCCESS · integrations/telegram',
      time: '',
      createdAt: new Date(base - mins * 60_000),
      action: 'TEST_SUCCESS',
      resource: 'telegram',
    }))
    const deduped = dedupeTelegramTestSuccess(rows)
    expect(deduped).toHaveLength(1)
    expect(deduped[0]?.msg).toContain('×4')
  })

  it('does not collapse Telegram failures or rows outside the window', () => {
    const now = Date.now()
    const rows: SystemLogRow[] = [
      {
        id: 'fail',
        level: 'error',
        msg: 'TEST_FAILED · integrations/telegram',
        time: '',
        createdAt: new Date(now),
        action: 'TEST_FAILED',
        resource: 'telegram',
      },
      {
        id: 'old',
        level: 'info',
        msg: 'TEST_SUCCESS · integrations/telegram',
        time: '',
        createdAt: new Date(now - 60 * 60_000),
        action: 'TEST_SUCCESS',
        resource: 'telegram',
      },
    ]
    expect(dedupeTelegramTestSuccess(rows)).toHaveLength(2)
  })

  it('filters by keyword and level then paginates', () => {
    const rows: SystemLogRow[] = [
      { id: '1', level: 'info', msg: 'Order packed', time: '', createdAt: new Date() },
      { id: '2', level: 'error', msg: 'Telegram failed', time: '', createdAt: new Date() },
      { id: '3', level: 'error', msg: 'Cron FAILED', time: '', createdAt: new Date() },
    ]
    const filtered = filterSystemLogs(rows, { q: 'fail', level: 'error' })
    expect(filtered.map((r) => r.id)).toEqual(['2', '3'])
    expect(paginateSystemLogs(filtered, 1, 1).map((r) => r.id)).toEqual(['2'])
  })
})
