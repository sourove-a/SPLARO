import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import type { Prisma, StockAlertChannel } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { isValidBdMobile, normalizeBdPhone } from '../../common/bd-phone.util'
import { storefrontVisibleProductWhere } from '../../common/storefront-product.util'

export interface SubscribeStockAlertInput {
  productId: string
  variantId?: string
  email?: string
  phone?: string
  customerId?: string
}

export interface StockAlertSubscription {
  id: string
  productName: string
  variantName: string | null
  channel: StockAlertChannel
  /** True when this contact was already waiting on the same item. */
  alreadySubscribed: boolean
}

/** A variant is buyable when unreserved stock remains, or the shop oversells. */
export function variantIsAvailable(variant: {
  stock: number
  reservedStock: number
  isActive: boolean
}, inventoryPolicy: string): boolean {
  if (!variant.isActive) return false
  if (inventoryPolicy === 'CONTINUE' || inventoryPolicy === 'PREORDER') return true
  return variant.stock - variant.reservedStock > 0
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function variantLabel(variant: {
  size?: string | null
  color?: string | null
  colorName?: string | null
}): string | null {
  const parts = [variant.colorName || variant.color, variant.size].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

@Injectable()
export class StockAlertService {
  private readonly logger = new Logger(StockAlertService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a "tell me when it's back". Refuses an item that is already
   * buyable — an alert that would fire on the next sweep is just a confusing
   * email about something the shopper could have added to the cart.
   */
  async subscribe(
    storeId: string,
    input: SubscribeStockAlertInput,
  ): Promise<StockAlertSubscription> {
    const { channel, contact } = this.resolveContact(input)

    const product = await this.prisma.product.findFirst({
      where: storefrontVisibleProductWhere({ id: input.productId, storeId }),
      select: {
        id: true,
        name: true,
        inventoryPolicy: true,
        variants: {
          select: {
            id: true,
            stock: true,
            reservedStock: true,
            isActive: true,
            size: true,
            color: true,
            colorName: true,
          },
        },
      },
    })
    if (!product) throw new NotFoundException('Product not found')

    const variant = input.variantId
      ? product.variants.find((row) => row.id === input.variantId)
      : undefined
    if (input.variantId && !variant) {
      throw new NotFoundException('That option is not part of this product')
    }

    const watched = variant ? [variant] : product.variants
    if (watched.some((row) => variantIsAvailable(row, product.inventoryPolicy))) {
      throw new BadRequestException('This item is in stock right now')
    }

    const dedupeKey = `${product.id}:${variant?.id ?? ''}:${channel}:${contact}`
    const existing = await this.prisma.stockAlert.findUnique({
      where: { storeId_dedupeKey: { storeId, dedupeKey } },
      select: { id: true, notifiedAt: true },
    })

    if (existing) {
      // A shopper who was told once and is asking again wants telling again.
      if (existing.notifiedAt) {
        await this.prisma.stockAlert.update({
          where: { id: existing.id },
          data: { notifiedAt: null },
        })
      }
      return {
        id: existing.id,
        productName: product.name,
        variantName: variant ? variantLabel(variant) : null,
        channel,
        alreadySubscribed: !existing.notifiedAt,
      }
    }

    const created = await this.prisma.stockAlert.create({
      data: {
        storeId,
        productId: product.id,
        ...(variant ? { variantId: variant.id } : {}),
        channel,
        contact,
        ...(input.customerId ? { customerId: input.customerId } : {}),
        dedupeKey,
        unsubscribeToken: randomBytes(24).toString('base64url'),
      },
      select: { id: true },
    })

    return {
      id: created.id,
      productName: product.name,
      variantName: variant ? variantLabel(variant) : null,
      channel,
      alreadySubscribed: false,
    }
  }

  /** One-click unsubscribe from the link in the alert. Idempotent by design. */
  async unsubscribe(token: string): Promise<{ removed: boolean }> {
    const trimmed = token?.trim()
    if (!trimmed) throw new BadRequestException('Unsubscribe token is required')

    const { count } = await this.prisma.stockAlert.deleteMany({
      where: { unsubscribeToken: trimmed },
    })
    return { removed: count > 0 }
  }

  /**
   * Waiting counts per product, most-wanted first — what the shop looks at when
   * deciding what to reorder.
   */
  async waitingByProduct(storeId: string, limit = 50) {
    const grouped = await this.prisma.stockAlert.groupBy({
      by: ['productId'],
      where: { storeId, notifiedAt: null },
      _count: { _all: true },
      orderBy: { _count: { productId: 'desc' } },
      take: Math.min(200, Math.max(1, limit)),
    })
    if (!grouped.length) return []

    const products = await this.prisma.product.findMany({
      where: { id: { in: grouped.map((row) => row.productId) } },
      select: { id: true, name: true, slug: true, sku: true },
    })
    const byId = new Map(products.map((product) => [product.id, product]))

    return grouped.map((row) => ({
      productId: row.productId,
      productName: byId.get(row.productId)?.name ?? 'Deleted product',
      slug: byId.get(row.productId)?.slug ?? null,
      sku: byId.get(row.productId)?.sku ?? null,
      waiting: row._count._all,
    }))
  }

  /** Alerts still waiting whose item is buyable again. */
  async findReady(storeId: string, limit: number) {
    const pending = await this.prisma.stockAlert.findMany({
      where: { storeId, notifiedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            isPublished: true,
            isHidden: true,
            status: true,
            publishAt: true,
            inventoryPolicy: true,
            variants: {
              select: { id: true, stock: true, reservedStock: true, isActive: true },
            },
          },
        },
        variant: {
          select: {
            id: true,
            stock: true,
            reservedStock: true,
            isActive: true,
            size: true,
            color: true,
            colorName: true,
          },
        },
      },
    })

    return pending.filter((alert) => {
      const product = alert.product
      // A product pulled from the storefront must not send anyone a link to it.
      if (!product.isPublished || product.isHidden || product.status === 'ARCHIVED') return false
      if (product.publishAt && product.publishAt.getTime() > Date.now()) return false

      const watched = alert.variant ? [alert.variant] : product.variants
      return watched.some((row) => variantIsAvailable(row, product.inventoryPolicy))
    })
  }

  async markNotified(ids: string[]): Promise<void> {
    if (!ids.length) return
    await this.prisma.stockAlert.updateMany({
      where: { id: { in: ids } },
      data: { notifiedAt: new Date() },
    })
  }

  /** Label for the option a shopper asked about, for the alert body. */
  variantLabelFor(variant: Prisma.ProductVariantGetPayload<{
    select: { size: true; color: true; colorName: true }
  }> | null): string | null {
    return variant ? variantLabel(variant) : null
  }

  private resolveContact(input: SubscribeStockAlertInput): {
    channel: StockAlertChannel
    contact: string
  } {
    const email = input.email?.trim().toLowerCase() ?? ''
    const phone = input.phone?.trim() ?? ''

    if (email) {
      if (!EMAIL_PATTERN.test(email) || email.length > 200) {
        throw new BadRequestException('Enter a valid email address')
      }
      return { channel: 'EMAIL', contact: email }
    }

    if (phone) {
      const normalized = normalizeBdPhone(phone)
      if (!isValidBdMobile(normalized)) {
        throw new BadRequestException('Enter a valid Bangladeshi mobile number')
      }
      return { channel: 'SMS', contact: normalized }
    }

    throw new BadRequestException('An email address or mobile number is required')
  }
}
