import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Prisma, WholesaleInquiryStatus } from '@prisma/client'
import { normalizeBdPhone } from '../../common/bd-phone.util'
import { PrismaService } from '../../common/prisma.service'
import { revalidateStorefrontWeb } from '../../common/revalidate-web'
import { isWholesaleReference, reserveWholesaleReference } from './wholesale-reference'

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
  imageUrls?: string[]
  /** Slug of a published tier, when the shop publishes any. */
  tierSlug?: string
  /** Monthly volume as a number, alongside whatever they typed. */
  monthlyUnits?: number
  targetLaunch?: string
}

export interface WholesaleTierInput {
  name: string
  slug?: string
  minUnits?: number
  leadTimeDays?: number | null
  summary?: string
  perks?: string[]
  sortOrder?: number
  isActive?: boolean
}

/** A volume that is neither a typo nor a fantasy. */
const MAX_MONTHLY_UNITS = 10_000_000

function toUnits(value: unknown): number | undefined {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n <= 0 || n > MAX_MONTHLY_UNITS) return undefined
  return n
}

/** A launch date in the past is a mis-keyed year, not a plan. */
function toFutureDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  if (date.getTime() < Date.now() - 24 * 60 * 60 * 1000) return undefined
  return date
}

export function slugifyTier(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
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

/** Only same-origin wholesale uploads — never accept arbitrary remote URLs. */
function sanitizeImageUrls(urls?: string[]): string[] {
  if (!urls?.length) return []
  const out: string[] = []
  for (const raw of urls) {
    const value = raw?.trim()
    if (!value) continue
    if (!/^\/uploads\/wholesale\/[a-zA-Z0-9._-]+\.(jpe?g|png|webp)$/i.test(value)) continue
    if (!out.includes(value)) out.push(value)
    if (out.length >= 4) break
  }
  return out
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
    const imageUrls = sanitizeImageUrls(input.imageUrls)

    // Double submit (slow network, impatient tap) must not create a second lead.
    const recent = await this.prisma.wholesaleInquiry.findFirst({
      where: {
        storeId,
        phone,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, referenceCode: true },
    })
    if (recent) {
      // Hand the same reference back, so a double-tap does not look to the
      // buyer like the first submit was lost.
      return {
        id: recent.id,
        referenceCode: recent.referenceCode,
        monthlyUnits: null,
        tierName: null,
        duplicate: true as const,
      }
    }

    // The tier is resolved from its slug against this store, never trusted as
    // an id from the body — a submitted id could point at another store's row.
    const tierSlug = clean(input.tierSlug)
    const tier = tierSlug
      ? await this.prisma.wholesaleTier.findFirst({
          where: { storeId, slug: tierSlug, isActive: true },
          select: { id: true, name: true },
        })
      : null

    const monthlyUnits = toUnits(input.monthlyUnits)
    const targetLaunch = toFutureDate(input.targetLaunch)

    const created = await this.prisma.$transaction(async (tx) => {
      const referenceCode = await reserveWholesaleReference(tx)
      return tx.wholesaleInquiry.create({
        data: {
          storeId,
          fullName,
          industry,
          country,
          phone,
          imageUrls,
          referenceCode,
          ...(tier ? { tierId: tier.id } : {}),
          ...(monthlyUnits ? { monthlyUnits } : {}),
          ...(targetLaunch ? { targetLaunch } : {}),
          ...(clean(input.companyName) ? { companyName: clean(input.companyName)! } : {}),
          ...(email ? { email } : {}),
          ...(clean(input.productInterest) ? { productInterest: clean(input.productInterest)! } : {}),
          ...(clean(input.monthlyQuantity) ? { monthlyQuantity: clean(input.monthlyQuantity)! } : {}),
          ...(clean(input.message) ? { message: clean(input.message)! } : {}),
          ...(clean(input.sourcePath) ? { sourcePath: clean(input.sourcePath)! } : {}),
        },
        select: { id: true, referenceCode: true },
      })
    })

    this.logger.log(
      `Wholesale enquiry ${created.referenceCode} from ${country} (${industry})` +
        (monthlyUnits ? ` — ${monthlyUnits} units/mo` : ''),
    )
    return {
      id: created.id,
      referenceCode: created.referenceCode,
      monthlyUnits: monthlyUnits ?? null,
      tierName: tier?.name ?? null,
      duplicate: false as const,
    }
  }

  async list(
    storeId: string,
    opts: {
      status?: string
      search?: string
      page?: number
      limit?: number
      sort?: 'recent' | 'volume' | 'followup'
    } = {},
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
              // A buyer quoting WS-000042 should land on that lead and nothing
              // else, so an exact reference short-circuits the name search.
              ...(isWholesaleReference(search)
                ? [{ referenceCode: { equals: search.toUpperCase() } }]
                : []),
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { companyName: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { country: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    // Biggest first when asked, but a null volume must not outrank a real one,
    // so nulls sort last rather than to the top of a DESC.
    const orderBy: Prisma.WholesaleInquiryOrderByWithRelationInput[] =
      opts.sort === 'volume'
        ? [{ monthlyUnits: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
        : opts.sort === 'followup'
          ? [{ nextFollowUpAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }]

    const [rows, total, statusCounts, pipeline, overdue] = await Promise.all([
      this.prisma.wholesaleInquiry.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { tier: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.wholesaleInquiry.count({ where }),
      this.prisma.wholesaleInquiry.groupBy({
        by: ['status'],
        where: { storeId },
        _count: { _all: true },
        _sum: { monthlyUnits: true },
      }),
      // Units still in play — won and lost are both decided, so neither is
      // pipeline any more.
      this.prisma.wholesaleInquiry.aggregate({
        where: { storeId, status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] } },
        _sum: { monthlyUnits: true },
      }),
      this.prisma.wholesaleInquiry.count({
        where: {
          storeId,
          status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
          nextFollowUpAt: { lt: new Date() },
        },
      }),
    ])

    const counts = Object.fromEntries(
      WHOLESALE_STATUSES.map((value) => [
        value,
        statusCounts.find((row) => row.status === value)?._count._all ?? 0,
      ]),
    ) as Record<WholesaleInquiryStatus, number>

    const unitsByStatus = Object.fromEntries(
      WHOLESALE_STATUSES.map((value) => [
        value,
        statusCounts.find((row) => row.status === value)?._sum.monthlyUnits ?? 0,
      ]),
    ) as Record<WholesaleInquiryStatus, number>

    const decided = counts.WON + counts.LOST

    return {
      inquiries: rows,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts,
      funnel: {
        unitsByStatus,
        /** Units still winnable — excludes WON and LOST. */
        pipelineUnits: pipeline._sum.monthlyUnits ?? 0,
        wonUnits: unitsByStatus.WON,
        /** Share of *decided* leads that were won; undecided ones are not a loss yet. */
        winRate: decided > 0 ? Math.round((counts.WON / decided) * 100) : null,
        overdueFollowUps: overdue,
      },
    }
  }

  async update(
    storeId: string,
    id: string,
    input: {
      status?: string
      adminNotes?: string
      handledById?: string
      /** ISO date, or null to clear the reminder. */
      nextFollowUpAt?: string | null
      /** Correct the volume once the buyer has been spoken to. */
      monthlyUnits?: number | null
    },
  ) {
    const existing = await this.prisma.wholesaleInquiry.findFirst({
      where: { id, storeId },
      select: { id: true, status: true },
    })
    if (!existing) throw new NotFoundException('Enquiry not found')

    const status = this.parseStatus(input.status)
    const notes = input.adminNotes?.trim()
    const movedOn = Boolean(status && status !== 'NEW' && status !== existing.status)

    // A decided lead has nothing left to chase, so closing one clears its
    // reminder rather than leaving it to turn up overdue forever.
    const decided = status === 'WON' || status === 'LOST'
    const followUp =
      input.nextFollowUpAt === undefined
        ? undefined
        : input.nextFollowUpAt === null || !input.nextFollowUpAt.trim()
          ? null
          : (() => {
              const date = new Date(input.nextFollowUpAt)
              return Number.isNaN(date.getTime()) ? undefined : date
            })()

    return this.prisma.wholesaleInquiry.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(input.adminNotes !== undefined ? { adminNotes: notes || null } : {}),
        ...(decided
          ? { nextFollowUpAt: null }
          : followUp !== undefined
            ? { nextFollowUpAt: followUp }
            : {}),
        ...(input.monthlyUnits !== undefined
          ? { monthlyUnits: input.monthlyUnits === null ? null : (toUnits(input.monthlyUnits) ?? null) }
          : {}),
        ...(movedOn
          ? { handledAt: new Date(), ...(input.handledById ? { handledById: input.handledById } : {}) }
          : {}),
      },
      include: { tier: { select: { id: true, name: true, slug: true } } },
    })
  }

  // ── Programme tiers ──────────────────────────────────────────────

  /** Published tiers for /wholesale. Empty means the page stays enquiry-only. */
  async listPublicTiers(storeId: string) {
    return this.prisma.wholesaleTier.findMany({
      where: { storeId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { minUnits: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        minUnits: true,
        leadTimeDays: true,
        summary: true,
        perks: true,
      },
    })
  }

  async listTiers(storeId: string) {
    const tiers = await this.prisma.wholesaleTier.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { minUnits: 'asc' }],
      include: { _count: { select: { inquiries: true } } },
    })
    return { tiers }
  }

  async createTier(storeId: string, input: WholesaleTierInput) {
    const name = clean(input.name)
    if (!name) throw new BadRequestException('Tier name is required')

    const slug = slugifyTier(clean(input.slug) || name)
    if (!slug) throw new BadRequestException('Tier name must contain a letter or number')

    const clash = await this.prisma.wholesaleTier.findFirst({
      where: { storeId, slug },
      select: { id: true },
    })
    if (clash) throw new BadRequestException(`A tier with the key "${slug}" already exists`)

    const tier = await this.prisma.wholesaleTier.create({
      data: {
        storeId,
        name,
        slug,
        minUnits: Math.max(0, Math.floor(Number(input.minUnits) || 0)),
        ...(input.leadTimeDays != null && Number.isFinite(Number(input.leadTimeDays))
          ? { leadTimeDays: Math.max(0, Math.floor(Number(input.leadTimeDays))) }
          : {}),
        ...(clean(input.summary) ? { summary: clean(input.summary)! } : {}),
        perks: (input.perks ?? []).map((p) => p.trim()).filter(Boolean).slice(0, 8),
        sortOrder: Math.floor(Number(input.sortOrder) || 0),
        ...(input.isActive === false ? { isActive: false } : {}),
      },
    })
    await this.revalidateWholesale()
    return tier
  }

  async updateTier(storeId: string, id: string, input: Partial<WholesaleTierInput>) {
    const existing = await this.prisma.wholesaleTier.findFirst({
      where: { id, storeId },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Tier not found')

    // The slug is what filed leads point at, so it is deliberately not
    // editable here — renaming the tier keeps those leads attached.
    const tier = await this.prisma.wholesaleTier.update({
      where: { id },
      data: {
        ...(clean(input.name) ? { name: clean(input.name)! } : {}),
        ...(input.minUnits !== undefined
          ? { minUnits: Math.max(0, Math.floor(Number(input.minUnits) || 0)) }
          : {}),
        ...(input.leadTimeDays !== undefined
          ? {
              leadTimeDays:
                input.leadTimeDays === null || !Number.isFinite(Number(input.leadTimeDays))
                  ? null
                  : Math.max(0, Math.floor(Number(input.leadTimeDays))),
            }
          : {}),
        ...(input.summary !== undefined ? { summary: clean(input.summary) ?? null } : {}),
        ...(input.perks !== undefined
          ? { perks: input.perks.map((p) => p.trim()).filter(Boolean).slice(0, 8) }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: Math.floor(Number(input.sortOrder) || 0) } : {}),
        ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
      },
    })
    await this.revalidateWholesale()
    return tier
  }

  async removeTier(storeId: string, id: string) {
    const existing = await this.prisma.wholesaleTier.findFirst({
      where: { id, storeId },
      select: { id: true, _count: { select: { inquiries: true } } },
    })
    if (!existing) throw new NotFoundException('Tier not found')

    // Leads keep their history; the relation is SetNull, so deleting a tier
    // never takes an enquiry with it.
    await this.prisma.wholesaleTier.delete({ where: { id } })
    await this.revalidateWholesale()
    return { ok: true as const, detachedInquiries: existing._count.inquiries }
  }

  private async revalidateWholesale(): Promise<void> {
    try {
      await revalidateStorefrontWeb(['wholesale-stock', 'wholesale-tiers'])
    } catch {
      /* the page revalidates on its own schedule anyway */
    }
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

  /** Public gallery for /wholesale — only active rows, display order. */
  async listStockImages(storeId: string, opts: { activeOnly?: boolean } = {}) {
    const activeOnly = opts.activeOnly !== false
    return this.prisma.wholesaleStockImage.findMany({
      where: { storeId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async createStockImage(storeId: string, input: { url: string; title?: string }) {
    const url = this.sanitizeStockUrl(input.url)
    if (!url) throw new BadRequestException('Upload a wholesale stock image first')

    const last = await this.prisma.wholesaleStockImage.findFirst({
      where: { storeId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const row = await this.prisma.wholesaleStockImage.create({
      data: {
        storeId,
        url,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        ...(clean(input.title) ? { title: clean(input.title)! } : {}),
      },
    })
    void revalidateStorefrontWeb(['wholesale-stock'])
    return row
  }

  async updateStockImage(
    storeId: string,
    id: string,
    input: { title?: string | null; sortOrder?: number; isActive?: boolean },
  ) {
    const existing = await this.prisma.wholesaleStockImage.findFirst({
      where: { id, storeId },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Stock image not found')

    const row = await this.prisma.wholesaleStockImage.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: clean(input.title) ?? null } : {}),
        ...(typeof input.sortOrder === 'number' ? { sortOrder: input.sortOrder } : {}),
        ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
      },
    })
    void revalidateStorefrontWeb(['wholesale-stock'])
    return row
  }

  async removeStockImage(storeId: string, id: string) {
    const existing = await this.prisma.wholesaleStockImage.findFirst({
      where: { id, storeId },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Stock image not found')
    await this.prisma.wholesaleStockImage.delete({ where: { id } })
    void revalidateStorefrontWeb(['wholesale-stock'])
    return { ok: true as const }
  }

  private sanitizeStockUrl(raw?: string): string | null {
    const value = raw?.trim()
    if (!value) return null
    if (/^\/uploads\/wholesale\/[a-zA-Z0-9._/-]+\.(jpe?g|png|webp)$/i.test(value)) return value
    if (/^\/images\/[a-zA-Z0-9._/-]+\.(jpe?g|png|webp)$/i.test(value)) return value
    return null
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
