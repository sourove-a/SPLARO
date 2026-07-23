import { formatBDT } from '../../common/utils/currency'
import { escapeTelegramHtml } from './telegram.util'

export interface TelegramOrderItemLine {
  productName: string
  slug?: string | null
  quantity: number
  price: number
  subtotal: number
  size?: string | null
  color?: string | null
  sku?: string | null
  variantName?: string | null
}

export interface TelegramNewOrderPayload {
  invoiceNumber: string
  total: number
  subtotal: number
  deliveryCharge: number
  discount: number
  paymentMethod: string
  paymentStatus: string
  orderStatus: string
  shippingName: string
  shippingPhone: string
  shippingEmail?: string | null
  shippingAddress: string
  shippingCity: string
  shippingDistrict?: string | null
  isInsideDhaka: boolean
  isCodRisk: boolean
  fraudFlags?: string[]
  notes?: string | null
  couponCode?: string | null
  createdAt?: Date | string | null
  items: TelegramOrderItemLine[]
  siteUrl: string
}

const TG_MSG_MAX = 3900

function prettyPayment(method: string): string {
  const key = method.trim().toUpperCase()
  if (key === 'COD' || key === 'CASH_ON_DELIVERY') return 'COD'
  if (key === 'BKASH') return 'bKash'
  if (key === 'NAGAD') return 'Nagad'
  if (key === 'SSLCOMMERZ' || key === 'CARD') return 'Card'
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function prettyStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDhakaTime(value?: Date | string | null): string {
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

function resolveSizeColor(item: TelegramOrderItemLine): { size?: string; color?: string } {
  let size = item.size?.trim() || undefined
  let color = item.color?.trim() || undefined
  if ((!size || !color) && item.variantName?.trim()) {
    const parts = item.variantName
      .split(/[·|/×x,-]+/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (!size && parts[0]) size = parts[0]
    if (!color && parts[1]) color = parts[1]
  }
  return { ...(size ? { size } : {}), ...(color ? { color } : {}) }
}

/** One compact line per item — no SKU / product URL (those bloat mobile + force link previews). */
function formatItemLine(item: TelegramOrderItemLine, index: number): string {
  const name = escapeTelegramHtml(item.productName.trim() || 'Product')
  const { size, color } = resolveSizeColor(item)
  const bits: string[] = [`<b>${index + 1}.</b> ${name}`]
  if (size) bits.push(escapeTelegramHtml(size))
  if (color) bits.push(escapeTelegramHtml(color))
  bits.push(`×${item.quantity}`)
  const amount = item.quantity > 1 ? item.subtotal : item.price
  bits.push(`<b>${escapeTelegramHtml(formatBDT(amount))}</b>`)
  return bits.join(' · ')
}

/** Premium compact HTML body for Telegram new-order alerts (parse_mode HTML). */
export function formatNewOrderTelegramMessage(order: TelegramNewOrderPayload): string {
  const when = formatDhakaTime(order.createdAt)
  const zone = order.isInsideDhaka ? 'Dhaka' : 'Outside'
  const addressParts = [order.shippingAddress, order.shippingCity, order.shippingDistrict]
    .map((p) => (p ?? '').trim())
    .filter((p): p is string => p.length > 0)
  const street = (addressParts[0] ?? '').toLowerCase()
  const uniqueAddress = addressParts.filter(
    (part, index) => index === 0 || !street.includes(part.toLowerCase()),
  )
  const address = escapeTelegramHtml(uniqueAddress.join(', '))

  const itemLines = order.items.map((item, i) => formatItemLine(item, i))
  let itemsSection = itemLines.join('\n')
  let hidden = 0
  while (itemsSection.length > 1800 && itemLines.length - hidden > 1) {
    hidden += 1
    itemsSection =
      itemLines.slice(0, itemLines.length - hidden).join('\n') +
      `\n… +${hidden} more`
  }

  const unitCount = order.items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)
  const riskBlock = order.isCodRisk
    ? '\n⚠️ <b>COD risk</b> — verify before courier'
    : ''
  const fraudBlock =
    order.fraudFlags && order.fraudFlags.length > 0
      ? `\n⚑ ${order.fraudFlags.map((f) => escapeTelegramHtml(f)).join(' · ')}`
      : ''
  const notesBlock = order.notes?.trim()
    ? `\n📝 <i>${escapeTelegramHtml(order.notes.trim())}</i>`
    : ''
  const couponBit = order.couponCode?.trim()
    ? ` · <code>${escapeTelegramHtml(order.couponCode.trim())}</code>`
    : ''

  const payLine = [
    escapeTelegramHtml(prettyPayment(order.paymentMethod)),
    escapeTelegramHtml(prettyStatus(order.paymentStatus)),
  ].join(' · ')

  const moneyBits = [
    `Sub ${escapeTelegramHtml(formatBDT(order.subtotal))}`,
    `Ship ${escapeTelegramHtml(formatBDT(order.deliveryCharge))} (${zone})`,
  ]
  if (order.discount > 0) {
    moneyBits.push(`−${escapeTelegramHtml(formatBDT(order.discount))}`)
  }

  const msg = `
🛍 <b>New order</b> · <code>${escapeTelegramHtml(order.invoiceNumber)}</code>${when ? `\n${escapeTelegramHtml(when)}` : ''}

👤 ${escapeTelegramHtml(order.shippingName)} · <code>${escapeTelegramHtml(order.shippingPhone)}</code>
📍 ${address}

💳 ${payLine}
${moneyBits.join(' · ')}${couponBit}
<b>Total ${escapeTelegramHtml(formatBDT(order.total))}</b>

📦 <b>${order.items.length}</b> item${order.items.length === 1 ? '' : 's'} · ${unitCount} unit${unitCount === 1 ? '' : 's'}
${itemsSection}${riskBlock}${fraudBlock}${notesBlock}
`.trim()

  if (msg.length <= TG_MSG_MAX) return msg
  return `${msg.slice(0, TG_MSG_MAX - 20)}\n… <i>truncated</i>`
}
