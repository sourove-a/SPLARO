import type { CourierShipment, Order, OrderItem, ProductVariant } from '@prisma/client'
import { SPLARO_INVOICE_BRAND, resolveCustomerFacingSiteUrl, resolveInvoiceLogoUrl } from '@splaro/config'

export type InvoiceOrder = Order & {
  items: (OrderItem & { variant?: ProductVariant | null })[]
  courier: CourierShipment | null
  customer?: { email: string | null } | null
}

export interface InvoiceLineItem {
  productName: string
  sku: string
  size: string
  color: string
  quantity: number
  unitPrice: number
  discount: number
  lineTotal: number
  imageUrl: string
}

export interface InvoiceViewModel {
  brand: typeof SPLARO_INVOICE_BRAND
  logoUrl: string
  siteUrl: string
  invoiceNumber: string
  orderId: string
  issueDate: string
  dueDate: string
  orderStatus: string
  orderStatusKey: string
  paymentStatus: string
  paymentStatusKey: string
  paymentMethod: string
  paymentTerms: string
  customerName: string
  customerPhone: string
  customerEmail: string
  customerAddress: string
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  shippingCityArea: string
  deliveryArea: string
  courierPartner: string
  courierTracking: string
  estimatedDelivery: string
  items: InvoiceLineItem[]
  subtotal: number
  deliveryCharge: number
  discount: number
  couponDiscount: number
  couponCode: string
  advancePaid: number
  dueAmount: number
  grandTotal: number
  customerNote: string
  adminNote: string
  showToolbar: boolean
  autoPrint: boolean
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'Cash on Delivery',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  SSLCOMMERZ: 'SSLCommerz',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
}

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function formatInvoiceDate(value: Date | string): string {
  return new Date(value).toLocaleDateString('en-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function humanizeEnum(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function parseVariantFields(
  item: OrderItem & { variant?: ProductVariant | null },
): { size: string; color: string } {
  const size = item.variant?.size?.trim() || ''
  const color =
    item.variant?.colorName?.trim() ||
    item.variant?.color?.trim() ||
    ''

  if (size || color) return { size: size || '—', color: color || '—' }

  const parts = item.variantName?.split('/').map((part) => part.trim()) ?? []
  return {
    size: parts[0] || '—',
    color: parts[1] || '—',
  }
}

function absoluteAssetUrl(siteUrl: string, value?: string | null): string {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const base = siteUrl.replace(/\/$/, '')
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`
}

function formatShippingAddress(order: InvoiceOrder): string {
  const street = order.shippingAddress?.trim()
  const city = order.shippingCity?.trim()
  const district = order.shippingDistrict?.trim()
  const division = order.shippingDivision?.trim()
  const postal = order.shippingPostal?.trim()

  const location: string[] = []
  const seen = new Set<string>()

  for (const part of [city, district, division, postal]) {
    if (!part) continue
    const key = part.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    location.push(part)
  }

  return [street, location.join(', ')].filter(Boolean).join(', ')
}

function formatShippingCityArea(order: InvoiceOrder): string {
  const city = order.shippingCity?.trim()
  const district = order.shippingDistrict?.trim()
  if (!city) return district ?? ''
  if (!district || district.toLowerCase() === city.toLowerCase()) return city
  return `${city}, ${district}`
}

export function buildInvoiceViewModel(input: {
  order: InvoiceOrder
  storeName?: string
  storeLogo?: string | null
  storeEmail?: string | null
  storePhone?: string | null
  customerEmail?: string | null
  siteUrl?: string
  showToolbar?: boolean
  autoPrint?: boolean
}): InvoiceViewModel {
  const siteUrl = resolveCustomerFacingSiteUrl(input.siteUrl ?? SPLARO_INVOICE_BRAND.website)
  const order = input.order
  const subtotal = Number(order.subtotal)
  const deliveryCharge = Number(order.deliveryCharge)
  const discount = Number(order.discount)
  const grandTotal = Number(order.total)
  const advancePaid = Number(order.advanceAmount ?? 0)
  const dueAmount = Math.max(0, grandTotal - advancePaid)
  const paymentMethod = PAYMENT_METHOD_LABELS[order.paymentMethod] ?? humanizeEnum(order.paymentMethod)
  const paymentTerms =
    order.paymentMethod === 'CASH_ON_DELIVERY'
      ? SPLARO_INVOICE_BRAND.codPaymentTerms
      : 'Payment as selected at checkout'

  const items: InvoiceLineItem[] = order.items.map((item) => {
    const { size, color } = parseVariantFields(item)
    const unitPrice = Number(item.price)
    const quantity = item.quantity
    const lineTotal = Number(item.subtotal)
    return {
      productName: item.productName,
      sku: item.sku?.trim() || '—',
      size,
      color,
      quantity,
      unitPrice,
      discount: 0,
      lineTotal,
      imageUrl: absoluteAssetUrl(siteUrl, item.image),
    }
  })

  const shippingAddress = formatShippingAddress(order)
  const shippingCityArea = formatShippingCityArea(order)

  return {
    brand: SPLARO_INVOICE_BRAND,
    logoUrl: resolveInvoiceLogoUrl(siteUrl, input.storeLogo),
    siteUrl,
    invoiceNumber: order.invoiceNumber,
    orderId: order.id,
    issueDate: formatInvoiceDate(order.createdAt),
    dueDate: formatInvoiceDate(order.createdAt),
    orderStatus: humanizeEnum(order.status),
    orderStatusKey: order.status,
    paymentStatus: humanizeEnum(order.paymentStatus),
    paymentStatusKey: order.paymentStatus,
    paymentMethod,
    paymentTerms,
    customerName: order.shippingName,
    customerPhone: order.shippingPhone,
    customerEmail: input.customerEmail?.trim() || '—',
    customerAddress: shippingAddress,
    shippingName: order.shippingName,
    shippingPhone: order.shippingPhone,
    shippingAddress,
    shippingCityArea: shippingCityArea || order.shippingCity,
    deliveryArea: order.isInsideDhaka ? 'Inside Dhaka' : 'Outside Dhaka',
    courierPartner: order.courier?.provider ? humanizeEnum(order.courier.provider) : '—',
    courierTracking:
      order.courier?.trackingCode?.trim() ||
      order.courier?.consignmentId?.trim() ||
      '',
    estimatedDelivery: order.courier?.trackingCode ? 'Courier booked' : 'Processing',
    items,
    subtotal,
    deliveryCharge,
    discount,
    couponDiscount: order.couponCode ? discount : 0,
    couponCode: order.couponCode ?? '',
    advancePaid,
    dueAmount,
    grandTotal,
    customerNote: order.notes?.trim() || '',
    adminNote: order.adminNotes?.trim() || '',
    showToolbar: input.showToolbar ?? true,
    autoPrint: input.autoPrint ?? false,
  }
}

export function statusBadgeClass(kind: 'order' | 'payment', key: string): string {
  if (kind === 'payment') {
    if (key === 'PAID') return 'badge badge--paid'
    if (key === 'PENDING') return 'badge badge--pending'
    if (key === 'FAILED') return 'badge badge--cancelled'
    return 'badge badge--pending'
  }

  if (key === 'DELIVERED') return 'badge badge--paid'
  if (key === 'CANCELLED' || key === 'REFUNDED') return 'badge badge--cancelled'
  if (key === 'PENDING') return 'badge badge--pending'
  return 'badge badge--processing'
}

export function paymentStatusLabel(key: string): 'Paid' | 'Unpaid' | 'Pending' | 'Cancelled' {
  if (key === 'PAID') return 'Paid'
  if (key === 'FAILED' || key === 'REFUNDED') return 'Cancelled'
  if (key === 'PENDING') return 'Pending'
  return 'Unpaid'
}
