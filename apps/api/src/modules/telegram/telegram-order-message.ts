import { formatBDT } from '../../common/utils/currency'
import { escapeTelegramHtml } from './telegram.util'
import { formatCleanAddress, displaySizeLabel } from '@splaro/config'
import {
  tgCard,
  tgDhakaTime,
  tgExpandableCard,
  tgJoin,
  tgPrettyPayment,
  tgPrettyStatus,
} from './telegram-format'

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
  customerHistory?: {
    totalOrders: number
    deliveredOrders: number
    returnedOrCancelled: number
  } | null
  steadfastReport?: {
    totalParcels: number
    delivered: number
    cancelled: number
    successRate: number
  } | null
  notes?: string | null
  couponCode?: string | null
  createdAt?: Date | string | null
  items: TelegramOrderItemLine[]
  siteUrl: string
}

const TG_MSG_MAX = 3900
/** Item list past this many lines is collapsed behind Telegram's "show more". */
const ITEMS_EXPANDABLE_AFTER = 4

function resolveSizeColor(item: TelegramOrderItemLine): { size?: string; color?: string } {
  let size = displaySizeLabel(item.size) || undefined
  let color = item.color?.trim() || undefined
  if ((!size || !color) && item.variantName?.trim()) {
    const parts = item.variantName
      .split(/[·|/×x,-]+/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (!size && parts[0]) size = displaySizeLabel(parts[0]) || parts[0]
    if (!color && parts[1]) color = parts[1]
  }
  return { ...(size ? { size } : {}), ...(color ? { color } : {}) }
}

/** One compact line per item — no SKU / product URL (those bloat mobile + force link previews). */
function formatItemLine(item: TelegramOrderItemLine, index: number): string {
  const name = escapeTelegramHtml(item.productName.trim() || 'Product')
  const { size, color } = resolveSizeColor(item)
  const bits: string[] = [`${index + 1}. <b>${name}</b>`]
  const variant = [size, color].filter(Boolean).join(' · ')
  if (variant) bits.push(escapeTelegramHtml(variant))
  bits.push(`×${item.quantity}`)
  const amount = item.quantity > 1 ? item.subtotal : item.price
  bits.push(`<b>${escapeTelegramHtml(formatBDT(amount))}</b>`)
  return bits.join(' · ')
}

function customerBadge(history: TelegramNewOrderPayload['customerHistory']): string {
  if (!history) return ''
  const { totalOrders, deliveredOrders, returnedOrCancelled } = history
  if (totalOrders <= 1) return ' · <i>(1st order)</i>'
  if (returnedOrCancelled > 0) {
    return ` · <i>(⚠️ ${returnedOrCancelled} returned/cancelled of ${totalOrders})</i>`
  }
  if (deliveredOrders > 0) return ` · <i>(⭐ ${deliveredOrders} delivered)</i>`
  return ` · <i>(${totalOrders} orders)</i>`
}

function riskBlock(order: TelegramNewOrderPayload): string {
  const rows: string[] = []
  if (order.isCodRisk) rows.push('⚠️ <b>COD risk</b> — verify by call before courier')
  if (order.fraudFlags?.length) {
    rows.push(`⚑ ${order.fraudFlags.map((f) => escapeTelegramHtml(f)).join(' · ')}`)
  }
  if (order.steadfastReport && order.steadfastReport.totalParcels > 0) {
    const { totalParcels, delivered, cancelled, successRate } = order.steadfastReport
    const icon = successRate < 60 ? '⚠️' : '🚚'
    rows.push(
      `${icon} Steadfast <b>${successRate}%</b> success · ${delivered} delivered · ${cancelled} returned of ${totalParcels}`,
    )
  }
  if (order.notes?.trim()) rows.push(`📝 <i>${escapeTelegramHtml(order.notes.trim())}</i>`)
  return rows.join('\n')
}

/**
 * New-order alert body (parse_mode HTML).
 *
 * Phone, address and invoice are <code> spans so the operator can copy each one
 * with a single tap; the keyboard adds explicit copy buttons on top of that.
 */
export function formatNewOrderTelegramMessage(order: TelegramNewOrderPayload): string {
  const when = tgDhakaTime(order.createdAt)
  const zone = order.isInsideDhaka ? 'Inside Dhaka' : 'Outside Dhaka'
  const cleanAddr = formatCleanAddress(order.shippingAddress, order.shippingCity, order.shippingDistrict)
  const address = escapeTelegramHtml(cleanAddr || 'No address provided')

  const metaBits = [
    when,
    `${tgPrettyPayment(order.paymentMethod)} · ${tgPrettyStatus(order.paymentStatus)}`,
    zone,
  ].filter(Boolean)

  const title =
    `🛒 <b>New Order</b> · <code>${escapeTelegramHtml(order.invoiceNumber)}</code>\n` +
    `<i>${escapeTelegramHtml(metaBits.join(' · '))}</i>`

  const customerCard = tgCard([
    `👤 <b>${escapeTelegramHtml(order.shippingName)}</b>${customerBadge(order.customerHistory)}`,
    `📞 <code>${escapeTelegramHtml(order.shippingPhone)}</code>`,
    `📍 <code>${address}</code>`,
    ...(order.shippingEmail?.trim()
      ? [`✉️ <code>${escapeTelegramHtml(order.shippingEmail.trim())}</code>`]
      : []),
  ])

  const unitCount = order.items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)
  const itemLines = order.items.map((item, i) => formatItemLine(item, i))
  const itemsCard =
    itemLines.length > ITEMS_EXPANDABLE_AFTER ? tgExpandableCard(itemLines) : tgCard(itemLines)
  const itemsBlock = `🧾 <b>Items</b> · ${order.items.length} line${order.items.length === 1 ? '' : 's'} · ${unitCount} pc\n${itemsCard}`

  const moneyRows = [
    `Subtotal — ${escapeTelegramHtml(formatBDT(order.subtotal))}`,
    `Delivery — ${escapeTelegramHtml(formatBDT(order.deliveryCharge))}`,
  ]
  if (order.discount > 0) {
    const coupon = order.couponCode?.trim()
      ? ` (<code>${escapeTelegramHtml(order.couponCode.trim())}</code>)`
      : ''
    moneyRows.push(`Discount — −${escapeTelegramHtml(formatBDT(order.discount))}${coupon}`)
  }
  moneyRows.push(`<b>Total — ${escapeTelegramHtml(formatBDT(order.total))}</b>`)
  const moneyBlock = `💰 <b>Payment</b>\n${tgCard(moneyRows)}`

  const msg = tgJoin(title, customerCard, itemsBlock, moneyBlock, riskBlock(order))

  if (msg.length <= TG_MSG_MAX) return msg
  return `${msg.slice(0, TG_MSG_MAX - 20)}\n… <i>truncated</i>`
}
