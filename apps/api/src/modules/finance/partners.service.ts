import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { FinanceAuditService } from '../../common/finance-audit.service'
import { resolveStoreId } from '../../common/store.util'
import type { PartnerTransactionType, FinanceTransactionStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

function slugifyPartnerName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'partner'
}

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinanceAuditService,
  ) {}

  private sid(raw: string) {
    return resolveStoreId(this.prisma, raw)
  }

  async ensureDefaultPartners(storeIdOrSlug: string, _createdBy?: string) {
    const storeId = await this.sid(storeIdOrSlug)
    return this.prisma.partner.findMany({
      where: { storeId, isActive: true },
      orderBy: { name: 'asc' },
    })
  }

  async create(
    storeIdOrSlug: string,
    data: {
      name: string
      slug?: string
      email?: string
      phone?: string
      sharePercent: number
      notes?: string
      createdBy?: string
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const name = data.name?.trim()
    if (!name || name.length < 2) {
      throw new BadRequestException('Partner name is required (min 2 characters)')
    }

    const sharePercent = Number(data.sharePercent)
    if (!Number.isFinite(sharePercent) || sharePercent <= 0 || sharePercent > 100) {
      throw new BadRequestException('Share percent must be between 0 and 100')
    }

    const slug = (data.slug?.trim() || slugifyPartnerName(name)).toLowerCase()
    const duplicate = await this.prisma.partner.findFirst({ where: { storeId, slug } })
    if (duplicate) {
      throw new BadRequestException('A partner with this slug already exists — choose a different name')
    }

    const partner = await this.prisma.partner.create({
      data: {
        storeId,
        name,
        slug,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        sharePercent,
        notes: data.notes?.trim() || null,
        createdBy: data.createdBy,
      },
    })

    await this.prisma.partnerShareSetting.create({
      data: {
        storeId,
        partnerId: partner.id,
        sharePercent,
        createdBy: data.createdBy,
      },
    })

    await this.audit.log({
      storeId,
      action: 'CREATE',
      resource: 'Partner',
      resourceId: partner.id,
      after: partner,
      userId: data.createdBy,
      note: `Created partner ${name}`,
    })

    return partner
  }

  async list(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const partners = await this.prisma.partner.findMany({
      where: { storeId, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    return partners.map((p) => ({
      ...p,
      lastTransaction: p.transactions[0] ?? null,
      transactions: undefined,
    }))
  }

  async getBySlug(storeIdOrSlug: string, slug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const partner = await this.prisma.partner.findFirst({
      where: { storeId, slug: slug.toLowerCase() },
      include: {
        transactions: { orderBy: { transactionDate: 'desc' }, take: 50 },
        shareSettings: { orderBy: { effectiveFrom: 'desc' }, take: 5 },
      },
    })
    if (!partner) throw new NotFoundException(`Partner ${slug} not found`)
    return partner
  }

  async updateProfile(
    storeIdOrSlug: string,
    slug: string,
    data: {
      name?: string
      email?: string
      phone?: string
      avatarUrl?: string
      notes?: string
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const partner = await this.prisma.partner.findFirst({
      where: { storeId, slug: slug.toLowerCase() },
    })
    if (!partner) throw new NotFoundException(`Partner ${slug} not found`)

    const updated = await this.prisma.partner.update({
      where: { id: partner.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
    })

    await this.audit.log({
      storeId,
      action: 'UPDATE',
      resource: 'Partner',
      resourceId: partner.id,
      after: updated,
      note: 'Updated partner profile',
    })

    return updated
  }

  async updateSharePercentages(
    storeId: string,
    shares: { partnerId: string; sharePercent: number }[],
    createdBy?: string,
  ) {
    const total = shares.reduce((s, x) => s + x.sharePercent, 0)
    if (Math.abs(total - 100) > 0.01) {
      throw new BadRequestException('Partner share percentages must total 100%')
    }

    for (const share of shares) {
      await this.prisma.partner.update({
        where: { id: share.partnerId },
        data: { sharePercent: share.sharePercent },
      })
      await this.prisma.partnerShareSetting.create({
        data: {
          storeId,
          partnerId: share.partnerId,
          sharePercent: share.sharePercent,
          createdBy,
        },
      })
    }

    await this.audit.log({
      storeId,
      action: 'UPDATE',
      resource: 'PartnerShareSetting',
      after: shares,
      userId: createdBy,
      note: 'Updated partner profit share percentages',
    })

    return this.list(storeId)
  }

  async getMonthlySummary(storeId: string, partnerId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)

    const txs = await this.prisma.partnerTransaction.findMany({
      where: {
        storeId,
        partnerId,
        status: 'APPROVED',
        transactionDate: { gte: start, lte: end },
      },
    })

    const summary: Record<string, number> = {}
    for (const tx of txs) {
      summary[tx.type] = (summary[tx.type] ?? 0) + Number(tx.amount)
    }
    return { partnerId, year, month, summary, transactionCount: txs.length }
  }
}

@Injectable()
export class PartnerTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinanceAuditService,
  ) {}

  async list(
    storeId: string,
    query: {
      partnerId?: string
      type?: PartnerTransactionType
      status?: FinanceTransactionStatus
      page?: number
      limit?: number
      search?: string
    },
  ) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const where = {
      storeId,
      ...(query.partnerId ? { partnerId: query.partnerId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { note: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.partnerTransaction.findMany({
        where,
        include: { partner: { select: { name: true, slug: true } } },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.partnerTransaction.count({ where }),
    ])

    return { items, total, page, totalPages: Math.ceil(total / limit) }
  }

  async create(
    storeId: string,
    data: {
      partnerId: string
      type: PartnerTransactionType
      amount: number
      transactionDate?: string
      note?: string
      attachmentUrl?: string
      orderId?: string
      createdBy?: string
    },
  ) {
    const partner = await this.prisma.partner.findFirst({
      where: { id: data.partnerId, storeId },
    })
    if (!partner) throw new NotFoundException('Partner not found')

    const tx = await this.prisma.partnerTransaction.create({
      data: {
        storeId,
        partnerId: data.partnerId,
        type: data.type,
        amount: data.amount,
        transactionDate: data.transactionDate ? new Date(data.transactionDate) : new Date(),
        note: data.note,
        attachmentUrl: data.attachmentUrl,
        orderId: data.orderId,
        createdBy: data.createdBy,
        status: ['INVESTMENT', 'SALES_REVENUE', 'PROFIT_DISTRIBUTION'].includes(data.type)
          ? 'APPROVED'
          : 'PENDING',
        ...( ['INVESTMENT', 'SALES_REVENUE', 'PROFIT_DISTRIBUTION'].includes(data.type)
          ? { approvedBy: data.createdBy, approvedAt: new Date() }
          : {}),
      },
      include: { partner: true },
    })

    if (tx.status === 'APPROVED') {
      await this.applyBalanceDelta(partner.id, data.type, data.amount)
    }

    await this.audit.log({
      storeId,
      action: 'CREATE',
      resource: 'PartnerTransaction',
      resourceId: tx.id,
      after: tx,
      userId: data.createdBy,
    })

    return tx
  }

  async approve(id: string, storeId: string, approvedBy?: string) {
    const tx = await this.prisma.partnerTransaction.findFirst({ where: { id, storeId } })
    if (!tx) throw new NotFoundException('Transaction not found')
    if (tx.status !== 'PENDING') throw new BadRequestException('Transaction is not pending')

    if (tx.type === 'WITHDRAWAL') {
      const partner = await this.prisma.partner.findUnique({ where: { id: tx.partnerId } })
      if (!partner) throw new NotFoundException('Partner not found')
      if (Number(partner.currentBalance) < Number(tx.amount)) {
        throw new BadRequestException(
          `Insufficient balance — ${partner.name} has ${Number(partner.currentBalance)} BDT available`,
        )
      }
    }

    const updated = await this.prisma.partnerTransaction.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
    })

    await this.applyBalanceDelta(tx.partnerId, tx.type, Number(tx.amount))

    await this.audit.log({
      storeId,
      action: 'APPROVE',
      resource: 'PartnerTransaction',
      resourceId: id,
      userId: approvedBy,
    })

    return updated
  }

  async reject(id: string, storeId: string, reason: string, rejectedBy?: string) {
    const tx = await this.prisma.partnerTransaction.findFirst({ where: { id, storeId } })
    if (!tx) throw new NotFoundException('Transaction not found')

    const updated = await this.prisma.partnerTransaction.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason,
        approvedBy: rejectedBy,
        approvedAt: new Date(),
      },
    })

    await this.audit.log({
      storeId,
      action: 'REJECT',
      resource: 'PartnerTransaction',
      resourceId: id,
      note: reason,
      userId: rejectedBy,
    })

    return updated
  }

  async applyApprovedExpense(
    storeId: string,
    expense: {
      id: string
      partnerId: string | null
      category: PartnerTransactionType
      amount: unknown
      expenseDate: Date
      note: string | null
      attachmentUrl: string | null
      createdBy: string | null
    },
    approvedBy?: string,
  ) {
    const total = Number(expense.amount)
    const partners = expense.partnerId
      ? await this.prisma.partner.findMany({ where: { id: expense.partnerId, storeId } })
      : await this.prisma.partner.findMany({ where: { storeId, isActive: true } })

    if (!partners.length) return

    for (const partner of partners) {
      const share = expense.partnerId
        ? total
        : Math.round((total * Number(partner.sharePercent)) / 100 * 100) / 100

      if (share <= 0) continue

      await this.prisma.partnerTransaction.create({
        data: {
          storeId,
          partnerId: partner.id,
          type: expense.category,
          amount: share,
          transactionDate: expense.expenseDate,
          note: expense.note ?? `Expense #${expense.id.slice(-6)}`,
          attachmentUrl: expense.attachmentUrl,
          status: 'APPROVED',
          approvedBy,
          approvedAt: new Date(),
          createdBy: expense.createdBy,
        },
      })

      await this.applyBalanceDelta(partner.id, expense.category, share)
    }
  }

  private async applyBalanceDelta(partnerId: string, type: PartnerTransactionType, amount: number) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } })
    if (!partner) return

    const amt = new Decimal(amount)
    const updates: Record<string, Decimal> = {}

    switch (type) {
      case 'INVESTMENT':
        updates.totalInvestment = partner.totalInvestment.add(amt)
        updates.currentBalance = partner.currentBalance.add(amt)
        break
      case 'WITHDRAWAL':
        updates.totalWithdrawal = partner.totalWithdrawal.add(amt)
        updates.currentBalance = partner.currentBalance.sub(amt)
        break
      case 'SALES_REVENUE':
        updates.totalSalesContribution = partner.totalSalesContribution.add(amt)
        updates.currentBalance = partner.currentBalance.add(amt)
        break
      case 'PROFIT_DISTRIBUTION':
        updates.totalProfitShare = partner.totalProfitShare.add(amt)
        updates.currentBalance = partner.currentBalance.add(amt)
        break
      default:
        updates.totalExpenseShare = partner.totalExpenseShare.add(amt)
        updates.currentBalance = partner.currentBalance.sub(amt)
        break
    }

    await this.prisma.partner.update({ where: { id: partnerId }, data: updates })
  }
}
