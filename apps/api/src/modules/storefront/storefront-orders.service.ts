import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common'
import { formatSplOrderCode, parseSplOrderNumber, verifyInvoiceAccessToken } from '@splaro/config'
import { PrismaService } from '../../common/prisma.service'
import { RedisService } from '../../common/redis.service'
import { resolveStoreId } from '../../common/store.util'
import { assessOrderFraud } from '../../common/fraud.util'
import { generateOrderCode } from '../../common/order-code.util'
import { storefrontVisibleProductWhere } from '../../common/storefront-product.util'
import { isValidBdMobile, normalizeBdPhone } from '../../common/bd-phone.util'
import { assertCouponForOrder } from '../coupons/coupon-validate.util'
import {
  resolveCheckoutVariantsBatch,
  type CheckoutVariantRow,
} from '../../common/cart-line.util'
import { assertPaymentMethodEnabled, type StorePaymentFlags } from '../../common/payment-flags.util'
import {
  computeExpectedDeliveryChargeBdt,
  isDhakaDistrict,
  resolveOrderDistrict,
} from '../../common/delivery-charge.util'
import { CommerceEventOutboxService } from '../orders/commerce-event-outbox.service'
import { PaymentIntegrationService } from '../integrations/payment-integration.service'
import { StockReservationService } from '../payments/stock-reservation.service'
import type { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client'

export interface OrderAttributionInput {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  fbclid?: string
  gclid?: string
  fbp?: string
  fbc?: string
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
    email?: string
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

type DigitalPaymentProvider = 'bkash' | 'nagad' | 'sslcommerz'

function mapPaymentMethod(method: string): PaymentMethod {
  const normalized = method.trim().toLowerCase()
  if (
    normalized === 'cod' ||
    normalized === 'cash' ||
    normalized === 'cash_on_delivery' ||
    normalized === 'cash on delivery'
  ) {
    return 'CASH_ON_DELIVERY'
  }
  if (normalized.includes('bkash')) return 'BKASH'
  if (normalized.includes('nagad')) return 'NAGAD'
  if (normalized.includes('ssl')) return 'SSLCOMMERZ'
  if (normalized.includes('card')) return 'CARD'
  throw new BadRequestException('Unsupported payment method')
}

function digitalPaymentProvider(method: PaymentMethod): DigitalPaymentProvider {
  if (method === 'BKASH') return 'bkash'
  if (method === 'NAGAD') return 'nagad'
  return 'sslcommerz'
}

@Injectable()
export class StorefrontOrdersService {
  private readonly logger = new Logger(StorefrontOrdersService.name)

  /** Slim include for create/idempotency responses — avoid pulling full Product rows. */
  private static readonly ORDER_INCLUDE = {
    items: {
      include: {
        product: { select: { id: true, slug: true, name: true, basePrice: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            colorName: true,
            colorHex: true,
            image: true,
            price: true,
          },
        },
      },
    },
    customer: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
  } as const

  constructor(
    private readonly prisma: PrismaService,
    private readonly commerceEvents: CommerceEventOutboxService,
    private readonly paymentIntegration: PaymentIntegrationService,
    private readonly reservations: StockReservationService,
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
      throw new BadRequestException('Valid Bangladeshi mobile number required (01XXXXXXXXX)')
    }

    const sid = await resolveStoreId(this.prisma, input.storeId)
    const errors: string[] = []

    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 500) {
        throw new BadRequestException(`${item.name}: invalid quantity`)
      }
    }

    const paymentMethod = mapPaymentMethod(input.paymentMethod)

    // Variants + payment/delivery settings are independent — fetch together.
    const [resolvedLines, settings] = await Promise.all([
      resolveCheckoutVariantsBatch(this.prisma, sid, input.items),
      this.prisma.siteSettings.findUnique({
        where: { storeId: sid },
        select: {
          codEnabled: true,
          bkashEnabled: true,
          nagadEnabled: true,
          sslcommerzEnabled: true,
          freeDeliveryThreshold: true,
          dhakaDeliveryCharge: true,
          outsideDhakaCharge: true,
        },
      }),
    ])

    const lines: {
      item: StorefrontOrderItemInput
      variant: CheckoutVariantRow
      unitPrice: number
    }[] = []

    input.items.forEach((item, index) => {
      const resolved = resolvedLines[index]
      if (!resolved?.ok) {
        errors.push(resolved?.error ?? `${item.name}: selected variant is no longer available`)
        return
      }
      const variant = resolved.variant
      const available = Math.max(0, variant.stock - variant.reservedStock)
      if (available < item.quantity) {
        errors.push(`${item.name}: only ${available} left in stock`)
        return
      }
      const variantPrice = Number(variant.price)
      const unitPrice = variantPrice > 0 ? variantPrice : Number(variant.product.basePrice)
      lines.push({ item, variant, unitPrice })
    })

    if (errors.length) {
      throw new BadRequestException(errors.join('; '))
    }

    const paymentFlags: StorePaymentFlags = {
      cod: settings?.codEnabled ?? true,
      bkash: settings?.bkashEnabled ?? false,
      nagad: settings?.nagadEnabled ?? false,
      sslcommerz: settings?.sslcommerzEnabled ?? false,
    }
    assertPaymentMethodEnabled(paymentMethod, paymentFlags)
    if (paymentMethod !== 'CASH_ON_DELIVERY') {
      const provider = digitalPaymentProvider(paymentMethod)
      if (!(await this.paymentIntegration.isConfigured(sid, provider))) {
        throw new BadRequestException('This digital payment method is not configured')
      }
    }

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

    const freeThreshold = Number(settings?.freeDeliveryThreshold ?? 0)
    const freeDelivery =
      Boolean(coupon?.freeShipping) ||
      serverSubtotal === 0 ||
      (freeThreshold > 0 && serverSubtotal >= freeThreshold)

    const district = resolveOrderDistrict(input.customer)
    if (!freeDelivery && !district) {
      throw new BadRequestException('Delivery district is required')
    }
    const isInsideDhaka = isDhakaDistrict(district)

    let delivery = 0
    if (!freeDelivery) {
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
    const customerIdentity = input.customerId
      ? `customer:${input.customerId}`
      : `phone:${normalizedPhone}`
    const stockLines = lines.map((line) => ({
      variantId: line.variant.id,
      quantity: line.item.quantity,
      name: line.item.name,
    }))

    const idemKey = input.idempotencyKey?.trim()
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [durableExisting, redisCached, duplicate, recentPhoneOrders] = await Promise.all([
      idemKey
        ? this.prisma.order.findUnique({
            where: { storeId_idempotencyKey: { storeId: sid, idempotencyKey: idemKey } },
            include: StorefrontOrdersService.ORDER_INCLUDE,
          })
        : Promise.resolve(null),
      idemKey && this.redis
        ? this.redis.getJson<{ orderId: string }>(`splaro:order-idem:${sid}:${idemKey}`)
        : Promise.resolve(null),
      this.findRecentDuplicateOrder(sid, normalizedPhone, serverTotal, lineFingerprint),
      this.prisma.order.count({
        where: {
          storeId: sid,
          shippingPhone: normalizedPhone,
          createdAt: { gte: since24h },
        },
      }),
    ])
    if (durableExisting) return durableExisting
    if (redisCached?.orderId) {
      const existing = await this.loadOrderById(redisCached.orderId)
      if (existing) return existing
    }
    if (duplicate) return duplicate

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
      let invoiceNumber = await generateOrderCode(this.prisma, sid)
      if (attempt > 0) {
        // Concurrent claim of the same SPL code — jump ahead of the contested window.
        const n = parseSplOrderNumber(invoiceNumber)
        if (n != null) invoiceNumber = formatSplOrderCode(n + attempt)
      }
      try {
        order = await this.prisma.$transaction(async (tx) => {
          if (coupon) {
            await tx.$queryRaw`SELECT "id" FROM "Coupon" WHERE "id" = ${coupon.couponId} FOR UPDATE`
            const row = await tx.coupon.findUnique({
              where: { id: coupon.couponId },
              select: { usageLimit: true, usedCount: true, perCustomerLimit: true },
            })
            if (!row) {
              throw new BadRequestException('Coupon no longer available')
            }
            if (row.usageLimit != null && row.usedCount >= row.usageLimit) {
              throw new BadRequestException('Coupon usage limit reached')
            }
            if (row.perCustomerLimit != null) {
              const customerUses = await tx.couponRedemption.count({
                where: { couponId: coupon.couponId, customerIdentity },
              })
              if (customerUses >= row.perCustomerLimit) {
                throw new BadRequestException('Coupon per-customer limit reached')
              }
            }
          }

          const created = await tx.order.create({
            data: {
              storeId: sid,
              invoiceNumber,
              idempotencyKey: idemKey ?? null,
              ...(input.customerId ? { customerId: input.customerId } : {}),
              status,
              paymentStatus,
              paymentMethod,
              subtotal: serverSubtotal,
              deliveryCharge: delivery,
              discount: serverDiscount,
              total: serverTotal,
              couponId: coupon?.couponId ?? null,
              couponCode: coupon ? input.couponCode : null,
              shippingName: input.customer.name,
              shippingPhone: normalizedPhone,
              shippingEmail,
              shippingAddress: input.customer.address,
              shippingCity: input.customer.city,
              shippingDistrict: input.customer.district ?? input.customer.city,
              shippingDivision: input.customer.division ?? 'Dhaka',
              isInsideDhaka,
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
              gclid: attr?.gclid ?? null,
              fbp: attr?.fbp ?? null,
              fbc: attr?.fbc ?? null,
              referrer: attr?.referrer ?? null,
              trafficSource: attr?.trafficSource ?? null,
              landingPage: attr?.landingPage ?? null,
              clientIp: input.clientIp ?? null,
              items: {
                create: lines.map(
                  ({ item, variant, unitPrice }) =>
                    ({
                      product: { connect: { id: item.productId } },
                      variant: { connect: { id: variant.id } },
                      productName: item.name,
                      variantName: [item.size, item.color].filter(Boolean).join(' / ') || null,
                      sku: variant.sku ?? null,
                      image: item.image ?? variant.image ?? null,
                      price: unitPrice,
                      quantity: item.quantity,
                      subtotal: unitPrice * item.quantity,
                    }) satisfies Prisma.OrderItemCreateWithoutOrderInput,
                ),
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

          if (paymentMethod === 'CASH_ON_DELIVERY') {
            await this.reservations.decrementCodStock(tx, stockLines)
          } else {
            await this.reservations.createReservation(tx, created.id, stockLines)
          }

          if (coupon) {
            await tx.couponRedemption.create({
              data: {
                couponId: coupon.couponId,
                orderId: created.id,
                customerId: input.customerId ?? null,
                customerIdentity,
                code: coupon.code,
                discountAmount: coupon.discount,
                freeShipping: coupon.freeShipping,
                orderSubtotal: serverSubtotal,
              },
            })
            await tx.coupon.update({
              where: { id: coupon.couponId },
              data: { usedCount: { increment: 1 } },
            })
          }

          if (paymentMethod === 'CASH_ON_DELIVERY') {
            await this.commerceEvents.enqueueOrderPlaced(tx, {
              storeId: sid,
              orderId: created.id,
              customerEmail: input.customer.email,
              meta: {
                total: Number(created.total),
                email: input.customer.email,
                phone: normalizedPhone,
                fbclid: attr?.fbclid ?? null,
                fbp: attr?.fbp ?? null,
                fbc: attr?.fbc ?? null,
                clientIp: input.clientIp ?? null,
                userAgent: input.userAgent ?? null,
                eventSourceUrl: attr?.landingPage ?? null,
              },
            })
          }

          return created
        })
        break
      } catch (error) {
        const unique =
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as { code: string }).code === 'P2002'
        if (!unique) throw error
        if (idemKey) {
          const durableExisting = await this.prisma.order.findUnique({
            where: { storeId_idempotencyKey: { storeId: sid, idempotencyKey: idemKey } },
            include: StorefrontOrdersService.ORDER_INCLUDE,
          })
          if (durableExisting) {
            order = durableExisting
            break
          }
        }
        if (attempt === 5) throw error
      }
    }

    if (!order) {
      throw new BadRequestException('Unable to create order — please try again')
    }

    if (idemKey && this.redis) {
      await this.redis.setJson(`splaro:order-idem:${sid}:${idemKey}`, { orderId: order.id }, 600)
    }

    if (paymentMethod === 'CASH_ON_DELIVERY') {
      void this.commerceEvents.dispatchForOrder(order.id)
    }

    return order
  }

  private readonly storefrontOrderInclude = {
    courier: {
      select: {
        trackingCode: true,
        consignmentId: true,
        trackingUrl: true,
        estimatedDelivery: true,
        status: true,
      },
    },
    items: {
      include: {
        product: { select: { slug: true } },
        variant: { select: { size: true, colorName: true, color: true } },
      },
    },
  } as const

  async listForUser(storeId: string | undefined, phone: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const normalized = phone.replace(/\D/g, '')
    return this.prisma.order.findMany({
      where: {
        storeId: sid,
        shippingPhone: { contains: normalized.slice(-10) },
      },
      include: this.storefrontOrderInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async listForCustomer(storeId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, storeId },
      select: { phone: true, email: true },
    })
    const phone = customer?.phone?.replace(/\D/g, '').slice(-10)
    const email = customer?.email?.trim().toLowerCase()
    return this.prisma.order.findMany({
      where: {
        storeId,
        OR: [
          { customerId },
          ...(phone ? [{ shippingPhone: { contains: phone } }] : []),
          ...(email ? [{ shippingEmail: { equals: email, mode: 'insensitive' as const } }] : []),
        ],
      },
      include: this.storefrontOrderInclude,
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
