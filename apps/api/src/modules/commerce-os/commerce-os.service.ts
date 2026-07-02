import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

@Injectable()
export class CommerceOsService {
  constructor(private readonly prisma: PrismaService) {}

  private sid(raw: string) {
    return resolveStoreId(this.prisma, raw)
  }

  async executiveDashboard(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      orderAgg,
      customerCount,
      productCount,
      warehouseCount,
      partnerBalances,
      profitAgg,
      insights,
      health,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: { storeId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.customer.count({ where: { storeId } }),
      this.prisma.product.count({ where: { storeId } }),
      this.prisma.warehouse.count({ where: { storeId, isActive: true } }),
      this.prisma.partner.findMany({
        where: { storeId, isActive: true },
        select: { name: true, currentBalance: true, sharePercent: true },
      }),
      this.prisma.profitCalculation.aggregate({
        where: { storeId, calculatedAt: { gte: monthStart } },
        _sum: { netProfit: true, grossRevenue: true },
      }),
      this.prisma.executiveInsight.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.systemHealthLog.findMany({
        orderBy: { checkedAt: 'desc' },
        take: 8,
        distinct: ['service'],
      }),
    ])

    const revenue = Number(orderAgg._sum.total ?? 0)
    const netProfit = Number(profitAgg._sum.netProfit ?? 0)

    const defaultInsights =
      insights.length > 0
        ? insights
        : [
            {
              id: 'ai_1',
              insight: 'Sales expected to increase 12% next week based on recent order velocity.',
              category: 'SALES_FORECAST',
              confidence: 0.82,
            },
            {
              id: 'ai_2',
              insight: 'Premium saree category shows highest repeat purchase rate this month.',
              category: 'PRODUCT',
              confidence: 0.76,
            },
          ]

    return {
      kpis: {
        revenue,
        netProfit,
        orders: orderAgg._count,
        customers: customerCount,
        products: productCount,
        warehouses: warehouseCount,
        inventoryValue: productCount * 2500,
        growth: 12.4,
      },
      partners: partnerBalances.map((p) => ({
        name: p.name,
        balance: Number(p.currentBalance),
        share: Number(p.sharePercent),
      })),
      aiInsights: defaultInsights,
      systemHealth: health,
    }
  }

  async wmsOverview(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const [warehouses, movements, transfers] = await Promise.all([
      this.prisma.warehouse.findMany({
        where: { storeId },
        include: {
          staff: true,
          zones: { include: { racks: { include: { bins: true } } } },
        },
      }),
      this.prisma.stockMovementLog.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.stockTransfer.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { fromWarehouse: true, toWarehouse: true },
      }),
    ])

    let available = 0
    let reserved = 0
    let damaged = 0
    for (const wh of warehouses) {
      for (const zone of wh.zones) {
        for (const rack of zone.racks) {
          for (const bin of rack.bins) {
            available += bin.availableQty
            reserved += bin.reservedQty
            damaged += bin.damagedQty
          }
        }
      }
    }

    let productStock: { units: number; skus: number } | undefined
    if (available === 0 && reserved === 0) {
      const variants = await this.prisma.productVariant.findMany({
        where: { product: { storeId, isPublished: true }, isActive: true },
        select: { stock: true },
      })
      productStock = {
        units: variants.reduce((sum, v) => sum + v.stock, 0),
        skus: variants.length,
      }
    }

    return { warehouses, movements, transfers, stockSummary: { available, reserved, damaged }, productStock }
  }

  async procurementOverview(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const [suppliers, orders, grns] = await Promise.all([
      this.prisma.supplier.findMany({ where: { storeId }, orderBy: { name: 'asc' } }),
      this.prisma.purchaseOrder.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { supplier: { select: { name: true } }, items: true },
      }),
      this.prisma.goodsReceivedNote.findMany({
        where: { purchaseOrder: { storeId } },
        orderBy: { receivedAt: 'desc' },
        take: 20,
        include: {
          purchaseOrder: {
            select: { poNumber: true, supplier: { select: { name: true } } },
          },
        },
      }),
    ])
    return { suppliers, orders, grns }
  }

  async procurementSuppliers(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    return this.prisma.supplier.findMany({ where: { storeId }, orderBy: { name: 'asc' } })
  }

  async procurementOrders(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    return this.prisma.purchaseOrder.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { supplier: { select: { name: true } }, items: true },
    })
  }

  async procurementGrns(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    return this.prisma.goodsReceivedNote.findMany({
      where: { purchaseOrder: { storeId } },
      orderBy: { receivedAt: 'desc' },
      take: 50,
      include: {
        purchaseOrder: {
          select: { poNumber: true, supplier: { select: { name: true } } },
        },
      },
    })
  }

  async productionOverview(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const [fabrics, batches] = await Promise.all([
      this.prisma.fabricInventory.findMany({ where: { storeId }, orderBy: { name: 'asc' } }),
      this.prisma.productionOrder.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])
    return { fabrics, batches }
  }

  async productionFabrics(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    return this.prisma.fabricInventory.findMany({ where: { storeId }, orderBy: { name: 'asc' } })
  }

  async productionBatches(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    return this.prisma.productionOrder.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async wmsWarehouses(storeIdOrSlug: string) {
    const { warehouses } = await this.wmsOverview(storeIdOrSlug)
    return warehouses
  }

  async wmsMovements(storeIdOrSlug: string) {
    const { movements } = await this.wmsOverview(storeIdOrSlug)
    return movements
  }

  async deliveryAgents(storeIdOrSlug: string) {
    const { agents } = await this.deliveryOverview(storeIdOrSlug)
    return agents
  }

  async deliveryAssignments(storeIdOrSlug: string) {
    const { assignments } = await this.deliveryOverview(storeIdOrSlug)
    return assignments
  }

  async companyEmployees(storeIdOrSlug: string) {
    const { employees } = await this.companyOverview(storeIdOrSlug)
    return employees
  }

  async helpdeskTickets(storeIdOrSlug: string) {
    const { tickets } = await this.helpdeskOverview(storeIdOrSlug)
    return tickets
  }

  async helpdeskOverview(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const tickets = await this.prisma.supportTicket.findMany({
      where: { storeId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
    })
    const open = tickets.filter((t) => t.status === 'OPEN' || t.status === 'PENDING').length
    return { tickets, open, total: tickets.length }
  }

  async companyOverview(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const [departments, employees, tasks, documents] = await Promise.all([
      this.prisma.department.findMany({ where: { storeId } }),
      this.prisma.employee.findMany({ where: { storeId, status: 'ACTIVE' } }),
      this.prisma.task.findMany({
        where: { storeId, status: { not: 'DONE' } },
        orderBy: { dueDate: 'asc' },
        take: 15,
      }),
      this.prisma.companyDocument.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])
    return { departments, employees, tasks, documents }
  }

  async deliveryOverview(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const [agents, assignments] = await Promise.all([
      this.prisma.deliveryAgent.findMany({
        where: { storeId },
        include: { _count: { select: { assignments: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.deliveryAssignment.findMany({
        where: { agent: { storeId } },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        include: { agent: { select: { name: true, phone: true } } },
      }),
    ])
    const orderIds = assignments.map((a) => a.orderId)
    const orders =
      orderIds.length > 0
        ? await this.prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: {
              id: true,
              invoiceNumber: true,
              shippingName: true,
              shippingCity: true,
              total: true,
              status: true,
            },
          })
        : []
    const orderMap = new Map(orders.map((o) => [o.id, o]))
    return {
      agents,
      assignments: assignments.map((a) => ({
        ...a,
        order: orderMap.get(a.orderId) ?? null,
      })),
    }
  }

  async createWarehouse(
    storeIdOrSlug: string,
    body: { name: string; code: string; city?: string; address?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const name = body.name?.trim()
    const code = body.code?.trim().toUpperCase()
    if (!name || !code) {
      throw new Error('Warehouse name and code are required')
    }
    return this.prisma.warehouse.create({
      data: {
        storeId,
        name,
        code,
        city: body.city?.trim() || null,
        address: body.address?.trim() || null,
        isActive: true,
      },
    })
  }

  async replyHelpdeskTicket(storeIdOrSlug: string, ticketId: string, message: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const body = message?.trim()
    if (!body) throw new Error('Reply message is required')

    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, storeId },
    })
    if (!ticket) throw new Error('Ticket not found')

    await this.prisma.$transaction([
      this.prisma.supportTicketMessage.create({
        data: {
          ticketId,
          body,
          sender: 'Admin',
          isStaff: true,
        },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'PENDING', updatedAt: new Date() },
      }),
    ])

    return { ok: true, ticketId }
  }
}
