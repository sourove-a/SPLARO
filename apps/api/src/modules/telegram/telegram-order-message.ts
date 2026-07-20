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
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function prettyStatus(status: string): string {
  return status.replace(/_/g, ' ')
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
      year: 'numeric',
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

function productHref(siteUrl: string, slug?: string | null): string | null {
  const cleanSlug = slug?.trim()
  if (!cleanSlug) return null
  const base = siteUrl.replace(/\/+$/, '')
  return `${base}/products/${encodeURIComponent(cleanSlug)}`
}

function formatItemBlock(
  item: TelegramOrderItemLine,
  index: number,
  siteUrl: string,
): string {
  const name = escapeTelegramHtml(item.productName.trim() || 'Product')
  const { size, color } = resolveSizeColor(item)
  const meta: string[] = []
  if (size) meta.push(`Size <b>${escapeTelegramHtml(size)}</b>`)
  if (color) meta.push(`Colour <b>${escapeTelegramHtml(color)}</b>`)
  meta.push(`Qty <b>${item.quantity}</b>`)
  meta.push(escapeTelegramHtml(formatBDT(item.price)))

  const sku = item.sku?.trim()
  const link = productHref(siteUrl, item.slug)
  const lines = [
    `<b>${index + 1}.</b> ${name}`,
    `   ${meta.join(' · ')}`,
    `   Line: <b>${escapeTelegramHtml(formatBDT(item.subtotal))}</b>`,
  ]
  if (sku) lines.push(`   SKU: <code>${escapeTelegramHtml(sku)}</code>`)
  if (link) {
    lines.push(`   🔗 <a href="${escapeTelegramHtml(link)}">Open product</a>`)
  }
  return lines.join('\n')
}

/** Premium HTML body for Telegram new-order alerts (parse_mode HTML). */
export function formatNewOrderTelegramMessage(order: TelegramNewOrderPayload): string {
  const when = formatDhakaTime(order.createdAt)
  const zone = order.isInsideDhaka ? 'Inside Dhaka' : 'Outside Dhaka'
  const addressParts = [order.shippingAddress, order.shippingCity, order.shippingDistrict]
    .map((p) => (p ?? '').trim())
    .filter((p): p is string => p.length > 0)
  // Dedupe if city already embedded in the street line from checkout.
  const street = (addressParts[0] ?? '').toLowerCase()
  const uniqueAddress = addressParts.filter(
    (part, index) => index === 0 || !street.includes(part.toLowerCase()),
  )
  const address = escapeTelegramHtml(uniqueAddress.join(', '))

  const itemBlocks = order.items.map((item, i) => formatItemBlock(item, i, order.siteUrl))
  let itemsSection = itemBlocks.join('\n\n')
  let hidden = 0
  while (itemsSection.length > 2200 && itemBlocks.length - hidden > 1) {
    hidden += 1
    itemsSection =
      itemBlocks.slice(0, itemBlocks.length - hidden).join('\n\n') +
      `\n\n… +${hidden} more item${hidden > 1 ? 's' : ''}`
  }

  const unitCount = order.items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)
  const riskBlock = order.isCodRisk
    ? '\n\n⚠️ <b>COD RISK</b> — verify phone / address before courier.'
    : ''
  const fraudBlock =
    order.fraudFlags && order.fraudFlags.length > 0
      ? `\nFlags: ${order.fraudFlags.map((f) => escapeTelegramHtml(f)).join(', ')}`
      : ''
  const notesBlock = order.notes?.trim()
    ? `\n\n📝 Note: <i>${escapeTelegramHtml(order.notes.trim())}</i>`
    : ''
  const couponBlock = order.couponCode?.trim()
    ? `\nCoupon: <code>${escapeTelegramHtml(order.couponCode.trim())}</code>`
    : ''
  const emailBlock = order.shippingEmail?.trim()
    ? `\nEmail: <code>${escapeTelegramHtml(order.shippingEmail.trim())}</code>`
    : ''

  const moneyLines = [
    `Subtotal: ${escapeTelegramHtml(formatBDT(order.subtotal))}`,
    `Delivery: ${escapeTelegramHtml(formatBDT(order.deliveryCharge))} · ${zone}`,
  ]
  if (order.discount > 0) {
    moneyLines.push(`Discount: −${escapeTelegramHtml(formatBDT(order.discount))}`)
  }
  moneyLines.push(`Total: <b>${escapeTelegramHtml(formatBDT(order.total))}</b>`)

  const msg = `
🛍 <b>New SPLARO Order</b>
<code>${escapeTelegramHtml(order.invoiceNumber)}</code>${when ? ` · ${escapeTelegramHtml(when)}` : ''}

👤 <b>Customer</b>
${escapeTelegramHtml(order.shippingName)}
Phone: <code>${escapeTelegramHtml(order.shippingPhone)}</code>${emailBlock}
📍 ${address}

💳 <b>Payment</b>
${escapeTelegramHtml(prettyPayment(order.paymentMethod))} · ${escapeTelegramHtml(prettyStatus(order.paymentStatus))}
Status: ${escapeTelegramHtml(prettyStatus(order.orderStatus))}
${moneyLines.join('\n')}${couponBlock}

📦 <b>Items</b> (${order.items.length} line${order.items.length === 1 ? '' : 's'} · ${unitCount} unit${unitCount === 1 ? '' : 's'})
${itemsSection}${riskBlock}${fraudBlock}${notesBlock}

<i>Confirm / book courier below — or send <code>${escapeTelegramHtml(order.invoiceNumber)}</code></i>
`.trim()

  if (msg.length <= TG_MSG_MAX) return msg
  return `${msg.slice(0, TG_MSG_MAX - 20)}\n… <i>truncated</i>`
}
