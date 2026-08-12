import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { money, periodRange } from '../format.ts'
import { prisma, storeId } from '../prisma.ts'

export function registerResources(server: McpServer): void {
  // 1. Today Metrics Resource: splaro://metrics/today
  server.registerResource(
    'today_metrics',
    'splaro://metrics/today',
    {
      description: 'Realtime JSON snapshot of revenue, orders, and action queue for today.',
      mimeType: 'application/json',
    },
    async () => {
      const store = await storeId()
      const range = periodRange('today')
      const window = { gte: range.start, lte: range.end }

      const [todayAggregate, pendingOrders, readyToShip] = await Promise.all([
        prisma().order.aggregate({
          where: {
            storeId: store,
            createdAt: window,
            status: { notIn: ['CANCELLED', 'RETURNED', 'REFUNDED'] },
          },
          _count: { _all: true },
          _sum: { total: true },
        }),
        prisma().order.count({
          where: { storeId: store, status: 'PENDING' },
        }),
        prisma().order.count({
          where: { storeId: store, status: 'CONFIRMED' },
        }),
      ])

      const payload = {
        storeId: store,
        date: range.label,
        today: {
          ordersCount: todayAggregate._count._all,
          revenue: money(todayAggregate._sum.total ?? 0),
        },
        actionQueue: {
          pendingOrders,
          readyToShip,
        },
        timestamp: new Date().toISOString(),
      }

      return {
        contents: [
          {
            uri: 'splaro://metrics/today',
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2),
          },
        ],
      }
    },
  )

  // 2. Catalog Summary Resource: splaro://catalog/summary
  server.registerResource(
    'catalog_summary',
    'splaro://catalog/summary',
    {
      description: 'Snapshot of active categories, published products, and low stock items.',
      mimeType: 'application/json',
    },
    async () => {
      const store = await storeId()

      const [publishedProducts, totalProducts, categoriesCount] = await Promise.all([
        prisma().product.count({
          where: { storeId: store, status: 'PUBLISHED' },
        }),
        prisma().product.count({
          where: { storeId: store },
        }),
        prisma().category.count({
          where: { storeId: store },
        }),
      ])

      const payload = {
        storeId: store,
        publishedProducts,
        totalProducts,
        categoriesCount,
        timestamp: new Date().toISOString(),
      }

      return {
        contents: [
          {
            uri: 'splaro://catalog/summary',
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2),
          },
        ],
      }
    },
  )
}
