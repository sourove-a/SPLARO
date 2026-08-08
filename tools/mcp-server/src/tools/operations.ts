import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { money, num, phoneTail, reply, replyError, stamp } from '../format.ts'
import { prisma, storeId } from '../prisma.ts'

const RMA_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'ITEM_RECEIVED',
  'PROCESSED',
  'REFUNDED',
  'EXCHANGED',
  'CLOSED',
] as const

const RMA_TYPES = ['RETURN', 'EXCHANGE', 'REPAIR'] as const

const COURIER_STATUSES = [
  'PENDING',
  'BOOKED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'RETURNED',
  'FAILED',
  'CANCELLED',
] as const

/** Courier states that still need someone to chase them. */
const OPEN_COURIER_STATUSES = ['PENDING', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'FAILED'] as const

function daysSince(date: Date | null): number | null {
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

export function registerOperationsTools(server: McpServer): void {
  server.registerTool(
    'rma_queue',
    {
      title: 'Returns and exchanges queue',
      description:
        'Return, exchange and repair requests with their order, customer and refund amount. Oldest first so nothing rots in the queue.',
      inputSchema: {
        status: z.enum(RMA_STATUSES).optional().describe('Filter by RMA status.'),
        type: z.enum(RMA_TYPES).optional().describe('Filter by request type.'),
        openOnly: z
          .boolean()
          .optional()
          .describe('Only requests that are not CLOSED, REJECTED or REFUNDED. Default true.'),
        limit: z.number().int().min(1).max(100).optional().describe('Max rows, default 20.'),
        offset: z.number().int().min(0).optional().describe('Rows to skip, for paging.'),
      },
    },
    async ({ status, type, openOnly, limit, offset }) => {
      const where: Prisma.RMAWhereInput = { storeId: await storeId() }
      if (status) where.status = status
      if (type) where.type = type
      if (openOnly !== false && !status) {
        where.status = { notIn: ['CLOSED', 'REJECTED', 'REFUNDED'] }
      }

      const rmas = await prisma().rMA.findMany({
        where,
        take: limit ?? 20,
        skip: offset ?? 0,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          rmaNumber: true,
          type: true,
          status: true,
          reason: true,
          description: true,
          refundAmount: true,
          resolvedAt: true,
          createdAt: true,
          order: { select: { invoiceNumber: true, total: true, shippingName: true, shippingPhone: true } },
          _count: { select: { items: true } },
        },
      })

      return reply({
        count: rmas.length,
        rmas: rmas.map((r) => ({
          id: r.id,
          rmaNumber: r.rmaNumber,
          type: r.type,
          status: r.status,
          reason: r.reason,
          description: r.description,
          refundAmount: num(r.refundAmount),
          itemCount: r._count.items,
          order: r.order.invoiceNumber,
          orderTotal: money(r.order.total),
          customer: r.order.shippingName,
          phone: r.order.shippingPhone,
          ageDays: daysSince(r.createdAt),
          createdAt: stamp(r.createdAt),
          resolvedAt: stamp(r.resolvedAt),
        })),
      })
    },
  )

  server.registerTool(
    'courier_watch',
    {
      title: 'Courier shipments needing attention',
      description:
        'Shipments that are booked but not yet delivered, oldest first, with age in days and any failure reason. Use to find parcels stuck with the courier.',
      inputSchema: {
        status: z.enum(COURIER_STATUSES).optional().describe('Filter to one courier status.'),
        stuckDays: z
          .number()
          .int()
          .min(0)
          .max(90)
          .optional()
          .describe('Only shipments booked at least this many days ago.'),
        limit: z.number().int().min(1).max(100).optional().describe('Max rows, default 25.'),
        offset: z.number().int().min(0).optional().describe('Rows to skip, for paging.'),
      },
    },
    async ({ status, stuckDays, limit, offset }) => {
      const where: Prisma.CourierShipmentWhereInput = { order: { storeId: await storeId() } }
      where.status = status ?? { in: [...OPEN_COURIER_STATUSES] }
      if (stuckDays !== undefined) {
        where.bookedAt = { lte: new Date(Date.now() - stuckDays * 86_400_000) }
      }

      const shipments = await prisma().courierShipment.findMany({
        where,
        take: limit ?? 25,
        skip: offset ?? 0,
        orderBy: { bookedAt: 'asc' },
        select: {
          id: true,
          provider: true,
          status: true,
          consignmentId: true,
          trackingCode: true,
          trackingUrl: true,
          codAmount: true,
          failureReason: true,
          retryCount: true,
          bookedAt: true,
          order: {
            select: {
              invoiceNumber: true,
              status: true,
              total: true,
              shippingName: true,
              shippingPhone: true,
              shippingCity: true,
            },
          },
        },
      })

      return reply({
        filter: status ? `status = ${status}` : 'open shipments (not delivered/returned/cancelled)',
        count: shipments.length,
        shipments: shipments.map((s) => ({
          invoice: s.order.invoiceNumber,
          orderStatus: s.order.status,
          provider: s.provider,
          courierStatus: s.status,
          consignmentId: s.consignmentId,
          trackingCode: s.trackingCode,
          trackingUrl: s.trackingUrl,
          codAmount: num(s.codAmount),
          orderTotal: money(s.order.total),
          customer: s.order.shippingName,
          phone: s.order.shippingPhone,
          city: s.order.shippingCity,
          failureReason: s.failureReason,
          retryCount: s.retryCount,
          ageDays: daysSince(s.bookedAt),
          bookedAt: stamp(s.bookedAt),
        })),
      })
    },
  )

  server.registerTool(
    'abandoned_carts',
    {
      title: 'Abandoned carts',
      description:
        'Carts that still hold items but have gone quiet, newest first, with their recoverable value and whether recovery messages already went out.',
      inputSchema: {
        quietHours: z
          .number()
          .int()
          .min(1)
          .max(720)
          .optional()
          .describe('How long a cart must have been untouched to count. Default 2 hours.'),
        identifiedOnly: z
          .boolean()
          .optional()
          .describe('Only carts attached to a known customer (so they are contactable).'),
        limit: z.number().int().min(1).max(100).optional().describe('Max rows, default 20.'),
        offset: z.number().int().min(0).optional().describe('Rows to skip, for paging.'),
      },
    },
    async ({ quietHours, identifiedOnly, limit, offset }) => {
      const store = await storeId()
      const cutoff = new Date(Date.now() - (quietHours ?? 2) * 3_600_000)

      const where: Prisma.CartSessionWhereInput = {
        storeId: store,
        updatedAt: { lte: cutoff },
        items: { some: {} },
      }
      if (identifiedOnly) where.customerId = { not: null }

      const carts = await prisma().cartSession.findMany({
        where,
        take: limit ?? 20,
        skip: offset ?? 0,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          sessionId: true,
          isAbandoned: true,
          expiresAt: true,
          updatedAt: true,
          recoveryEmailSentAt: true,
          recoverySmsSentAt: true,
          recoveryWaSentAt: true,
          customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          items: {
            select: {
              quantity: true,
              product: { select: { id: true, name: true, basePrice: true } },
              variant: { select: { size: true, color: true, price: true, stock: true } },
            },
          },
        },
      })

      const rows = carts.map((c) => {
        const value = c.items.reduce(
          (sum, i) => sum + money(i.variant?.price ?? i.product.basePrice) * i.quantity,
          0,
        )
        return {
          cartId: c.id,
          customer: c.customer
            ? {
                id: c.customer.id,
                name: `${c.customer.firstName} ${c.customer.lastName}`.trim(),
                phone: c.customer.phone,
                email: c.customer.email,
              }
            : null,
          itemCount: c.items.reduce((sum, i) => sum + i.quantity, 0),
          value,
          items: c.items.map((i) => ({
            product: i.product.name,
            size: i.variant?.size ?? null,
            color: i.variant?.color ?? null,
            quantity: i.quantity,
            price: money(i.variant?.price ?? i.product.basePrice),
            inStock: i.variant ? i.variant.stock > 0 : null,
          })),
          flaggedAbandoned: c.isAbandoned,
          recoverySent: {
            email: stamp(c.recoveryEmailSentAt),
            sms: stamp(c.recoverySmsSentAt),
            whatsapp: stamp(c.recoveryWaSentAt),
          },
          lastActivity: stamp(c.updatedAt),
          expiresAt: stamp(c.expiresAt),
        }
      })

      const total = await prisma().cartSession.count({ where })

      return reply({
        quietHours: quietHours ?? 2,
        count: rows.length,
        total,
        offset: offset ?? 0,
        valueOnThisPage: Math.round(rows.reduce((sum, r) => sum + r.value, 0) * 100) / 100,
        currency: 'BDT',
        carts: rows,
      })
    },
  )

  server.registerTool(
    'get_customer',
    {
      title: 'Get customer detail',
      description:
        'One customer with lifetime stats, saved addresses and recent orders. Accepts a customer id, email or phone number.',
      inputSchema: {
        ref: z.string().describe('Customer id, email address, or Bangladeshi phone number.'),
        orderLimit: z.number().int().min(1).max(50).optional().describe('Recent orders to include, default 10.'),
      },
    },
    async ({ ref, orderLimit }) => {
      const store = await storeId()
      const value = ref.trim()
      const tail = phoneTail(value)

      const customer = await prisma().customer.findFirst({
        where: {
          storeId: store,
          OR: [
            { id: value },
            { email: { equals: value, mode: 'insensitive' } },
            ...(tail ? [{ phone: { contains: tail } }] : []),
          ],
        },
        include: {
          addresses: true,
          orders: {
            take: orderLimit ?? 10,
            orderBy: { createdAt: 'desc' },
            select: {
              invoiceNumber: true,
              status: true,
              paymentStatus: true,
              total: true,
              createdAt: true,
              _count: { select: { items: true } },
            },
          },
        },
      })

      if (!customer) return reply({ found: false, ref: value })

      const delivered = customer.orders.filter((o) => o.status === 'DELIVERED').length
      const failed = customer.orders.filter(
        (o) => o.status === 'CANCELLED' || o.status === 'RETURNED',
      ).length

      return reply({
        found: true,
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        phone: customer.phone,
        email: customer.email,
        lifetime: {
          totalOrders: customer.totalOrders,
          totalSpent: money(customer.totalSpent),
          avgOrderValue: money(customer.avgOrderValue),
          firstOrderDate: stamp(customer.firstOrderDate),
          lastOrderDate: stamp(customer.lastOrderDate),
        },
        loyalty: {
          tier: customer.loyaltyTier,
          points: customer.loyaltyPoints,
          vipScore: customer.vipScore,
          referralCode: customer.referralCode,
        },
        risk: { codRiskScore: customer.codRiskScore },
        acceptMarketing: customer.acceptMarketing,
        tags: customer.tags,
        notes: customer.notes,
        adminNotes: customer.adminNotes,
        addresses: customer.addresses.map((a) => ({
          label: a.label,
          name: `${a.firstName} ${a.lastName}`.trim(),
          phone: a.phone,
          address: [a.addressLine1, a.addressLine2].filter(Boolean).join(', '),
          city: a.city,
          district: a.district,
          division: a.division,
          postalCode: a.postalCode,
          isDefault: a.isDefault,
          insideDhaka: a.isInsideDhaka,
        })),
        recentOrders: {
          shown: customer.orders.length,
          deliveredCount: delivered,
          cancelledOrReturnedCount: failed,
          orders: customer.orders.map((o) => ({
            invoice: o.invoiceNumber,
            status: o.status,
            paymentStatus: o.paymentStatus,
            total: money(o.total),
            itemCount: o._count.items,
            createdAt: stamp(o.createdAt),
          })),
        },
      })
    },
  )

  server.registerTool(
    'list_taxonomy',
    {
      title: 'Categories and collections',
      description:
        'Every category (with its parent) and collection, each with how many products sit in it. Use to learn the valid categorySlug values before filtering the catalog.',
      inputSchema: {
        kind: z
          .enum(['categories', 'collections', 'both'])
          .optional()
          .describe('What to list, default both.'),
        includeInactive: z.boolean().optional().describe('Include deactivated entries. Default false.'),
      },
    },
    async ({ kind, includeInactive }) => {
      const store = await storeId()
      const want = kind ?? 'both'
      const activeFilter = includeInactive ? {} : { isActive: true }

      const categories =
        want === 'collections'
          ? []
          : await prisma().category.findMany({
              where: { storeId: store, ...activeFilter },
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                parent: { select: { name: true, slug: true } },
                _count: { select: { products: true } },
              },
            })

      const collections =
        want === 'categories'
          ? []
          : await prisma().collection.findMany({
              where: { storeId: store, ...activeFilter },
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                _count: { select: { products: true } },
              },
            })

      return reply({
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          parent: c.parent?.name ?? null,
          parentSlug: c.parent?.slug ?? null,
          productCount: c._count.products,
          isActive: c.isActive,
        })),
        collections: collections.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          productCount: c._count.products,
          isActive: c.isActive,
        })),
      })
    },
  )

  server.registerTool(
    'inventory_history',
    {
      title: 'Stock movement history',
      description:
        'Recent inventory log entries for one product or variant — what changed the stock, by how much, and why. Use to explain a stock discrepancy.',
      inputSchema: {
        productRef: z.string().describe('Product id, slug or SKU.'),
        limit: z.number().int().min(1).max(100).optional().describe('Max entries, default 25.'),
      },
    },
    async ({ productRef, limit }) => {
      const store = await storeId()
      const value = productRef.trim()

      const product = await prisma().product.findFirst({
        where: {
          storeId: store,
          OR: [{ id: value }, { slug: value }, { sku: value }, { rmCode: value }],
        },
        select: { id: true, name: true, slug: true },
      })
      if (!product) return replyError(`No product matched "${value}".`)

      const logs = await prisma().inventoryLog.findMany({
        where: { productId: product.id },
        take: limit ?? 25,
        orderBy: { createdAt: 'desc' },
        select: {
          action: true,
          quantity: true,
          stockBefore: true,
          stockAfter: true,
          note: true,
          orderId: true,
          createdBy: true,
          createdAt: true,
          variant: { select: { sku: true, size: true, color: true } },
        },
      })

      return reply({
        product: { id: product.id, name: product.name, slug: product.slug },
        count: logs.length,
        movements: logs.map((l) => ({
          action: l.action,
          quantity: l.quantity,
          stockBefore: l.stockBefore,
          stockAfter: l.stockAfter,
          note: l.note,
          orderId: l.orderId,
          by: l.createdBy,
          variant: l.variant
            ? [l.variant.sku, l.variant.size, l.variant.color].filter(Boolean).join(' / ')
            : null,
          at: stamp(l.createdAt),
        })),
      })
    },
  )
}
