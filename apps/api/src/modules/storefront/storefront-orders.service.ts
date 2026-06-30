import { BadRequestException, Injectable, Optional } from '@nestjs/common'
import { verifyInvoiceAccessToken } from '@splaro/config'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { assessOrderFraud } from '../../common/fraud.util'
import { normalizeBdPhone } from '../../common/bd-phone.util'
import { MetaCapiService } from '../marketing/meta-capi.service'
import { OrderNotificationsService } from '../notifications/order-notifications.service'
import { OrderEventsService } from '../orders/order-events.service'
import type { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client'

export interface OrderAttributionInput {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  fbclid?: string
  referrer?: string
  trafficSource?: string
  landingPage?: string
}

export interface StorefrontOrderItemInput {
  productId: string
  variantId?: string
  quantity: number
  name: string
  price: number
  image?: string
  size?: string
  color?: string
  slug?: string
}

export interface CreateStorefrontOrderInput {
  storeId?: string
  userId?: string
  customer: {
    name: string
    email: string
    phone: string
    address: string
    city: string
    district?: string
    division?: string
  }
  items: StorefrontOrderItemInput[]
  subtotal: number
  delivery: number
  discount: number
  total: number
  paymentMethod: string
  couponCode?: string
  attribution?: OrderAttributionInput
  clientIp?: string
  userAgent?: string
}

function mapPaymentMethod(method: string): PaymentMethod {
  const normalized = method.toLowerCase()
  if (normalized.includes('bkash')) return 'BKASH'
  if (normalized.includes('nagad')) return 'NAGAD'
  if (normalized.includes('ssl')) return 'SSLCOMMERZ'
  if (normalized.includes('card')) return 'CARD'
  return 'CASH_ON_DELIVERY'
}

@Injectable()
export class StorefrontOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaCapi: MetaCapiService,
    private readonly orderNotifications: OrderNotificationsService,
    @Optional() private readonly orderEvents: OrderEventsService,
  ) {}

  async create(input: CreateStorefrontOrderInput) {
    if (!input.items.length) {
      throw new BadRequestException('Order must include at least one item')
    }

    const sid = await resolveStoreId(this.prisma, input.storeId)
    const errors: string[] = []

    for (const item of input.items) {
      const variant = item.variantId
        ? await this.prisma.productVariant.findFirst({
            where: { id: item.variantId, productId: item.productId, product: { storeId: sid } },
          })
        : await this.prisma.productVariant.findFirst({
            where: {
              productId: item.productId,
              product: { storeId: sid },
              ...(item.size ? { size: item.size } : {}),
              ...(item.color ? { color: item.color } : {}),
            },
          })

      if (!variant) {
        errors.push(`${item.name}: variant not found`)
        continue
      }

      if (variant.stock < item.quantity) {
        errors.push(`${item.name}: only ${variant.stock} left in stock`)
      }
    }

    if (errors.length) {
      throw new BadRequestException(errors.join('; '))
    }

    const invoiceNumber = await this.nextInvoiceNumber(sid)
    const paymentMethod = mapPaymentMethod(input.paymentMethod)
    const paymentStatus: PaymentStatus = 'PENDING'
    const status: OrderStatus = 'PENDING'

    const normalizedPhone = normalizeBdPhone(input.customer.phone)
    const shippingEmail = input.customer.email?.trim().toLowerCase() || null

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentPhoneOrders = await this.prisma.order.count({
      where: {
        storeId: sid,
        shippingPhone: normalizedPhone,
        createdAt: { gte: since24h },
      },
    })

    const fraud = assessOrderFraud({
      paymentMethod,
      total: input.total,
      phone: normalizedPhone,
      recentOrdersFromPhone: recentPhoneOrders,
      hasFbclid: Boolean(input.attribution?.fbclid),
    })

    const attr = input.attribution

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          storeId: sid,
          invoiceNumber,
          status,
          paymentStatus,
          paymentMethod,
          subtotal: input.subtotal,
          deliveryCharge: input.delivery,
          discount: input.discount,
          total: input.total,
          couponCode: input.couponCode,
          shippingName: input.customer.name,
          shippingPhone: normalizedPhone,
          shippingEmail,
          shippingAddress: input.customer.address,
          shippingCity: input.customer.city,
          shippingDistrict: input.customer.district ?? input.customer.city,
          shippingDivision: input.customer.division ?? 'Dhaka',
          confirmedAt: null,
          fraudScore: fraud.score,
          fraudFlags: fraud.flags,
          isCodRisk: fraud.isCodRisk,
          utmSource: attr?.utmSource ?? null,
          utmMedium: attr?.utmMedium ?? null,
          utmCampaign: attr?.utmCampaign ?? null,
          utmContent: attr?.utmContent ?? null,
          utmTerm: attr?.utmTerm ?? null,
          fbclid: attr?.fbclid ?? null,
          referrer: attr?.referrer ?? null,
          trafficSource: attr?.trafficSource ?? null,
          landingPage: attr?.landingPage ?? null,
          clientIp: input.clientIp ?? null,
          items: {
            create: await Promise.all(
              input.items.map(async (item) => {
                const variant = item.variantId
                  ? await tx.productVariant.findUnique({ where: { id: item.variantId } })
                  : await tx.productVariant.findFirst({
                      where: {
                        productId: item.productId,
                        ...(item.size ? { size: item.size } : {}),
                        ...(item.color ? { color: item.color } : {}),
                      },
                    })

                if (variant) {
                  await tx.productVariant.update({
                    where: { id: variant.id },
                    data: { stock: { decrement: item.quantity } },
                  })
                }

                const lineTotal = item.price * item.quantity
                return {
                  product: { connect: { id: item.productId } },
                  ...(variant?.id ? { variant: { connect: { id: variant.id } } } : {}),
                  productName: item.name,
                  variantName: [item.size, item.color].filter(Boolean).join(' / ') || null,
                  sku: variant?.sku ?? null,
                  image: item.image ?? variant?.image ?? null,
                  price: item.price,
                  quantity: item.quantity,
                  subtotal: lineTotal,
                } satisfies Prisma.OrderItemCreateWithoutOrderInput
              }),
            ),
          },
          statusHistory: {
            create: { status, note: 'Order placed from storefront' },
          },
          payments: {
            create: {
              method: paymentMethod,
              status: paymentStatus,
              amount: input.total,
              currency: 'BDT',
            },
          },
        },
        include: {
          items: { include: { product: true, variant: true } },
          customer: true,
        },
      })

      return created
    })

    void this.metaCapi.trackPurchase({
      orderId: order.id,
      total: Number(order.total),
      email: input.customer.email,
      phone: input.customer.phone,
      fbclid: attr?.fbclid ?? null,
      clientIp: input.clientIp ?? null,
      userAgent: input.userAgent ?? null,
      eventSourceUrl: attr?.landingPage ?? null,
    })

    void this.orderNotifications.onOrderPlaced(sid, order.id, input.customer.email)
    void this.orderEvents?.onOrderPlaced(sid, order.id)

    return order
  }

  async listForUser(storeId: string | undefined, phone: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const normalized = phone.replace(/\D/g, '')
    return this.prisma.order.findMany({
      where: {
        storeId: sid,
        shippingPhone: { contains: normalized.slice(-10) },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async findForStorefrontAccess(
    storeId: string | undefined,
    idOrInvoice: string,
    access: { key?: string; phone?: string },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const order = await this.prisma.order.findFirst({
      where: {
        storeId: sid,
        OR: [{ id: idOrInvoice }, { invoiceNumber: idOrInvoice }],
      },
      include: {
        items: true,
        customer: { select: { email: true } },
      },
    })
    if (!order) return null

    if (access.key && verifyInvoiceAccessToken(order.id, access.key)) return order

    const phone = access.phone?.replace(/\D/g, '') ?? ''
    const orderPhone = order.shippingPhone.replace(/\D/g, '')
    if (phone.length >= 10 && phone.slice(-10) === orderPhone.slice(-10)) return order

    return null
  }

  private async nextInvoiceNumber(storeId: string): Promise<string> {
    const prefix = process.env['INVOICE_PREFIX'] ?? 'SPL'
    const count = await this.prisma.order.count({ where: { storeId } })
    const next = 1000 + count + 1
    const candidate = `${prefix}-${next}`
    const clash = await this.prisma.order.findUnique({ where: { invoiceNumber: candidate } })
    if (clash) return `${prefix}-${Date.now()}`
    return candidate
  }
}
