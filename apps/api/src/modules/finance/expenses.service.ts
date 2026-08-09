import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { ExpensePaymentMethod, FinanceTransactionStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { FinanceAuditService } from '../../common/finance-audit.service'
import { PartnerTransactionsService } from './partners.service'
import { expenseCategoryToPartnerType, EXPENSE_CATEGORIES, parseExpenseCategory } from './expense-category.util'

const PAYMENT_METHODS: ExpensePaymentMethod[] = [
  'CASH',
  'BANK',
  'BKASH',
  'NAGAD',
  'CARD',
  'OTHER',
]

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
      category?: string
      status?: FinanceTransactionStatus | string
      partnerId?: string
      from?: string
      to?: string
      page?: number
      limit?: number
    },
  ) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit
    const category = query.category ? parseExpenseCategory(query.category) : null
    const status = query.status
      ? (String(query.status).toUpperCase() as FinanceTransactionStatus)
      : undefined
    const from = query.from ? new Date(query.from) : undefined
    const to = query.to ? new Date(query.to) : undefined
    if (from) from.setHours(0, 0, 0, 0)
    if (to) to.setHours(23, 59, 59, 999)

    const where = {
      storeId,
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(query.partnerId ? { partnerId: query.partnerId } : {}),
      ...(from || to
        ? { expenseDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
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

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      categories: EXPENSE_CATEGORIES,
      paymentMethods: PAYMENT_METHODS,
    }
  }

  async create(
    storeId: string,
    data: {
      category: string
      amount: number
      expenseDate?: string
      note?: string
      attachmentUrl?: string
      vendor?: string
      paymentMethod?: string
      recurring?: boolean
      partnerId?: string
      createdBy?: string
    },
  ) {
    const category = parseExpenseCategory(data.category)
    if (!category) {
      throw new BadRequestException(
        `Invalid expense category. Use one of: ${EXPENSE_CATEGORIES.join(', ')}`,
      )
    }
    if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
      throw new BadRequestException('Amount must be greater than 0')
    }
    const paymentMethod = this.parsePaymentMethod(data.paymentMethod, false)

    const expense = await this.prisma.expense.create({
      data: {
        storeId,
        category,
        amount: data.amount,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
        note: data.note,
        attachmentUrl: data.attachmentUrl,
        vendor: data.vendor?.trim() || null,
        paymentMethod,
        recurring: Boolean(data.recurring),
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

  async update(
    id: string,
    storeId: string,
    data: {
      category?: string
      amount?: number
      expenseDate?: string
      note?: string
      attachmentUrl?: string
      vendor?: string
      paymentMethod?: string | null
      recurring?: boolean
    },
  ) {
    const existing = await this.prisma.expense.findFirst({ where: { id, storeId } })
    if (!existing) throw new NotFoundException('Expense not found')
    if (existing.status !== 'PENDING') {
      throw new BadRequestException('Only pending expenses can be edited')
    }

    const category = data.category ? parseExpenseCategory(data.category) : undefined
    if (data.category && !category) throw new BadRequestException('Invalid expense category')
    if (data.amount != null && (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0)) {
      throw new BadRequestException('Amount must be greater than 0')
    }
    const paymentMethod =
      data.paymentMethod === undefined
        ? undefined
        : data.paymentMethod === null || data.paymentMethod === ''
          ? null
          : this.parsePaymentMethod(data.paymentMethod, true)

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(category ? { category } : {}),
        ...(data.amount != null ? { amount: data.amount } : {}),
        ...(data.expenseDate ? { expenseDate: new Date(data.expenseDate) } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.attachmentUrl !== undefined ? { attachmentUrl: data.attachmentUrl } : {}),
        ...(data.vendor !== undefined ? { vendor: data.vendor?.trim() || null } : {}),
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
        ...(data.recurring !== undefined ? { recurring: Boolean(data.recurring) } : {}),
      },
      include: { partner: { select: { name: true, slug: true } } },
    })

    await this.audit.log({
      storeId,
      action: 'UPDATE',
      resource: 'Expense',
      resourceId: id,
      after: updated,
    })

    return updated
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

    await this.partnerTx.applyApprovedExpense(
      storeId,
      {
        ...expense,
        category: expenseCategoryToPartnerType(expense.category),
      },
      approvedBy,
    )

    await this.audit.log({
      storeId,
      action: 'APPROVE',
      resource: 'Expense',
      resourceId: id,
      userId: approvedBy,
    })

    return updated
  }

  async reject(id: string, storeId: string, rejectedBy?: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, storeId } })
    if (!expense) throw new NotFoundException('Expense not found')
    if (expense.status !== 'PENDING') {
      throw new BadRequestException('Only pending expenses can be rejected')
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: { partner: { select: { name: true, slug: true } } },
    })

    await this.audit.log({
      storeId,
      action: 'REJECT',
      resource: 'Expense',
      resourceId: id,
      userId: rejectedBy,
    })

    return updated
  }

  private parsePaymentMethod(
    raw: string | undefined,
    requiredWhenPresent: boolean,
  ): ExpensePaymentMethod | null {
    if (!raw?.trim()) return null
    const parsed = raw.trim().toUpperCase() as ExpensePaymentMethod
    if (!PAYMENT_METHODS.includes(parsed)) {
      if (requiredWhenPresent) throw new BadRequestException('Invalid payment method')
      throw new BadRequestException(`Invalid payment method. Use one of: ${PAYMENT_METHODS.join(', ')}`)
    }
    return parsed
  }
}
