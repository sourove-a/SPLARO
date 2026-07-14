import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common'
import { verifyInvoiceAccessToken } from '@splaro/config'
import { PrismaService } from '../../common/prisma.service'
import { RedisService } from '../../common/redis.service'
import { resolveStoreId } from '../../common/store.util'
import { assessOrderFraud } from '../../common/fraud.util'
import { generateOrderCode } from '../../common/order-code.util'
import { storefrontVisibleProductWhere } from '../../common/storefront-product.util'
import { isValidBdMobile, normalizeBdPhone } from '../../common/bd-phone.util'
import { assertCouponForOrder } from '../coupons/coupon-validate.util'
import { resolveCheckoutVariant, type CheckoutVariantRow } from '../../common/cart-line.util'
import {
  assertPaymentMethodEnabled,
  loadStorePaymentFlags,
} from '../../common/payment-flags.util'
import {
  computeExpectedDeliveryChargeBdt,
  resolveOrderDistrict,
} from '../../common/delivery-charge.util'
import { OrderSideEffectsQueueService } from '../orders/order-side-effects-queue.service'
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
  /** Linked Customer row for signed-in storefront users. */
  customerId?: string
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
  idempotencyKey?: string
  attribution?: OrderAttributionInput
  clientIp?: string
  userAgent?: string
}

/** Must match the storefront checkout's prepaid discount (apps/web lib/utils/currency.ts). */
const DIGITAL_PAYMENT_DISCOUNT_RATE = 0.05
/** Rounding tolerance when comparing client-displayed total to server total. */
const TOTAL_TOLERANCE_BDT = 5

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
  private readonly logger = new Logger(StorefrontOrdersService.name)

  private static readonly ORDER_INCLUDE = {
    items: { include: { product: true, variant: true } },
    customer: true,
  } as const

  constructor(
    private readonly prisma: PrismaService,
    private readonly sideEffects: OrderSideEffectsQueueService,
    @Optional() private readonly redis: RedisService,
  ) {}

  private lineFingerprint(
    lines: { item: StorefrontOrderItemInput; variant: { id: string } }[],
  ): string {
    return lines
      .map((line) => `${line.variant.id}:${line.item.quantity}`)
      .sort()
      .join('|')
  }

  private async loadOrderById(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: StorefrontOrdersService.ORDER_INCLUDE,
    })
  }

  private async findRecentDuplicateOrder(
    sid: string,
    normalizedPhone: string,
    serverTotal: number,
    fingerprint: string,
  ) {
    const since = new Date(Date.now() - 120_000)
    const recent = await this.prisma.order.findMany({
      where: {
        storeId: sid,
        shippingPhone: normalizedPhone,
        total: serverTotal,
        createdAt: { gte: since },
      },
      include: {
        items: { select: { variantId: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    for (const candidate of recent) {
      const fp = candidate.items
        .map((row) => `${row.variantId}:${row.quantity}`)
        .sort()
        .join('|')
      if (fp === fingerprint) {
        return this.loadOrderById(candidate.id)
      }
    }
    return null
  }

  async create(input: CreateStorefrontOrderInput) {
    if (!input.items.length) {
      throw new BadRequestException('Order must include at least one item')
    }

    if (!isValidBdMobile(input.customer.phone)) {
      throw new BadRequestException(
        'Valid Bangladeshi mobile number required (01XXXXXXXXX)',
      )
    }

    const sid = await resolveStoreId(this.prisma, input.storeId)
    const errors: string[] = []

    // Resolve every line to a real DB variant and take prices from the
    // database — client-sent prices are never trusted for money math.
    const lines: {
      item: StorefrontOrderItemInput
      variant: CheckoutVariantRow
      unitPrice: number
    }[] = []

    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 500) {
        throw new BadRequestException(`${item.name}: invalid quantity`)
      }

      const resolved = await resolveCheckoutVariant(this.prisma, sid, item)
      if (!resolved.ok) {
        errors.push(resolved.error)
        continue
      }
      const variant = resolved.variant

      if (variant.stock < item.quantity) {
        errors.push(`${item.name}: only ${variant.stock} left in stock`)
        continue
      }

      const variantPrice = Number(variant.price)
      const unitPrice = variantPrice > 0 ? variantPrice : Number(variant.product.basePrice)
      lines.push({ item, variant, unitPrice })
    }

    if (errors.length) {
      throw new BadRequestException(errors.join('; '))
    }

    const paymentMethod = mapPaymentMethod(input.paymentMethod)

    const paymentFlags = await loadStorePaymentFlags(this.prisma, sid)
    assertPaymentMethodEnabled(paymentMethod, paymentFlags)

    // ── Server-side money math ────────────────────────────────
    const serverSubtotal = Math.round(
      lines.reduce((sum, line) => sum + line.unitPrice * line.item.quantity, 0),
    )

    const coupon = input.couponCode
      ? await assertCouponForOrder(this.prisma, sid, input.couponCode, serverSubtotal)
      : null

    const digitalDiscount =
      paymentMethod === 'CASH_ON_DELIVERY'
        ? 0
        : Math.round(serverSubtotal * DIGITAL_PAYMENT_DISCOUNT_RATE)
    const serverDiscount = digitalDiscount + (coupon?.discount ?? 0)

    const settings = await this.prisma.siteSettings.findUnique({ where: { storeId: sid } })
    const freeThreshold = Number(settings?.freeDeliveryThreshold ?? 0)
    const freeDelivery =
      Boolean(coupon?.freeShipping) ||
      serverSubtotal === 0 ||
      (freeThreshold > 0 && serverSubtotal >= freeThreshold)

    let delivery = 0
    if (!freeDelivery) {
      const district = resolveOrderDistrict(input.customer)
      if (!district) {
        throw new BadRequestException('Delivery district is required')
      }

      const expectedDelivery = computeExpectedDeliveryChargeBdt(
        district,
        {
          dhakaDeliveryCharge: Number(settings?.dhakaDeliveryCharge ?? 60),
          outsideDhakaCharge: Number(settings?.outsideDhakaCharge ?? 120),
          freeDeliveryThreshold: freeThreshold,
        },
        { subtotal: serverSubtotal },
      )

      const clientDelivery = Math.round(Number(input.delivery ?? 0))
      if (clientDelivery !== expectedDelivery) {
        throw new BadRequestException(
          'Delivery charge does not match your district — refresh the page and try again',
        )
      }
      delivery = expectedDelivery
    }

    const serverTotal = Math.max(0, Math.round(serverSubtotal + delivery - serverDiscount))

    if (Math.abs(Math.round(Number(input.total ?? 0)) - serverTotal) > TOTAL_TOLERANCE_BDT) {
      throw new BadRequestException(
        'Order total is out of date — prices may have changed. Refresh the page and try again.',
      )
    }

    const normalizedPhone = normalizeBdPhone(input.customer.phone)
    const shippingEmail = input.customer.email?.trim().toLowerCase() || null
    const lineFingerprint = this.lineFingerprint(lines)

    const idemKey = input.idempotencyKey?.trim()
    if (idemKey && this.redis) {
      const cached = await this.redis.getJson<{ orderId: string }>(
        `splaro:order-idem:${sid}:${idemKey}`,
      )
      if (cached?.orderId) {
        const existing = await this.loadOrderById(cached.orderId)
        if (existing) return existing
      }
    }

    const duplicate = await this.findRecentDuplicateOrder(
      sid,
      normalizedPhone,
      serverTotal,
      lineFingerprint,
    )
    if (duplicate) return duplicate

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
      total: serverTotal,
      phone: normalizedPhone,
      recentOrdersFromPhone: recentPhoneOrders,
      hasFbclid: Boolean(input.attribution?.fbclid),
    })

    const attr = input.attribution

    const paymentStatus: PaymentStatus = 'PENDING'
    const status: OrderStatus = 'PENDING'

    let order:
      | Prisma.OrderGetPayload<{ include: typeof StorefrontOrdersService.ORDER_INCLUDE }>
      | undefined

    for (let attempt = 0; attempt < 6; attempt++) {
      const invoiceNumber = await generateOrderCode(this.prisma, sid)
      try {
        order = await this.prisma.$transaction(async (tx) => {
      // Guarded decrement: `stock >= quantity` in the WHERE clause makes the
      // check-and-decrement atomic, so two concurrent checkouts can never
      // oversell the last unit or push stock negative.
      for (const line of lines) {
        const updated = await tx.productVariant.updateMany({
          where: { id: line.variant.id, stock: { gte: line.item.quantity } },
          data: { stock: { decrement: line.item.quantity } },
        })
        if (updated.count === 0) {
          throw new BadRequestException(`${line.item.name}: just sold out — please refresh your cart`)
        }
      }

      if (coupon) {
        const row = await tx.coupon.findUnique({
          where: { id: coupon.couponId },
          select: { usageLimit: true, usedCount: true },
        })
        if (!row) {
          throw new BadRequestException('Coupon no longer available')
        }
        if (row.usageLimit != null && row.usedCount >= row.usageLimit) {
          throw new BadRequestException('Coupon usage limit reached')
        }
        await tx.coupon.update({
          where: { id: coupon.couponId },
          data: { usedCount: { increment: 1 } },
        })
      }

      const created = await tx.order.create({
        data: {
          storeId: sid,
          invoiceNumber,
          ...(input.customerId ? { customerId: input.customerId } : {}),
          status,
          paymentStatus,
          paymentMethod,
          subtotal: serverSubtotal,
          deliveryCharge: delivery,
          discount: serverDiscount,
          total: serverTotal,
          couponCode: coupon ? input.couponCode : null,
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
            create: lines.map(({ item, variant, unitPrice }) => ({
              product: { connect: { id: item.productId } },
              variant: { connect: { id: variant.id } },
              productName: item.name,
              variantName: [item.size, item.color].filter(Boolean).join(' / ') || null,
              sku: variant.sku ?? null,
              image: item.image ?? variant.image ?? null,
              price: unitPrice,
              quantity: item.quantity,
              subtotal: unitPrice * item.quantity,
            }) satisfies Prisma.OrderItemCreateWithoutOrderInput),
          },
          statusHistory: {
            create: { status, note: 'Order placed from storefront' },
          },
          payments: {
            create: {
              method: paymentMethod,
              status: paymentStatus,
              amount: serverTotal,
              currency: 'BDT',
            },
          },
        },
        include: StorefrontOrdersService.ORDER_INCLUDE,
      })

      return created
        })
        break
      } catch (error) {
        const unique =
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as { code: string }).code === 'P2002'
        if (!unique || attempt === 5) throw error
      }
    }

    if (!order) {
      throw new BadRequestException('Unable to create order — please try again')
    }

    if (idemKey && this.redis) {
      await this.redis.setJson(`splaro:order-idem:${sid}:${idemKey}`, { orderId: order.id }, 600)
    }

    void this.sideEffects.enqueueOrderPlaced({
      storeId: sid,
      orderId: order.id,
      customerEmail: input.customer.email,
      meta: {
        total: Number(order.total),
        email: input.customer.email,
        phone: input.customer.phone,
        fbclid: attr?.fbclid ?? null,
        clientIp: input.clientIp ?? null,
        userAgent: input.userAgent ?? null,
        eventSourceUrl: attr?.landingPage ?? null,
      },
    })

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

    if (access.key) {
      if (verifyInvoiceAccessToken(order.id, access.key)) return order
      if (verifyInvoiceAccessToken(order.invoiceNumber, access.key)) return order
    }

    const phone = access.phone?.replace(/\D/g, '') ?? ''
    const orderPhone = order.shippingPhone.replace(/\D/g, '')
    if (phone.length >= 10 && phone.slice(-10) === orderPhone.slice(-10)) return order

    return null
  }
}
