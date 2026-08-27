import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma, RMAStatus, RMAType } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'

/**
 * How long after delivery a customer may open a return. Matches the
 * `merchantReturnDays` the storefront advertises in product JSON-LD
 * (apps/web/src/app/products/[slug]/page.tsx) — the two must move together or
 * the shop promises a window it then refuses.
 */
export const DEFAULT_RETURN_WINDOW_DAYS = 7

/** RMA states that still hold stock against the order's returnable quantity. */
const OPEN_RMA_STATUSES: RMAStatus[] = [
  'REQUESTED',
  'APPROVED',
  'ITEM_RECEIVED',
  'PROCESSED',
  'REFUNDED',
  'EXCHANGED',
  'CLOSED',
]

/** Only these can be opened by a customer — REPAIR stays an admin-side flow. */
const CUSTOMER_RMA_TYPES: RMAType[] = ['RETURN', 'EXCHANGE']

export interface StorefrontReturnItemInput {
  orderItemId: string
  quantity: number
}

export interface CreateStorefrontReturnInput {
  orderId: string
  type?: RMAType
  reason: string
  description?: string
  images?: string[]
  items: StorefrontReturnItemInput[]
}

export interface PublicReturnItem {
  orderItemId: string
  productName: string
  variantName: string | null
  image: string | null
  quantity: number
}

export interface PublicReturn {
  id: string
  rmaNumber: string
  orderId: string
  invoiceNumber: string
  type: RMAType
  status: RMAStatus
  reason: string
  description: string | null
  images: string[]
  refundAmount: number | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  items: PublicReturnItem[]
  timeline: { status: RMAStatus; note: string | null; at: string }[]
}

export interface ReturnableOrderItem {
  orderItemId: string
  productName: string
  variantName: string | null
  image: string | null
  orderedQuantity: number
  returnableQuantity: number
}

export interface ReturnEligibility {
  orderId: string
  invoiceNumber: string
  eligible: boolean
  /** Machine-readable so the storefront can pick its own copy. */
  reason: 'OK' | 'NOT_DELIVERED' | 'WINDOW_CLOSED' | 'NOTHING_RETURNABLE'
  windowDays: number
  /** Null when the order was never delivered. */
  windowClosesAt: string | null
  items: ReturnableOrderItem[]
}

export function returnWindowDays(): number {
  const raw = Number(process.env['STOREFRONT_RETURN_WINDOW_DAYS'])
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_RETURN_WINDOW_DAYS
}

const RETURN_INCLUDE = {
  order: { select: { id: true, invoiceNumber: true } },
  items: {
    include: {
      orderItem: {
        select: { id: true, productName: true, variantName: true, image: true },
      },
    },
  },
  statusHistory: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.RMAInclude

type ReturnRow = Prisma.RMAGetPayload<{ include: typeof RETURN_INCLUDE }>

function toPublicReturn(row: ReturnRow): PublicReturn {
  return {
    id: row.id,
    rmaNumber: row.rmaNumber,
    orderId: row.order.id,
    invoiceNumber: row.order.invoiceNumber,
    type: row.type,
    status: row.status,
    reason: row.reason,
    description: row.description,
    images: row.images,
    refundAmount: row.refundAmount === null ? null : Number(row.refundAmount),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: row.items.map((item) => ({
      orderItemId: item.orderItemId,
      productName: item.orderItem.productName,
      variantName: item.orderItem.variantName,
      image: item.orderItem.image,
      quantity: item.quantity,
    })),
    timeline: row.statusHistory.map((entry) => ({
      status: entry.status,
      note: entry.note,
      at: entry.createdAt.toISOString(),
    })),
  }
}

@Injectable()
export class StorefrontReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCustomer(storeId: string, customerId: string): Promise<PublicReturn[]> {
    const rows = await this.prisma.rMA.findMany({
      where: { storeId, customerId },
      include: RETURN_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return rows.map(toPublicReturn)
  }

  async getForCustomer(
    storeId: string,
    customerId: string,
    id: string,
  ): Promise<PublicReturn> {
    const row = await this.prisma.rMA.findFirst({
      where: { id, storeId, customerId },
      include: RETURN_INCLUDE,
    })
    if (!row) throw new NotFoundException('Return request not found')
    return toPublicReturn(row)
  }

  /**
   * What the customer may still send back on this order, and why not when the
   * answer is nothing. The storefront calls this before showing the form so a
   * shopper never fills one in only to be refused on submit.
   */
  async eligibility(
    storeId: string,
    customerId: string,
    orderId: string,
  ): Promise<ReturnEligibility> {
    const order = await this.loadOrder(storeId, customerId, orderId)
    const windowDays = returnWindowDays()
    const deliveredAt = order.deliveredAt
    const windowClosesAt = deliveredAt
      ? new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000)
      : null
    const items = this.returnableItems(order)

    const reason: ReturnEligibility['reason'] =
      order.status !== 'DELIVERED' || !deliveredAt
        ? 'NOT_DELIVERED'
        : windowClosesAt && windowClosesAt.getTime() < Date.now()
          ? 'WINDOW_CLOSED'
          : items.every((item) => item.returnableQuantity === 0)
            ? 'NOTHING_RETURNABLE'
            : 'OK'

    return {
      orderId: order.id,
      invoiceNumber: order.invoiceNumber,
      eligible: reason === 'OK',
      reason,
      windowDays,
      windowClosesAt: windowClosesAt?.toISOString() ?? null,
      items,
    }
  }

  async create(
    storeId: string,
    customerId: string,
    input: CreateStorefrontReturnInput,
  ): Promise<PublicReturn> {
    const type = input.type ?? 'RETURN'
    if (!CUSTOMER_RMA_TYPES.includes(type)) {
      throw new BadRequestException('Only return or exchange requests can be opened here')
    }

    const reason = input.reason?.trim() ?? ''
    if (reason.length < 4) {
      throw new BadRequestException('Tell us briefly why you are sending this back')
    }

    const eligibility = await this.eligibility(storeId, customerId, input.orderId)
    if (!eligibility.eligible) {
      throw new BadRequestException(
        eligibility.reason === 'NOT_DELIVERED'
          ? 'This order has not been delivered yet'
          : eligibility.reason === 'WINDOW_CLOSED'
            ? `The ${eligibility.windowDays}-day return window for this order has closed`
            : 'Every item on this order has already been requested for return',
      )
    }

    const returnable = new Map(
      eligibility.items.map((item) => [item.orderItemId, item.returnableQuantity]),
    )
    const requested = new Map<string, number>()
    for (const line of input.items ?? []) {
      const allowed = returnable.get(line.orderItemId)
      if (allowed === undefined) {
        throw new BadRequestException('An item on this request is not part of the order')
      }
      const quantity = Math.floor(Number(line.quantity))
      if (!Number.isFinite(quantity) || quantity < 1) {
        throw new BadRequestException('Return quantity must be at least 1')
      }
      const total = (requested.get(line.orderItemId) ?? 0) + quantity
      if (total > allowed) {
        throw new BadRequestException(
          allowed === 0
            ? 'That item has already been requested for return'
            : `You can return at most ${allowed} of that item`,
        )
      }
      requested.set(line.orderItemId, total)
    }
    if (!requested.size) {
      throw new BadRequestException('Choose at least one item to return')
    }

    // rmaNumber is @unique and the admin generator uses the same shape, so a
    // collision is a retry, not a 500.
    const row = await this.prisma.rMA.create({
      data: {
        rmaNumber: `RMA-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1296)
          .toString(36)
          .toUpperCase()
          .padStart(2, '0')}`,
        storeId,
        orderId: eligibility.orderId,
        customerId,
        type,
        reason,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(input.images?.length ? { images: input.images } : {}),
        items: {
          create: [...requested.entries()].map(([orderItemId, quantity]) => ({
            orderItemId,
            quantity,
          })),
        },
        statusHistory: {
          create: { status: 'REQUESTED', note: 'Opened by the customer from the storefront' },
        },
      },
      include: RETURN_INCLUDE,
    })

    return toPublicReturn(row)
  }

  private async loadOrder(storeId: string, customerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId, customerId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        deliveredAt: true,
        items: {
          select: {
            id: true,
            productName: true,
            variantName: true,
            image: true,
            quantity: true,
          },
        },
        rmas: {
          where: { status: { in: OPEN_RMA_STATUSES } },
          select: { items: { select: { orderItemId: true, quantity: true } } },
        },
      },
    })
    if (!order) throw new NotFoundException('Order not found')
    return order
  }

  private returnableItems(
    order: Awaited<ReturnType<StorefrontReturnsService['loadOrder']>>,
  ): ReturnableOrderItem[] {
    const claimed = new Map<string, number>()
    for (const rma of order.rmas) {
      for (const item of rma.items) {
        claimed.set(item.orderItemId, (claimed.get(item.orderItemId) ?? 0) + item.quantity)
      }
    }

    return order.items.map((item) => ({
      orderItemId: item.id,
      productName: item.productName,
      variantName: item.variantName,
      image: item.image,
      orderedQuantity: item.quantity,
      returnableQuantity: Math.max(0, item.quantity - (claimed.get(item.id) ?? 0)),
    }))
  }
}
