import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Prisma, WholesaleInquiryStatus } from '@prisma/client'
import { normalizeBdPhone } from '../../common/bd-phone.util'
import { PrismaService } from '../../common/prisma.service'

export interface WholesaleInquiryInput {
  fullName: string
  companyName?: string
  industry: string
  country: string
  phone: string
  email?: string
  productInterest?: string
  monthlyQuantity?: string
  message?: string
  sourcePath?: string
}

const WHOLESALE_STATUSES: WholesaleInquiryStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'WON',
  'LOST',
]

/** Two identical submits inside this window are the same buyer double-tapping. */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000

function clean(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

@Injectable()
export class WholesaleService {
  private readonly logger = new Logger(WholesaleService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bangladesh numbers are stored in the same 01… form the rest of the app uses,
   * so an enquiry can be matched against orders and customers later. Foreign
   * numbers are kept verbatim — this form is aimed at export buyers too.
   */
  private normalizePhone(raw: string, country: string): string {
    const trimmed = raw.trim()
    const isBd = /bangladesh|^bd$/i.test(country.trim())
    if (!isBd) return trimmed
    const normalized = normalizeBdPhone(trimmed)
    return normalized || trimmed
  }

  async submit(storeId: string, input: WholesaleInquiryInput) {
    const fullName = clean(input.fullName)
    const industry = clean(input.industry)
    const country = clean(input.country)
    const rawPhone = clean(input.phone)

    if (!fullName || !industry || !country || !rawPhone) {
      throw new BadRequestException('Name, industry, country, and phone number are required')
    }

    const phone = this.normalizePhone(rawPhone, country)
    const email = clean(input.email)?.toLowerCase()

    // Double submit (slow network, impatient tap) must not create a second lead.
    const recent = await this.prisma.wholesaleInquiry.findFirst({
      where: {
        storeId,
        phone,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    })
    if (recent) {
      return { id: recent.id, duplicate: true as const }
    }

    const created = await this.prisma.wholesaleInquiry.create({
      data: {
        storeId,
        fullName,
        industry,
        country,
        phone,
        ...(clean(input.companyName) ? { companyName: clean(input.companyName)! } : {}),
        ...(email ? { email } : {}),
        ...(clean(input.productInterest) ? { productInterest: clean(input.productInterest)! } : {}),
        ...(clean(input.monthlyQuantity) ? { monthlyQuantity: clean(input.monthlyQuantity)! } : {}),
        ...(clean(input.message) ? { message: clean(input.message)! } : {}),
        ...(clean(input.sourcePath) ? { sourcePath: clean(input.sourcePath)! } : {}),
      },
      select: { id: true },
    })

    this.logger.log(`Wholesale enquiry ${created.id} from ${country} (${industry})`)
    return { id: created.id, duplicate: false as const }
  }

  async list(
    storeId: string,
    opts: { status?: string; search?: string; page?: number; limit?: number } = {},
  ) {
    const page = Math.max(1, Number(opts.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 25))
    const status = this.parseStatus(opts.status)
    const search = clean(opts.search)

    const where: Prisma.WholesaleInquiryWhereInput = {
      storeId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { companyName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } },
              { country: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [rows, total, statusCounts] = await Promise.all([
      this.prisma.wholesaleInquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.wholesaleInquiry.count({ where }),
      this.prisma.wholesaleInquiry.groupBy({
        by: ['status'],
        where: { storeId },
        _count: { _all: true },
      }),
    ])

    const counts = Object.fromEntries(
      WHOLESALE_STATUSES.map((value) => [
        value,
        statusCounts.find((row) => row.status === value)?._count._all ?? 0,
      ]),
    ) as Record<WholesaleInquiryStatus, number>

    return {
      inquiries: rows,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts,
    }
  }

  async update(
    storeId: string,
    id: string,
    input: { status?: string; adminNotes?: string; handledById?: string },
  ) {
    const existing = await this.prisma.wholesaleInquiry.findFirst({
      where: { id, storeId },
      select: { id: true, status: true },
    })
    if (!existing) throw new NotFoundException('Enquiry not found')

    const status = this.parseStatus(input.status)
    const notes = input.adminNotes?.trim()
    const movedOn = Boolean(status && status !== 'NEW' && status !== existing.status)

    return this.prisma.wholesaleInquiry.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(input.adminNotes !== undefined ? { adminNotes: notes || null } : {}),
        ...(movedOn
          ? { handledAt: new Date(), ...(input.handledById ? { handledById: input.handledById } : {}) }
          : {}),
      },
    })
  }

  async remove(storeId: string, id: string) {
    const existing = await this.prisma.wholesaleInquiry.findFirst({
      where: { id, storeId },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Enquiry not found')
    await this.prisma.wholesaleInquiry.delete({ where: { id } })
    return { ok: true as const }
  }

  private parseStatus(value?: string): WholesaleInquiryStatus | undefined {
    if (!value) return undefined
    const upper = value.trim().toUpperCase() as WholesaleInquiryStatus
    if (!WHOLESALE_STATUSES.includes(upper)) {
      throw new BadRequestException(`Unknown status: ${value}`)
    }
    return upper
  }
}
