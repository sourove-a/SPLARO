import type { InlineKeyboardButton } from 'node-telegram-bot-api'
import { escapeTelegramHtml } from './telegram.util'

/**
 * Telegram message primitives.
 *
 * The old bot drew ASCII boxes (┌───┐ / ━━━━) around every block. On a phone
 * those wrap mid-line and look broken, so all layout here uses native Telegram
 * markup instead: <b> titles, <blockquote> cards, and <code> for any value the
 * operator needs to copy (tapping a code span copies it in every Telegram app).
 */

/** Values wrapped in tgCopy are tap-to-copy inside Telegram. */
export function tgCopy(value: string): string {
  return `<code>${escapeTelegramHtml(value)}</code>`
}

export function tgBold(value: string): string {
  return `<b>${escapeTelegramHtml(value)}</b>`
}

export function tgItalic(value: string): string {
  return `<i>${escapeTelegramHtml(value)}</i>`
}

/** Card block — Telegram renders a quoted card with an accent bar. */
export function tgCard(lines: string[]): string {
  const body = lines.filter((line) => line.trim().length > 0).join('\n')
  if (!body) return ''
  return `<blockquote>${body}</blockquote>`
}

/** Long card that Telegram collapses behind "show more" (item lists, logs). */
export function tgExpandableCard(lines: string[]): string {
  const body = lines.filter((line) => line.trim().length > 0).join('\n')
  if (!body) return ''
  return `<blockquote expandable>${body}</blockquote>`
}

/** Screen title. Subtitle stays italic and small so the header never wraps twice. */
export function tgHeader(icon: string, title: string, subtitle?: string): string {
  const head = `${icon} <b>${escapeTelegramHtml(title)}</b>`
  if (!subtitle?.trim()) return head
  return `${head}\n<i>${escapeTelegramHtml(subtitle.trim())}</i>`
}

/** "Label · value" line used inside cards. Value is pre-formatted HTML. */
export function tgLine(label: string, valueHtml: string): string {
  return `${escapeTelegramHtml(label)} · ${valueHtml}`
}

export function tgJoin(...blocks: Array<string | null | undefined>): string {
  return blocks
    .map((block) => block?.trim() ?? '')
    .filter((block) => block.length > 0)
    .join('\n\n')
}

/**
 * Tap-to-clipboard button (Bot API 7.11 copy_text). Not in the shipped typings
 * yet, so the shape is asserted — Telegram ignores unknown fields on old apps
 * and falls back to showing the value in the message body.
 */
export function tgCopyButton(label: string, value: string): InlineKeyboardButton {
  return { text: label, copy_text: { text: value } } as unknown as InlineKeyboardButton
}

/** Telegram rejects copy_text payloads over 256 bytes — trim before sending. */
export function tgCopyValue(raw: string): string {
  const clean = raw.replace(/\s+/g, ' ').trim()
  return clean.length > 250 ? `${clean.slice(0, 249)}…` : clean
}

export function tgStatusEmoji(status: string): string {
  const map: Record<string, string> = {
    PENDING: '⏳',
    CONFIRMED: '✅',
    PROCESSING: '🧵',
    READY_TO_SHIP: '📦',
    COURIER_BOOKED: '🚚',
    SHIPPED: '🚚',
    IN_TRANSIT: '🛣',
    OUT_FOR_DELIVERY: '🛵',
    DELIVERED: '🎉',
    CANCELLED: '❌',
    RETURNED: '↩️',
    REFUNDED: '💸',
    FAILED: '⚠️',
  }
  return map[status] ?? '•'
}

export function tgPrettyStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function tgPrettyPayment(method: string): string {
  const key = method.trim().toUpperCase()
  if (key === 'COD' || key === 'CASH_ON_DELIVERY') return 'COD'
  if (key === 'BKASH') return 'bKash'
  if (key === 'NAGAD') return 'Nagad'
  if (key === 'SSLCOMMERZ' || key === 'CARD') return 'Card'
  return tgPrettyStatus(method)
}

export function tgDhakaTime(value?: Date | string | null): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return date.toISOString()
  }
}

/** Right-pad a money label so amounts line up inside a card. */
export function tgAmountRow(label: string, amount: string, bold = false): string {
  const value = bold ? `<b>${escapeTelegramHtml(amount)}</b>` : escapeTelegramHtml(amount)
  const name = bold ? `<b>${escapeTelegramHtml(label)}</b>` : escapeTelegramHtml(label)
  return `${name} — ${value}`
}
