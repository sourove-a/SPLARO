import { buildInvoiceAccessToken } from '@splaro/config'
import { publicOrderCode, serializePublicOrder } from './public-order.util'

type OrderItemLike = {
  productId: string
  variantId?: string | null
  productName: string
  variantName?: string | null
  image?: string | null
  price: unknown
  quantity: number
  product?: { slug?: string | null } | null
  variant?: { size?: string | null; colorName?: string | null; color?: string | null } | null
}

type CourierLike = {
  trackingCode?: string | null
  consignmentId?: string | null
  trackingUrl?: string | null
  estimatedDelivery?: Date | string | null
} | null

type OrderLike = {
  id: string
  invoiceNumber?: string | null
  status: string
  createdAt: Date | string
  updatedAt: Date | string
  shippingName: string
  shippingPhone: string
  shippingEmail?: string | null
  shippingAddress: string
  shippingCity: string
  subtotal: unknown
  deliveryCharge: unknown
  discount: unknown
  total: unknown
  paymentMethod: string
  items: OrderItemLike[]
  courier?: CourierLike
}

function toIso(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString()
}

function mapItem(item: OrderItemLike) {
  const sizeFromVariant = item.variant?.size?.trim()
  const colorFromVariant =
    item.variant?.colorName?.trim() || item.variant?.color?.trim() || undefined
  const [sizeFromName, colorFromName] = (item.variantName ?? '')
    .split(' / ')
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    productId: item.productId,
    ...(item.variantId ? { variantId: item.variantId } : {}),
    quantity: item.quantity,
    name: item.productName,
    price: Number(item.price),
    image: item.image ?? '',
    slug: item.product?.slug?.trim() || '',
    ...(sizeFromVariant || sizeFromName ? { size: sizeFromVariant || sizeFromName } : {}),
    ...(colorFromVariant || colorFromName
      ? { color: colorFromVariant || colorFromName }
      : {}),
  }
}

/** Shape + public-safe fields for storefront track / account order lists. */
export function toPublicStorefrontOrder(order: OrderLike) {
  const orderCode = publicOrderCode(order.invoiceNumber, order.id)
  const invoiceNumber = order.invoiceNumber?.trim() || orderCode
  const trackingNumber =
    order.courier?.trackingCode?.trim() || order.courier?.consignmentId?.trim() || undefined
  const trackingUrl = order.courier?.trackingUrl?.trim() || undefined
  const estimatedDelivery = order.courier?.estimatedDelivery
    ? toIso(order.courier.estimatedDelivery)
    : undefined

  const view = {
    id: order.id,
    invoiceNumber,
    orderCode,
    invoiceAccessKey: buildInvoiceAccessToken(invoiceNumber),
    createdAt: toIso(order.createdAt),
    updatedAt: toIso(order.updatedAt),
    status: order.status,
    shippingName: order.shippingName,
    shippingPhone: order.shippingPhone,
    shippingEmail: order.shippingEmail ?? '',
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    subtotal: Number(order.subtotal),
    deliveryCharge: Number(order.deliveryCharge),
    discount: Number(order.discount),
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    items: order.items.map(mapItem),
    tracking: {
      stage: order.status,
      ...(trackingNumber ? { trackingNumber } : {}),
      ...(trackingUrl ? { url: trackingUrl } : {}),
      updatedAt: toIso(order.updatedAt),
      ...(estimatedDelivery ? { estimatedDelivery } : {}),
    },
    customer: {
      name: order.shippingName,
      email: order.shippingEmail ?? '',
      phone: order.shippingPhone,
      address: order.shippingAddress,
      city: order.shippingCity,
      payment: order.paymentMethod,
    },
  }

  return serializePublicOrder(view)
}

export function toPublicStorefrontOrders(orders: OrderLike[]) {
  return orders.map(toPublicStorefrontOrder)
}
