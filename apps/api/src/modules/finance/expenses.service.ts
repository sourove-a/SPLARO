import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { FinanceAuditService } from '../../common/finance-audit.service'
import { PartnerTransactionsService } from './partners.service'
import type { PartnerTransactionType, FinanceTransactionStatus } from '@prisma/client'

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinanceAuditService,
    private readonly partnerTx: PartnerTransactionsService,
  ) {}

  async list(
    storeId: string,
    query: {
      category?: PartnerTransactionType
      status?: FinanceTransactionStatus
      partnerId?: string
      page?: number
      limit?: number
    },
  ) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const where = {
      storeId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.partnerId ? { partnerId: query.partnerId } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: { partner: { select: { name: true, slug: true } } },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ])

    return { items, total, page, totalPages: Math.ceil(total / limit) }
  }

  async create(
    storeId: string,
    data: {
      category: PartnerTransactionType
      amount: number
      expenseDate?: string
      note?: string
      attachmentUrl?: string
      partnerId?: string
      createdBy?: string
    },
  ) {
    const expense = await this.prisma.expense.create({
      data: {
        storeId,
        category: data.category,
        amount: data.amount,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
        note: data.note,
        attachmentUrl: data.attachmentUrl,
        partnerId: data.partnerId,
        createdBy: data.createdBy,
        status: 'PENDING',
      },
      include: { partner: { select: { name: true, slug: true } } },
    })

    await this.audit.log({
      storeId,
      action: 'CREATE',
      resource: 'Expense',
      resourceId: expense.id,
      after: expense,
      userId: data.createdBy,
    })

    return expense
  }

  async approve(id: string, storeId: string, approvedBy?: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, storeId } })
    if (!expense) throw new NotFoundException('Expense not found')
    if (expense.status !== 'PENDING') {
      throw new BadRequestException('Expense is not pending approval')
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
      include: { partner: { select: { name: true, slug: true } } },
    })

    await this.partnerTx.applyApprovedExpense(storeId, expense, approvedBy)

    await this.audit.log({
      storeId,
      action: 'APPROVE',
      resource: 'Expense',
      resourceId: id,
      userId: approvedBy,
    })

    return updated
  }
}
