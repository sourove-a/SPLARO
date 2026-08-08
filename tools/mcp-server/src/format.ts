import type { Prisma } from '@prisma/client'

type MaybeDecimal = Prisma.Decimal | number | string | null | undefined

/** Prisma Decimal is not JSON-friendly — collapse it to a plain number. */
export function num(value: MaybeDecimal): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return value.toNumber()
}

export function money(value: MaybeDecimal): number {
  return num(value) ?? 0
}

export function day(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

export function stamp(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

/**
 * Bangladeshi numbers arrive as 01712345678, 8801712345678 or +8801712345678.
 * The last 10 digits are the stable part, so match on those.
 */
export function phoneTail(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.slice(-10)
}

/** Every tool returns one text block holding JSON the model can read directly. */
export function reply(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  }
}

export function replyError(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }, null, 2) }],
  }
}

export type Period = 'today' | 'week' | 'month' | 'custom'

/**
 * Windows are computed in Asia/Dhaka (UTC+6) because "today's sales" means the
 * shop's day, not UTC's.
 */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000

export function periodRange(
  period: Period,
  from?: string,
  to?: string,
): { start: Date; end: Date; label: string } {
  const now = new Date()

  if (period === 'custom') {
    if (!from) throw new Error('period="custom" requires a `from` date (YYYY-MM-DD).')
    const start = new Date(`${from}T00:00:00.000+06:00`)
    const end = to ? new Date(`${to}T23:59:59.999+06:00`) : now
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('`from`/`to` must be YYYY-MM-DD dates.')
    }
    return { start, end, label: `${from} → ${to ?? 'now'}` }
  }

  const dhakaNow = new Date(now.getTime() + DHAKA_OFFSET_MS)
  const midnightDhaka = new Date(
    Date.UTC(dhakaNow.getUTCFullYear(), dhakaNow.getUTCMonth(), dhakaNow.getUTCDate()) -
      DHAKA_OFFSET_MS,
  )

  if (period === 'today') return { start: midnightDhaka, end: now, label: 'today (Asia/Dhaka)' }
  if (period === 'week') {
    return {
      start: new Date(midnightDhaka.getTime() - 6 * 24 * 60 * 60 * 1000),
      end: now,
      label: 'last 7 days',
    }
  }
  return {
    start: new Date(midnightDhaka.getTime() - 29 * 24 * 60 * 60 * 1000),
    end: now,
    label: 'last 30 days',
  }
}

/** Orders that never became revenue. Excluded from money totals everywhere. */
export const DEAD_ORDER_STATUSES = ['CANCELLED', 'REFUNDED', 'RETURNED'] as const
