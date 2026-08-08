import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { money, num, phoneTail, reply, replyError, stamp } from '../format.ts'
import { prisma, storeId } from '../prisma.ts'

const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'COURIER_BOOKED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
  'REFUNDED',
] as const

const PAYMENT_STATUSES = [
  'UNPAID',
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function dhakaDayStart(date: string): Date {
  return new Date(`${date}T00:00:00.000+06:00`)
}

function dhakaDayEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999+06:00`)
}

export function registerOrderTools(server: McpServer): void {
  server.registerTool(
    'list_orders',
    {
      title: 'List orders',
      description:
        'Orders filtered by status, payment status or date range, newest first. Use for "pending orders", "today\'s orders", "what needs shipping".',
      inputSchema: {
        status: z.enum(ORDER_STATUSES).optional().describe('Fulfilment status filter.'),
        paymentStatus: z.enum(PAYMENT_STATUSES).optional().describe('Payment status filter.'),
        from: z.string().optional().describe('Start date YYYY-MM-DD (Asia/Dhaka), inclusive.'),
        to: z.string().optional().describe('End date YYYY-MM-DD (Asia/Dhaka), inclusive.'),
        search: z
          .string()
          .optional()
          .describe('Match invoice number, customer name or shipping phone.'),
        limit: z.number().int().min(1).max(100).optional().describe('Max rows, default 20.'),
        offset: z.number().int().min(0).optional().describe('Rows to skip, for paging.'),
      },
    },
    async ({ status, paymentStatus, from, to, search, limit, offset }) => {
      if (from && !DATE_RE.test(from)) return replyError('`from` must be YYYY-MM-DD.')
      if (to && !DATE_RE.test(to)) return replyError('`to` must be YYYY-MM-DD.')

      const where: Prisma.OrderWhereInput = { storeId: await storeId() }
      if (status) where.status = status
      if (paymentStatus) where.paymentStatus = paymentStatus
      if (from || to) {
        where.createdAt = {
          ...(from ? { gte: dhakaDayStart(from) } : {}),
          ...(to ? { lte: dhakaDayEnd(to) } : {}),
        }
      }
      if (search?.trim()) {
        const q = search.trim()
        const tail = phoneTail(q)
        where.OR = [
          { invoiceNumber: { contains: q, mode: 'insensitive' } },
          { shippingName: { contains: q, mode: 'insensitive' } },
          ...(tail ? [{ shippingPhone: { contains: tail } }] : []),
        ]
      }

      const [orders, total, valueAgg] = await Promise.all([
        prisma().order.findMany({
          where,
          take: limit ?? 20,
          skip: offset ?? 0,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            total: true,
            shippingName: true,
            shippingPhone: true,
            shippingCity: true,
            shippingDistrict: true,
            isInsideDhaka: true,
            isCodRisk: true,
            fraudScore: true,
            createdAt: true,
            _count: { select: { items: true } },
          },
        }),
        prisma().order.count({ where }),
        prisma().order.aggregate({ where, _sum: { total: true } }),
      ])

      return reply({
        count: orders.length,
        total,
        offset: offset ?? 0,
        totalValue: money(valueAgg._sum.total),
        orders: orders.map((o) => ({
          id: o.id,
          invoice: o.invoiceNumber,
          status: o.status,
          payment: `${o.paymentStatus} / ${o.paymentMethod}`,
          total: money(o.total),
          customer: o.shippingName,
          phone: o.shippingPhone,
          city: o.shippingCity,
          district: o.shippingDistrict,
          insideDhaka: o.isInsideDhaka,
          codRisk: o.isCodRisk,
          fraudScore: o.fraudScore,
          itemCount: o._count.items,
          createdAt: stamp(o.createdAt),
        })),
      })
    },
  )

  server.registerTool(
    'get_order',
    {
      title: 'Get order detail',
      description:
        'Everything about one order — line items, payments, courier shipment, status history and the customer behind it. Accepts an invoice number or order id.',
      inputSchema: {
        ref: z.string().describe('Invoice number (e.g. SPL-1042) or order id.'),
      },
    },
    async ({ ref }) => {
      const store = await storeId()
      const value = ref.trim()

      const order = await prisma().order.findFirst({
        where: { storeId: store, OR: [{ invoiceNumber: value }, { id: value }] },
        include: {
          items: true,
          payments: { orderBy: { createdAt: 'desc' } },
          courier: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              totalOrders: true,
              totalSpent: true,
              loyaltyTier: true,
              codRiskScore: true,
            },
          },
        },
      })

      if (!order) return reply({ found: false, ref: value })

      return reply({
        found: true,
        id: order.id,
        invoice: order.invoiceNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        totals: {
          subtotal: money(order.subtotal),
          deliveryCharge: money(order.deliveryCharge),
          discount: money(order.discount),
          advancePaid: money(order.advanceAmount),
          total: money(order.total),
          currency: 'BDT',
        },
        coupon: order.couponCode,
        shipping: {
          name: order.shippingName,
          phone: order.shippingPhone,
          email: order.shippingEmail,
          address: order.shippingAddress,
          city: order.shippingCity,
          district: order.shippingDistrict,
          division: order.shippingDivision,
          postal: order.shippingPostal,
          insideDhaka: order.isInsideDhaka,
        },
        risk: {
          fraudScore: order.fraudScore,
          fraudFlags: order.fraudFlags,
          codRisk: order.isCodRisk,
          requireAdvancePayment: order.requireAdvancePayment,
        },
        attribution: {
          source: order.trafficSource,
          utmSource: order.utmSource,
          utmMedium: order.utmMedium,
          utmCampaign: order.utmCampaign,
          landingPage: order.landingPage,
          referrer: order.referrer,
        },
        customer: order.customer
          ? {
              id: order.customer.id,
              name: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
              phone: order.customer.phone,
              email: order.customer.email,
              totalOrders: order.customer.totalOrders,
              totalSpent: money(order.customer.totalSpent),
              loyaltyTier: order.customer.loyaltyTier,
              codRiskScore: order.customer.codRiskScore,
            }
          : null,
        items: order.items.map((i) => ({
          product: i.productName,
          variant: i.variantName,
          sku: i.sku,
          price: money(i.price),
          quantity: i.quantity,
          subtotal: money(i.subtotal),
          productId: i.productId,
        })),
        payments: order.payments.map((p) => ({
          method: p.method,
          status: p.status,
          amount: money(p.amount),
          transactionId: p.transactionId,
          createdAt: stamp(p.createdAt),
        })),
        courier: order.courier
          ? {
              provider: order.courier.provider,
              status: order.courier.status,
              consignmentId: order.courier.consignmentId,
              trackingCode: order.courier.trackingCode,
              trackingUrl: order.courier.trackingUrl,
              codAmount: num(order.courier.codAmount),
              bookedAt: stamp(order.courier.bookedAt),
              deliveredAt: stamp(order.courier.deliveredAt),
              failureReason: order.courier.failureReason,
            }
          : null,
        statusHistory: order.statusHistory.map((h) => ({
          status: h.status,
          note: h.note,
          by: h.createdBy,
          at: stamp(h.createdAt),
        })),
        notes: order.notes,
        adminNotes: order.adminNotes,
        timeline: {
          createdAt: stamp(order.createdAt),
          confirmedAt: stamp(order.confirmedAt),
          processedAt: stamp(order.processedAt),
          deliveredAt: stamp(order.deliveredAt),
          cancelledAt: stamp(order.cancelledAt),
        },
      })
    },
  )

  server.registerTool(
    'find_orders_by_phone',
    {
      title: 'Find orders by phone',
      description:
        'Look up a Bangladeshi phone number across shipping details and customer records, and return their order history. Use for COD verification and support calls. Accepts 01712345678, 8801712345678 or +8801712345678.',
      inputSchema: {
        phone: z.string().describe('Bangladeshi phone number, any common format.'),
        limit: z.number().int().min(1).max(50).optional().describe('Max orders, default 10.'),
      },
    },
    async ({ phone, limit }) => {
      const tail = phoneTail(phone)
      if (!tail) return replyError(`"${phone}" is not a usable phone number (need 10+ digits).`)

      const store = await storeId()

      const orders = await prisma().order.findMany({
        where: {
          storeId: store,
          OR: [
            { shippingPhone: { contains: tail } },
            { customer: { phone: { contains: tail } } },
          ],
        },
        take: limit ?? 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          total: true,
          shippingName: true,
          shippingPhone: true,
          shippingCity: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      })

      const customer = await prisma().customer.findFirst({
        where: { storeId: store, phone: { contains: tail } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          totalOrders: true,
          totalSpent: true,
          loyaltyTier: true,
          codRiskScore: true,
          lastOrderDate: true,
        },
      })

      // Delivered vs cancelled/returned is the signal that matters before
      // accepting another COD order from this number.
      const delivered = orders.filter((o) => o.status === 'DELIVERED').length
      const failed = orders.filter(
        (o) => o.status === 'CANCELLED' || o.status === 'RETURNED',
      ).length

      return reply({
        phoneMatched: tail,
        customer: customer
          ? {
              id: customer.id,
              name: `${customer.firstName} ${customer.lastName}`.trim(),
              phone: customer.phone,
              email: customer.email,
              totalOrders: customer.totalOrders,
              totalSpent: money(customer.totalSpent),
              loyaltyTier: customer.loyaltyTier,
              codRiskScore: customer.codRiskScore,
              lastOrderDate: stamp(customer.lastOrderDate),
            }
          : null,
        orderCount: orders.length,
        deliveredCount: delivered,
        cancelledOrReturnedCount: failed,
        orders: orders.map((o) => ({
          id: o.id,
          invoice: o.invoiceNumber,
          status: o.status,
          payment: `${o.paymentStatus} / ${o.paymentMethod}`,
          total: money(o.total),
          name: o.shippingName,
          phone: o.shippingPhone,
          city: o.shippingCity,
          itemCount: o._count.items,
          createdAt: stamp(o.createdAt),
        })),
      })
    },
  )
}
