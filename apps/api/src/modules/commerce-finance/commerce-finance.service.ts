import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma, RMAStatus, RMAType } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import type {
  InvoiceListRow,
  RmaListRow,
  TransactionListRow,
  TransactionStats,
} from './commerce-finance.types'
import {
  gatewayLabel,
  isoDate,
  mapInvoiceStatus,
  mapPaymentStatus,
  mapPaymentType,
  mapRmaMethod,
  mapRmaStatus,
} from './commerce-finance.util'

@Injectable()
export class CommerceFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async sid(raw?: string): Promise<string> {
    return resolveStoreId(this.prisma, raw)
  }

  async listInvoices(storeIdRaw?: string, search?: string): Promise<InvoiceListRow[]> {
    const storeId = await this.sid(storeIdRaw)
    const where: Prisma.OrderWhereInput = {
      storeId,
      status: { not: 'CANCELLED' },
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { shippingName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const rows = await this.prisma.order.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        shippingName: true,
        total: true,
        paymentStatus: true,
        createdAt: true,
        invoice: { select: { id: true, generatedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return rows.map((row) => {
      const issued = row.invoice?.generatedAt ?? row.createdAt
      const due = new Date(issued)
      due.setDate(due.getDate() + 7)

      return {
        id: row.invoice?.id ?? row.id,
        invoiceNumber: row.invoiceNumber,
        orderId: row.id,
        customer: row.shippingName,
        amount: Math.round(Number(row.total)),
        status: mapInvoiceStatus(row.paymentStatus, row.createdAt),
        issued: isoDate(issued),
        due: isoDate(due),
      }
    })
  }

  async listTransactions(storeIdRaw?: string, search?: string): Promise<{
    transactions: TransactionListRow[]
    stats: TransactionStats
  }> {
    const storeId = await this.sid(storeIdRaw)
    const where: Prisma.PaymentWhereInput = {
      order: {
        storeId,
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    }

    const rows = await this.prisma.payment.findMany({
      where,
      include: {
        order: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const transactions = rows.map((row) => ({
      id: row.id,
      orderId: row.order.id,
      orderNumber: row.order.invoiceNumber,
      gateway: gatewayLabel(row.method),
      type: mapPaymentType(row.status, row.refundedAt),
      amount: Math.round(Number(row.refundAmount ?? row.amount)),
      status: mapPaymentStatus(row.status),
      ref: row.transactionId ?? '—',
      time: row.createdAt.toISOString(),
    }))

    const payments = transactions.filter((row) => row.type === 'payment')
    const success = payments.filter((row) => row.status === 'success').length
    const volume = payments
      .filter((row) => row.status === 'success')
      .reduce((sum, row) => sum + row.amount, 0)

    return {
      transactions,
      stats: {
        volume,
        successRate: payments.length > 0 ? Math.round((success / payments.length) * 1000) / 10 : 0,
        pending: transactions.filter((row) => row.status === 'pending').length,
        failed: transactions.filter((row) => row.status === 'failed').length,
      },
    }
  }

  async listReturns(storeIdRaw?: string, search?: string): Promise<RmaListRow[]> {
    const storeId = await this.sid(storeIdRaw)
    const where: Prisma.RMAWhereInput = {
      storeId,
      ...(search
        ? {
            OR: [
              { rmaNumber: { contains: search, mode: 'insensitive' } },
              { reason: { contains: search, mode: 'insensitive' } },
              { order: { invoiceNumber: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }

    const rows = await this.prisma.rMA.findMany({
      where,
      include: {
        order: { select: { id: true, invoiceNumber: true } },
        customer: { select: { firstName: true, lastName: true } },
        items: { include: { orderItem: { select: { productName: true, quantity: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })

    return rows.map((row) => ({
      id: row.id,
      rmaNumber: row.rmaNumber,
      orderId: row.order.id,
      orderNumber: row.order.invoiceNumber,
      customer: row.customer
        ? `${row.customer.firstName} ${row.customer.lastName}`.trim()
        : 'Guest',
      reason: row.reason,
      items: row.items.map((item) => `${item.orderItem.productName} ×${item.quantity}`).join(', ') || '—',
      amount: Math.round(Number(row.refundAmount ?? 0)),
      method: mapRmaMethod(row.type),
      status: mapRmaStatus(row.status),
      updated: isoDate(row.updatedAt),
    }))
  }

  async createReturn(
    storeIdRaw: string | undefined,
    body: {
      orderId: string
      type?: RMAType
      reason: string
      description?: string
      customerId?: string
    },
  ) {
    const storeId = await this.sid(storeIdRaw)
    const order = await this.prisma.order.findFirst({
      where: { id: body.orderId, storeId },
      select: { id: true, customerId: true },
    })
    if (!order) throw new NotFoundException('Order not found')

    const rmaNumber = `RMA-${Date.now().toString(36).toUpperCase()}`
    const row = await this.prisma.rMA.create({
      data: {
        rmaNumber,
        storeId,
        orderId: order.id,
        customerId: body.customerId ?? order.customerId,
        type: body.type ?? 'RETURN',
        reason: body.reason,
        description: body.description,
        statusHistory: {
          create: { status: 'REQUESTED', note: 'RMA opened from admin' },
        },
      },
      include: {
        order: { select: { invoiceNumber: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    })

    return {
      id: row.id,
      rmaNumber: row.rmaNumber,
      orderNumber: row.order.invoiceNumber,
      status: mapRmaStatus(row.status),
    }
  }

  async updateReturnStatus(
    storeIdRaw: string | undefined,
    id: string,
    body: { status: RMAStatus; note?: string; refundAmount?: number },
  ) {
    const storeId = await this.sid(storeIdRaw)
    const existing = await this.prisma.rMA.findFirst({ where: { id, storeId } })
    if (!existing) throw new NotFoundException('RMA not found')

    const row = await this.prisma.rMA.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.refundAmount !== undefined ? { refundAmount: body.refundAmount } : {}),
        ...(body.status === 'CLOSED' || body.status === 'REFUNDED' ? { resolvedAt: new Date() } : {}),
        statusHistory: {
          create: {
            status: body.status,
            ...(body.note ? { note: body.note } : {}),
          },
        },
      },
    })

    return { id: row.id, rmaNumber: row.rmaNumber, status: mapRmaStatus(row.status) }
  }
}
