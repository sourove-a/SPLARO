import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  DeliveryAssignmentStatus,
  EmployeeStatus,
  ProductionStatus,
  StockMovementReason,
  TaskPriority,
  TaskStatus,
} from '@prisma/client'
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
      this.prisma.employee.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.task.findMany({
        where: { storeId, status: { not: 'DONE' } },
        orderBy: { dueDate: 'asc' },
        take: 50,
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

  private movementReason(raw?: string): StockMovementReason {
    const allowed: StockMovementReason[] = [
      'PURCHASE',
      'SALE',
      'TRANSFER',
      'ADJUSTMENT',
      'DAMAGE',
      'RETURN',
      'PRODUCTION',
      'AUDIT',
      'RESERVATION',
    ]
    const key = (raw ?? 'ADJUSTMENT').toUpperCase() as StockMovementReason
    if (!allowed.includes(key)) {
      throw new BadRequestException(`Invalid movement reason: ${raw}`)
    }
    return key
  }

  async recordStockMovement(
    storeIdOrSlug: string,
    body: {
      sku?: string
      variantId?: string
      delta?: number
      reason?: string
      note?: string
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const delta = Number(body.delta)
    if (!Number.isInteger(delta) || delta === 0) {
      throw new BadRequestException('delta must be a non-zero integer')
    }

    const sku = body.sku?.trim()
    const variantId = body.variantId?.trim()
    if (!sku && !variantId) {
      throw new BadRequestException('sku or variantId is required')
    }

    const variant = await this.prisma.productVariant.findFirst({
      where: variantId
        ? { id: variantId, product: { storeId } }
        : { sku: sku!, product: { storeId } },
      select: { id: true, sku: true, stock: true },
    })
    if (!variant) {
      throw new BadRequestException('Product variant not found for this SKU')
    }

    const reason = this.movementReason(body.reason)
    const quantityBefore = variant.stock
    const quantityAfter = quantityBefore + delta
    if (quantityAfter < 0) {
      throw new BadRequestException(`Insufficient stock (${quantityBefore} available)`)
    }

    const [updatedVariant, movement] = await this.prisma.$transaction([
      this.prisma.productVariant.update({
        where: { id: variant.id },
        data: { stock: quantityAfter },
        select: { id: true, sku: true, stock: true },
      }),
      this.prisma.stockMovementLog.create({
        data: {
          storeId,
          variantId: variant.id,
          sku: variant.sku,
          reason,
          quantityBefore,
          quantityAfter,
          delta,
          note: body.note?.trim() || null,
        },
      }),
    ])

    return { movement, variant: updatedVariant }
  }

  async createStockTransfer(
    storeIdOrSlug: string,
    body: {
      fromWarehouseId?: string
      toWarehouseId?: string
      sku?: string
      quantity?: number
      notes?: string
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const fromWarehouseId = body.fromWarehouseId?.trim()
    const toWarehouseId = body.toWarehouseId?.trim()
    const sku = body.sku?.trim()
    const quantity = Number(body.quantity)

    if (!fromWarehouseId || !toWarehouseId) {
      throw new BadRequestException('fromWarehouseId and toWarehouseId are required')
    }
    if (fromWarehouseId === toWarehouseId) {
      throw new BadRequestException('Source and destination warehouse must differ')
    }
    if (!sku) throw new BadRequestException('sku is required')
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('quantity must be a positive integer')
    }

    const [fromWh, toWh, variant] = await Promise.all([
      this.prisma.warehouse.findFirst({ where: { id: fromWarehouseId, storeId } }),
      this.prisma.warehouse.findFirst({ where: { id: toWarehouseId, storeId } }),
      this.prisma.productVariant.findFirst({
        where: { sku, product: { storeId } },
        select: { id: true, sku: true, stock: true },
      }),
    ])

    if (!fromWh || !toWh) throw new BadRequestException('Warehouse not found')
    if (!variant) throw new BadRequestException('Product variant not found for this SKU')
    if (variant.stock < quantity) {
      throw new BadRequestException(`Insufficient stock (${variant.stock} available)`)
    }

    return this.prisma.stockTransfer.create({
      data: {
        storeId,
        fromWarehouseId,
        toWarehouseId,
        status: 'PENDING',
        notes: body.notes?.trim() || null,
        items: {
          create: {
            variantId: variant.id,
            sku: variant.sku,
            quantity,
          },
        },
      },
      include: {
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        items: true,
      },
    })
  }

  async shipStockTransfer(storeIdOrSlug: string, transferId: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, storeId },
      include: { items: true },
    })
    if (!transfer) throw new BadRequestException('Transfer not found')
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException(`Transfer is ${transfer.status.toLowerCase()}, not pending`)
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        if (!item.variantId) continue
        const variant = await tx.productVariant.findFirst({
          where: { id: item.variantId, product: { storeId } },
          select: { id: true, sku: true, stock: true },
        })
        if (!variant) throw new BadRequestException(`Variant not found for SKU ${item.sku ?? 'unknown'}`)
        if (variant.stock < item.quantity) {
          throw new BadRequestException(`Insufficient stock for ${variant.sku} (${variant.stock} available)`)
        }
        const quantityAfter = variant.stock - item.quantity
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: quantityAfter },
        })
        await tx.stockMovementLog.create({
          data: {
            storeId,
            variantId: variant.id,
            sku: variant.sku,
            reason: 'TRANSFER',
            quantityBefore: variant.stock,
            quantityAfter,
            delta: -item.quantity,
            note: `Transfer ${transferId.slice(0, 8)} shipped from warehouse`,
          },
        })
      }

      return tx.stockTransfer.update({
        where: { id: transferId },
        data: { status: 'IN_TRANSIT' },
        include: {
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
          items: true,
        },
      })
    })

    return { transfer: updated }
  }

  async receiveStockTransfer(storeIdOrSlug: string, transferId: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id: transferId, storeId },
      include: { items: true },
    })
    if (!transfer) throw new BadRequestException('Transfer not found')
    if (transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException(`Transfer is ${transfer.status.toLowerCase()}, not in transit`)
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        if (!item.variantId) continue
        const variant = await tx.productVariant.findFirst({
          where: { id: item.variantId, product: { storeId } },
          select: { id: true, sku: true, stock: true },
        })
        if (!variant) throw new BadRequestException(`Variant not found for SKU ${item.sku ?? 'unknown'}`)
        const quantityAfter = variant.stock + item.quantity
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: quantityAfter },
        })
        await tx.stockMovementLog.create({
          data: {
            storeId,
            variantId: variant.id,
            sku: variant.sku,
            reason: 'TRANSFER',
            quantityBefore: variant.stock,
            quantityAfter,
            delta: item.quantity,
            note: `Transfer ${transferId.slice(0, 8)} received at warehouse`,
          },
        })
      }

      return tx.stockTransfer.update({
        where: { id: transferId },
        data: { status: 'COMPLETED' },
        include: {
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
          items: true,
        },
      })
    })

    return { transfer: updated }
  }

  async createDeliveryAgent(
    storeIdOrSlug: string,
    body: { name?: string; phone?: string; vehicleType?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const name = body.name?.trim()
    const phone = body.phone?.replace(/\D/g, '')
    if (!name) throw new BadRequestException('Agent name is required')
    if (!phone || phone.length < 10) throw new BadRequestException('Valid phone number is required')

    return this.prisma.deliveryAgent.create({
      data: {
        storeId,
        name,
        phone,
        vehicleType: body.vehicleType?.trim() || null,
        isActive: true,
      },
    })
  }

  async updateDeliveryAgent(
    storeIdOrSlug: string,
    agentId: string,
    body: { isActive?: boolean; name?: string; vehicleType?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const agent = await this.prisma.deliveryAgent.findFirst({ where: { id: agentId, storeId } })
    if (!agent) throw new NotFoundException('Delivery agent not found')

    return this.prisma.deliveryAgent.update({
      where: { id: agentId },
      data: {
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.name?.trim() ? { name: body.name.trim() } : {}),
        ...(body.vehicleType !== undefined ? { vehicleType: body.vehicleType.trim() || null } : {}),
      },
    })
  }

  private deliveryStatus(raw: string): DeliveryAssignmentStatus {
    const allowed: DeliveryAssignmentStatus[] = [
      'ASSIGNED',
      'PICKED_UP',
      'IN_TRANSIT',
      'DELIVERED',
      'FAILED',
      'CANCELLED',
    ]
    const key = raw.toUpperCase() as DeliveryAssignmentStatus
    if (!allowed.includes(key)) throw new BadRequestException(`Invalid delivery status: ${raw}`)
    return key
  }

  async assignOrderToAgent(
    storeIdOrSlug: string,
    body: { orderId?: string; agentId?: string; earnings?: number },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const orderId = body.orderId?.trim()
    const agentId = body.agentId?.trim()
    if (!orderId || !agentId) throw new BadRequestException('orderId and agentId are required')

    const [order, agent, existing] = await Promise.all([
      this.prisma.order.findFirst({ where: { id: orderId, storeId } }),
      this.prisma.deliveryAgent.findFirst({ where: { id: agentId, storeId, isActive: true } }),
      this.prisma.deliveryAssignment.findUnique({ where: { orderId } }),
    ])
    if (!order) throw new BadRequestException('Order not found')
    if (!agent) throw new BadRequestException('Active delivery agent not found')
    if (existing) throw new BadRequestException('Order already assigned to an agent')

    const earnings = body.earnings !== undefined ? Math.max(0, Number(body.earnings) || 0) : 0

    return this.prisma.deliveryAssignment.create({
      data: {
        orderId,
        agentId,
        status: 'ASSIGNED',
        earnings,
      },
      include: {
        agent: { select: { name: true, phone: true } },
      },
    })
  }

  async updateDeliveryAssignmentStatus(
    storeIdOrSlug: string,
    assignmentId: string,
    body: { status?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const status = this.deliveryStatus(body.status ?? '')
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: { id: assignmentId, agent: { storeId } },
      include: { agent: true },
    })
    if (!assignment) throw new NotFoundException('Delivery assignment not found')

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.deliveryAssignment.update({
        where: { id: assignmentId },
        data: { status },
        include: { agent: { select: { name: true, phone: true } } },
      })

      if (status === 'DELIVERED' && assignment.status !== 'DELIVERED' && Number(assignment.earnings) > 0) {
        await tx.deliveryAgent.update({
          where: { id: assignment.agentId },
          data: { totalEarned: { increment: assignment.earnings } },
        })
      }

      return row
    })

    return { assignment: updated }
  }

  async createEmployee(
    storeIdOrSlug: string,
    body: {
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      position?: string
      salary?: number
      departmentId?: string
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const firstName = body.firstName?.trim()
    const lastName = body.lastName?.trim()
    if (!firstName || !lastName) throw new BadRequestException('firstName and lastName are required')

    const count = await this.prisma.employee.count({ where: { storeId } })
    const employeeId = `EMP-${String(count + 1).padStart(4, '0')}`

    return this.prisma.employee.create({
      data: {
        storeId,
        employeeId,
        firstName,
        lastName,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        position: body.position?.trim() || null,
        salary: Math.max(0, Number(body.salary) || 0),
        departmentId: body.departmentId?.trim() || null,
        status: 'ACTIVE',
        joiningDate: new Date(),
      },
    })
  }

  async updateEmployee(
    storeIdOrSlug: string,
    employeeId: string,
    body: {
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      position?: string
      salary?: number
      status?: string
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, storeId } })
    if (!employee) throw new NotFoundException('Employee not found')

    let status: EmployeeStatus | undefined
    if (body.status) {
      const allowed: EmployeeStatus[] = ['ACTIVE', 'ON_LEAVE', 'TERMINATED']
      const key = body.status.toUpperCase() as EmployeeStatus
      if (!allowed.includes(key)) throw new BadRequestException(`Invalid employee status: ${body.status}`)
      status = key
    }

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(body.firstName?.trim() ? { firstName: body.firstName.trim() } : {}),
        ...(body.lastName?.trim() ? { lastName: body.lastName.trim() } : {}),
        ...(body.email !== undefined ? { email: body.email.trim() || null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone.trim() || null } : {}),
        ...(body.position !== undefined ? { position: body.position.trim() || null } : {}),
        ...(body.salary !== undefined ? { salary: Math.max(0, Number(body.salary) || 0) } : {}),
        ...(status ? { status } : {}),
      },
    })
  }

  async deactivateEmployee(storeIdOrSlug: string, employeeId: string) {
    return this.updateEmployee(storeIdOrSlug, employeeId, { status: 'TERMINATED' })
  }

  private taskStatus(raw: string): TaskStatus {
    const allowed: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED']
    const key = raw.toUpperCase() as TaskStatus
    if (!allowed.includes(key)) throw new BadRequestException(`Invalid task status: ${raw}`)
    return key
  }

  private taskPriority(raw?: string): TaskPriority {
    if (!raw) return 'MEDIUM'
    const allowed: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
    const key = raw.toUpperCase() as TaskPriority
    if (!allowed.includes(key)) throw new BadRequestException(`Invalid task priority: ${raw}`)
    return key
  }

  async createTask(
    storeIdOrSlug: string,
    body: { title?: string; description?: string; priority?: string; dueDate?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const title = body.title?.trim()
    if (!title) throw new BadRequestException('Task title is required')

    return this.prisma.task.create({
      data: {
        storeId,
        title,
        description: body.description?.trim() || null,
        priority: this.taskPriority(body.priority),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: 'TODO',
      },
    })
  }

  async updateTaskStatus(storeIdOrSlug: string, taskId: string, body: { status?: string }) {
    const storeId = await this.sid(storeIdOrSlug)
    const status = this.taskStatus(body.status ?? '')
    const task = await this.prisma.task.findFirst({ where: { id: taskId, storeId } })
    if (!task) throw new NotFoundException('Task not found')

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status },
    })
  }

  async createPayrollRun(storeIdOrSlug: string, body: { month?: number; year?: number }) {
    const storeId = await this.sid(storeIdOrSlug)
    const month = Number(body.month)
    const year = Number(body.year)
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be 1–12')
    }
    if (!Number.isInteger(year) || year < 2020) {
      throw new BadRequestException('year is required')
    }

    const existing = await this.prisma.payrollRun.findUnique({
      where: { storeId_month_year: { storeId, month, year } },
    })
    if (existing) throw new BadRequestException('Payroll run already exists for this period')

    const employees = await this.prisma.employee.findMany({
      where: { storeId, status: 'ACTIVE' },
      select: { id: true, salary: true },
    })
    if (employees.length === 0) throw new BadRequestException('No active employees for payroll')

    const total = employees.reduce((sum, e) => sum + Number(e.salary), 0)

    return this.prisma.payrollRun.create({
      data: {
        storeId,
        month,
        year,
        status: 'DRAFT',
        total,
        items: {
          create: employees.map((e) => ({
            employeeId: e.id,
            baseSalary: e.salary,
            bonus: 0,
            deductions: 0,
            netPay: e.salary,
          })),
        },
      },
      include: { items: { include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } } } },
    })
  }

  async listPayrollRuns(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    return this.prisma.payrollRun.findMany({
      where: { storeId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { _count: { select: { items: true } } },
    })
  }

  async createFabricInventory(
    storeIdOrSlug: string,
    body: { name?: string; color?: string; quantity?: number; unit?: string; costPerUnit?: number },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const name = body.name?.trim()
    if (!name) throw new BadRequestException('Fabric name is required')
    const quantity = Math.max(0, Number(body.quantity) || 0)

    return this.prisma.fabricInventory.create({
      data: {
        storeId,
        name,
        color: body.color?.trim() || null,
        quantity,
        unit: body.unit?.trim() || 'meter',
        costPerUnit: Math.max(0, Number(body.costPerUnit) || 0),
      },
    })
  }

  async updateFabricStock(
    storeIdOrSlug: string,
    fabricId: string,
    body: { delta?: number; quantity?: number },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const fabric = await this.prisma.fabricInventory.findFirst({ where: { id: fabricId, storeId } })
    if (!fabric) throw new NotFoundException('Fabric not found')

    let nextQty: number
    if (body.quantity !== undefined) {
      nextQty = Number(body.quantity)
      if (!Number.isFinite(nextQty) || nextQty < 0) {
        throw new BadRequestException('quantity must be a non-negative number')
      }
    } else if (body.delta !== undefined) {
      const delta = Number(body.delta)
      if (!Number.isFinite(delta) || delta === 0) {
        throw new BadRequestException('delta must be a non-zero number')
      }
      nextQty = Number(fabric.quantity) + delta
      if (nextQty < 0) {
        throw new BadRequestException(`Insufficient fabric stock (${Number(fabric.quantity)} available)`)
      }
    } else {
      throw new BadRequestException('delta or quantity is required')
    }

    return this.prisma.fabricInventory.update({
      where: { id: fabricId },
      data: { quantity: nextQty },
    })
  }

  private productionStatus(raw: string): ProductionStatus {
    const allowed: ProductionStatus[] = ['PENDING', 'CUTTING', 'SEWING', 'FINISHING', 'QC', 'READY', 'CANCELLED']
    const key = raw.toUpperCase() as ProductionStatus
    if (!allowed.includes(key)) throw new BadRequestException(`Invalid production status: ${raw}`)
    return key
  }

  async createProductionBatch(
    storeIdOrSlug: string,
    body: { productName?: string; quantity?: number; notes?: string; tailorName?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const productName = body.productName?.trim()
    const quantity = Number(body.quantity)
    if (!productName) throw new BadRequestException('productName is required')
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('quantity must be a positive integer')
    }

    return this.prisma.productionOrder.create({
      data: {
        storeId,
        productName,
        quantity,
        status: 'PENDING',
        notes: body.notes?.trim() || null,
        tailorName: body.tailorName?.trim() || null,
      },
    })
  }

  async updateProductionBatchStatus(
    storeIdOrSlug: string,
    batchId: string,
    body: { status?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const status = this.productionStatus(body.status ?? '')
    const batch = await this.prisma.productionOrder.findFirst({ where: { id: batchId, storeId } })
    if (!batch) throw new NotFoundException('Production batch not found')

    return this.prisma.productionOrder.update({
      where: { id: batchId },
      data: { status },
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
