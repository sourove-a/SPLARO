export type SystemLogLevel = 'info' | 'warning' | 'error' | 'critical'

export const TELEGRAM_TEST_SUCCESS_WINDOW_MS = 15 * 60 * 1000

export type SystemLogRow = {
  id: string
  level: SystemLogLevel
  msg: string
  time: string
  createdAt: Date
  action?: string
  resource?: string
}

export function relTime(date: Date | null | undefined, now = new Date()): string {
  if (!date) return 'Never'
  const mins = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function formatAbsoluteDhaka(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const g = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${g('day')} ${g('month')} ${g('year')}, ${g('hour')}:${g('minute')}:${g('second')}`
}

export function formatLogWhen(date: Date, now = new Date()): string {
  return `${relTime(date, now)} · ${formatAbsoluteDhaka(date)}`
}

export function mapAuditLevel(action: string): SystemLogLevel {
  const a = action.toLowerCase()
  if (/(purge|lockout|blocked|critical)/.test(a)) return 'critical'
  if (/(fail|error|denied)/.test(a)) return 'error'
  if (/(warn|retry|pending)/.test(a)) return 'warning'
  return 'info'
}

export function isTelegramTestSuccess(row: { action?: string; resource?: string; msg: string }): boolean {
  if (row.action === 'TEST_SUCCESS' && row.resource === 'telegram') return true
  return /TEST_SUCCESS · integrations\/telegram/i.test(row.msg)
}

/** Collapse repeated Telegram TEST_SUCCESS rows within `windowMs`. Input must be newest-first. */
export function dedupeTelegramTestSuccess<T extends { id: string; createdAt: Date; msg: string; action?: string; resource?: string }>(
  rows: T[],
  windowMs = TELEGRAM_TEST_SUCCESS_WINDOW_MS,
): T[] {
  const out: T[] = []
  let group: T | null = null
  let count = 0

  const flush = () => {
    if (!group) return
    out.push(count > 1 ? { ...group, msg: `${group.msg} · ×${count}` } : group)
    group = null
    count = 0
  }

  for (const row of rows) {
    if (isTelegramTestSuccess(row)) {
      if (group && group.createdAt.getTime() - row.createdAt.getTime() <= windowMs) {
        count += 1
        continue
      }
      flush()
      group = row
      count = 1
      continue
    }
    flush()
    out.push(row)
  }
  flush()
  return out
}

export function filterSystemLogs(
  rows: SystemLogRow[],
  opts: { q?: string; level?: string },
): SystemLogRow[] {
  const q = opts.q?.trim().toLowerCase()
  const level = opts.level?.trim().toLowerCase()
  return rows.filter((row) => {
    if (level && level !== 'all' && row.level !== level) return false
    if (q && !row.msg.toLowerCase().includes(q) && !row.level.includes(q)) return false
    return true
  })
}

export function paginateSystemLogs<T>(rows: T[], page: number, pageSize: number): T[] {
  const size = pageSize > 0 ? pageSize : 50
  const p = Math.max(1, page)
  return rows.slice((p - 1) * size, p * size)
}
