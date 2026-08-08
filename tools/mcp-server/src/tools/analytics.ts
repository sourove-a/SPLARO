import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { DEAD_ORDER_STATUSES, money, periodRange, reply, replyError, stamp } from '../format.ts'
import { prisma, storeId } from '../prisma.ts'

export function registerAnalyticsTools(server: McpServer): void {
  server.registerTool(
    'sales_summary',
    {
      title: 'Sales summary',
      description:
        'Revenue, order count, average order value, a status breakdown and the best-selling products for a period. Cancelled, returned and refunded orders are excluded from money totals. Answers "aja koto sale", "this week revenue".',
      inputSchema: {
        period: z
          .enum(['today', 'week', 'month', 'custom'])
          .optional()
          .describe('today | week (7d) | month (30d) | custom. Default today.'),
        from: z.string().optional().describe('Start date YYYY-MM-DD when period=custom.'),
        to: z.string().optional().describe('End date YYYY-MM-DD when period=custom.'),
        topProducts: z.number().int().min(0).max(25).optional().describe('How many best-sellers to include, default 5.'),
      },
    },
    async ({ period, from, to, topProducts }) => {
      const store = await storeId()

      let range: { start: Date; end: Date; label: string }
      try {
        range = periodRange(period ?? 'today', from, to)
      } catch (error) {
        return replyError(error instanceof Error ? error.message : String(error))
      }

      const window = { gte: range.start, lte: range.end }
      const liveOrder = {
        storeId: store,
        createdAt: window,
        status: { notIn: [...DEAD_ORDER_STATUSES] },
      }

      const [byStatus, live, delivered, topItems] = await Promise.all([
        prisma().order.groupBy({
          by: ['status'],
          where: { storeId: store, createdAt: window },
          _count: { _all: true },
          _sum: { total: true },
        }),
        prisma().order.aggregate({
          where: liveOrder,
          _count: { _all: true },
          _sum: { total: true, deliveryCharge: true, discount: true },
        }),
        prisma().order.aggregate({
          where: { storeId: store, createdAt: window, status: 'DELIVERED' },
          _count: { _all: true },
          _sum: { total: true },
        }),
        topProducts === 0
          ? Promise.resolve([])
          : prisma().orderItem.groupBy({
              by: ['productId'],
              where: { order: liveOrder },
              _sum: { quantity: true, subtotal: true },
              orderBy: { _sum: { quantity: 'desc' } },
              take: topProducts ?? 5,
            }),
      ])

      const productIds = topItems.map((i) => i.productId)
      const products = productIds.length
        ? await prisma().product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, slug: true },
          })
        : []
      const nameById = new Map(products.map((p) => [p.id, p]))

      const orderCount = live._count._all
      const revenue = money(live._sum.total)

      return reply({
        period: range.label,
        from: stamp(range.start),
        to: stamp(range.end),
        currency: 'BDT',
        orders: orderCount,
        revenue,
        averageOrderValue: orderCount > 0 ? Math.round((revenue / orderCount) * 100) / 100 : 0,
        deliveryChargeCollected: money(live._sum.deliveryCharge),
        discountGiven: money(live._sum.discount),
        delivered: {
          orders: delivered._count._all,
          revenue: money(delivered._sum.total),
        },
        statusBreakdown: byStatus
          .map((s) => ({
            status: s.status,
            orders: s._count._all,
            value: money(s._sum.total),
          }))
          .sort((a, b) => b.orders - a.orders),
        topProducts: topItems.map((i) => {
          const product = nameById.get(i.productId)
          return {
            productId: i.productId,
            name: product?.name ?? '(deleted product)',
            slug: product?.slug ?? null,
            unitsSold: i._sum.quantity ?? 0,
            revenue: money(i._sum.subtotal),
          }
        }),
        note: 'Money totals exclude CANCELLED, RETURNED and REFUNDED orders.',
      })
    },
  )

  server.registerTool(
    'top_customers',
    {
      title: 'Top customers',
      description:
        'Customers ranked by lifetime spend, with order counts, loyalty tier and COD risk score.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe('Max rows, default 10.'),
        offset: z.number().int().min(0).optional().describe('Rows to skip, for paging.'),
        orderBy: z
          .enum(['totalSpent', 'totalOrders', 'lastOrderDate'])
          .optional()
          .describe('Ranking key, default totalSpent.'),
      },
    },
    async ({ limit, offset, orderBy }) => {
      const store = await storeId()
      const key = orderBy ?? 'totalSpent'

      const customers = await prisma().customer.findMany({
        where: { storeId: store },
        take: limit ?? 10,
        skip: offset ?? 0,
        orderBy: { [key]: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          totalOrders: true,
          totalSpent: true,
          avgOrderValue: true,
          loyaltyTier: true,
          loyaltyPoints: true,
          codRiskScore: true,
          lastOrderDate: true,
        },
      })

      return reply({
        rankedBy: key,
        count: customers.length,
        customers: customers.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          phone: c.phone,
          email: c.email,
          totalOrders: c.totalOrders,
          totalSpent: money(c.totalSpent),
          avgOrderValue: money(c.avgOrderValue),
          loyaltyTier: c.loyaltyTier,
          loyaltyPoints: c.loyaltyPoints,
          codRiskScore: c.codRiskScore,
          lastOrderDate: stamp(c.lastOrderDate),
        })),
      })
    },
  )

  server.registerTool(
    'store_overview',
    {
      title: 'Store overview',
      description:
        'One-call morning briefing: today and 7-day revenue, orders waiting on action, low-stock count, catalog and customer totals. Start here when the question is broad.',
      inputSchema: {},
    },
    async () => {
      const store = await storeId()
      const today = periodRange('today')
      const week = periodRange('week')

      const liveStatuses = { notIn: [...DEAD_ORDER_STATUSES] }

      const [
        todayAgg,
        weekAgg,
        pending,
        toShip,
        inTransit,
        publishedProducts,
        totalProducts,
        customers,
        lowStockVariants,
        outOfStockVariants,
        openRmas,
        openShipments,
      ] = await Promise.all([
        prisma().order.aggregate({
          where: { storeId: store, createdAt: { gte: today.start, lte: today.end }, status: liveStatuses },
          _count: { _all: true },
          _sum: { total: true },
        }),
        prisma().order.aggregate({
          where: { storeId: store, createdAt: { gte: week.start, lte: week.end }, status: liveStatuses },
          _count: { _all: true },
          _sum: { total: true },
        }),
        prisma().order.count({ where: { storeId: store, status: 'PENDING' } }),
        prisma().order.count({
          where: { storeId: store, status: { in: ['CONFIRMED', 'PROCESSING', 'PACKED'] } },
        }),
        prisma().order.count({
          where: {
            storeId: store,
            status: { in: ['SHIPPED', 'COURIER_BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
          },
        }),
        prisma().product.count({ where: { storeId: store, isPublished: true } }),
        prisma().product.count({ where: { storeId: store } }),
        prisma().customer.count({ where: { storeId: store } }),
        prisma().productVariant.count({
          where: {
            isActive: true,
            stock: { gt: 0, lte: 5 },
            product: { storeId: store, isPublished: true },
          },
        }),
        prisma().productVariant.count({
          where: { isActive: true, stock: { lte: 0 }, product: { storeId: store, isPublished: true } },
        }),
        prisma().rMA.count({
          where: { storeId: store, status: { notIn: ['CLOSED', 'REJECTED', 'REFUNDED'] } },
        }),
        prisma().courierShipment.count({
          where: {
            order: { storeId: store },
            status: { in: ['PENDING', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'FAILED'] },
          },
        }),
      ])

      return reply({
        currency: 'BDT',
        today: { orders: todayAgg._count._all, revenue: money(todayAgg._sum.total) },
        last7Days: { orders: weekAgg._count._all, revenue: money(weekAgg._sum.total) },
        actionQueue: {
          pendingConfirmation: pending,
          readyToShip: toShip,
          inTransit: inTransit,
          openShipments,
          openReturns: openRmas,
        },
        catalog: {
          publishedProducts,
          totalProducts,
          variantsLowStock: lowStockVariants,
          variantsOutOfStock: outOfStockVariants,
        },
        customers,
        note: 'Revenue excludes CANCELLED, RETURNED and REFUNDED orders. Days are Asia/Dhaka.',
      })
    },
  )
}
