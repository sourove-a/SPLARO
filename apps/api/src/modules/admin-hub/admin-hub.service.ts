import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { GoogleSearchConsoleService } from '../google-workspace/google-search-console.service'
import {
  formatSocialHandle,
  resolveSocialUrl,
  type SocialPlatformKey,
} from '../settings/social-channel-defaults'
import type { Prisma, SupportTicketChannel, TaskPriority } from '@prisma/client'
import {
  applyPaymentToBalance,
  applyPurchaseToBalance,
  computePurchaseTotals,
  fromPaisa,
  nextSequenceCode,
  normalizePhone,
  normalizePurchaseItems,
  splitStockableItems,
  type PurchaseItemInput,
} from './procurement.core'

const STATIC_CMS_PAGES = [
  { id: 'cms-about', slug: '/about', title: 'About SPLARO', blocks: 6 },
  { id: 'cms-shipping', slug: '/shipping', title: 'Shipping & Delivery', blocks: 4 },
  { id: 'cms-returns', slug: '/returns', title: 'Returns & Exchanges', blocks: 5 },
  { id: 'cms-privacy', slug: '/privacy', title: 'Privacy Policy', blocks: 8 },
  { id: 'cms-terms', slug: '/terms', title: 'Terms of Service', blocks: 7 },
  { id: 'cms-size', slug: '/size-guide', title: 'Size Guide', blocks: 3 },
  { id: 'cms-faq', slug: '/faq', title: 'FAQ', blocks: 5 },
  { id: 'cms-contact', slug: '/contact', title: 'Contact', blocks: 4 },
]

@Injectable()
export class AdminHubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchConsole: GoogleSearchConsoleService,
  ) {}

  private sid(storeIdOrSlug: string) {
    return resolveStoreId(this.prisma, storeIdOrSlug)
  }

  private async buildSocialChannels(storeId: string, whatsappInboxCount: number) {
    const settings = await this.prisma.siteSettings.findUnique({ where: { storeId } })

    const platforms: { id: string; platform: string; key: SocialPlatformKey }[] = [
      { id: 'instagram', platform: 'Instagram', key: 'instagram' },
      { id: 'facebook', platform: 'Facebook', key: 'facebook' },
      { id: 'tiktok', platform: 'TikTok', key: 'tiktok' },
      { id: 'youtube', platform: 'YouTube', key: 'youtube' },
    ]

    const channels = platforms.map(({ id, platform, key }) => {
      const stored =
        key === 'instagram'
          ? settings?.instagramUrl
          : key === 'facebook'
            ? settings?.facebookUrl
            : key === 'tiktok'
              ? settings?.tiktokUrl
              : settings?.youtubeUrl
      const resolved = resolveSocialUrl(stored, key)
      return {
        id,
        platform,
        storedUrl: resolved.storedUrl,
        url: resolved.url,
        handle: formatSocialHandle(id, resolved.url),
        status: resolved.status,
        storefrontVisible: resolved.storefrontVisible,
        inboxCount: 0,
      }
    })

    const whatsappStored = settings?.whatsappNumber?.trim() ?? ''
    channels.push({
      id: 'whatsapp',
      platform: 'WhatsApp',
      storedUrl: whatsappStored || null,
      url: whatsappStored ? `https://wa.me/${whatsappStored.replace(/\D/g, '')}` : '',
      handle: whatsappStored || '—',
      status: whatsappStored ? 'live' : 'empty',
      storefrontVisible: Boolean(whatsappStored),
      inboxCount: whatsappInboxCount,
    })

    const visible = channels.filter((c) => c.storefrontVisible).length
    const savedInDb = channels.filter((c) => c.status === 'live').length

    return {
      channels,
      summary: {
        total: channels.length,
        storefrontLive: visible,
        savedInDatabase: savedInDb,
        usingBrandDefaults: channels.filter((c) => c.status === 'default').length,
      },
    }
  }

  async updateSocialChannels(
    storeIdOrSlug: string,
    body: {
      instagram?: string
      facebook?: string
      tiktok?: string
      youtube?: string
      whatsapp?: string
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    })
    if (!store) throw new NotFoundException(`Store not found: ${storeIdOrSlug}`)

    const normalize = (v: string | undefined) => {
      if (v === undefined) return undefined
      const trimmed = v.trim()
      return trimmed || null
    }

    await this.prisma.siteSettings.upsert({
      where: { storeId },
      create: {
        storeId,
        instagramUrl: normalize(body.instagram) ?? null,
        facebookUrl: normalize(body.facebook) ?? null,
        tiktokUrl: normalize(body.tiktok) ?? null,
        youtubeUrl: normalize(body.youtube) ?? null,
        whatsappNumber: normalize(body.whatsapp) ?? null,
      },
      update: {
        ...(body.instagram !== undefined ? { instagramUrl: normalize(body.instagram) } : {}),
        ...(body.facebook !== undefined ? { facebookUrl: normalize(body.facebook) } : {}),
        ...(body.tiktok !== undefined ? { tiktokUrl: normalize(body.tiktok) } : {}),
        ...(body.youtube !== undefined ? { youtubeUrl: normalize(body.youtube) } : {}),
        ...(body.whatsapp !== undefined ? { whatsappNumber: normalize(body.whatsapp) } : {}),
      },
    })

    const whatsappLogs = await this.prisma.notificationDeliveryLog.count({
      where: { storeId, channel: 'WHATSAPP' },
    })

    return this.buildSocialChannels(storeId, whatsappLogs)
  }

  async contentOverview(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const [posts, categories, banners, collections, campaigns] = await Promise.all([
      this.prisma.blogPost.findMany({
        where: { storeId },
        orderBy: { updatedAt: 'desc' },
        include: { category: { select: { name: true } } },
      }),
      this.prisma.blogCategory.findMany({ where: { storeId }, orderBy: { name: 'asc' } }),
      this.prisma.banner.findMany({ where: { storeId }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.collection.findMany({
        where: { storeId },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.campaign.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, name: true, status: true, type: true, totalSent: true, createdAt: true },
      }),
    ])

    return {
      posts,
      categories,
      banners,
      collections,
      campaigns,
      staticPages: STATIC_CMS_PAGES.map((p) => ({
        ...p,
        status: 'published',
        updatedAt: new Date().toISOString(),
      })),
    }
  }

  async createBlogPost(
    storeIdOrSlug: string,
    body: { title: string; content?: string; excerpt?: string; status?: 'DRAFT' | 'PUBLISHED' },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80)
    const uniqueSlug = `${slug}-${Date.now().toString(36)}`
    return this.prisma.blogPost.create({
      data: {
        storeId,
        title: body.title,
        slug: uniqueSlug,
        content: body.content ?? '',
        excerpt: body.excerpt,
        status: body.status ?? 'DRAFT',
        ...(body.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
      },
    })
  }

  async seoOverview(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const [configs, products, searches, blogPosts, collections, categories] = await Promise.all([
      this.prisma.seoConfig.findMany({ where: { storeId }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.product.findMany({
        where: { storeId, isPublished: true },
        select: {
          id: true,
          name: true,
          slug: true,
          metaTitle: true,
          metaDescription: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.searchAnalytics.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.blogPost.count({ where: { storeId, status: 'PUBLISHED' } }),
      this.prisma.collection.count({ where: { storeId, isActive: true } }),
      this.prisma.category.count({ where: { storeId, isActive: true } }),
    ])

    const keywordCounts = new Map<string, number>()
    for (const row of searches) {
      const q = row.query.trim().toLowerCase()
      if (q) keywordCounts.set(q, (keywordCounts.get(q) ?? 0) + 1)
    }
    const keywords = [...keywordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([keyword, volume], index) => ({
        id: `kw-${index}`,
        keyword,
        volume,
        position: null,
        change: '—',
        difficulty: null,
        signalSource: 'storefront_search' as const,
        status: volume > 5 ? 'good' : volume > 1 ? 'warning' : 'pending',
      }))

    const configByResource = new Map(
      configs.filter((c) => c.resourceId).map((c) => [c.resourceId!, c]),
    )

    const productAudits = products.map((p) => {
      const cfg = configByResource.get(p.id)
      let score = 100
      if (!p.metaTitle) score -= 20
      if (!p.metaDescription) score -= 20
      if (cfg?.seoScore != null) score = cfg.seoScore
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        score: Math.max(0, score),
        hasMetaTitle: Boolean(p.metaTitle),
        hasMetaDescription: Boolean(p.metaDescription),
        lastAuditAt: cfg?.lastAuditAt?.toISOString() ?? null,
      }
    })

    // No Search Console / Bing Webmaster integration is connected, so real
    // index status is unknown. Report 'unknown' honestly — `status` reflects
    // meta completeness, which IS real data from the catalog.
    const indexPages = [
      ...products.slice(0, 15).map((p) => ({
        url: `/products/${p.slug}`,
        google: 'unknown',
        bing: 'unknown',
        lastCrawl: null as string | null,
        status: p.metaTitle && p.metaDescription ? 'good' : 'warning',
      })),
      ...collections > 0
        ? [{ url: '/collections', google: 'unknown', bing: 'unknown', lastCrawl: null as string | null, status: 'good' }]
        : [],
    ]

    const schemaGroups = new Map<string, { type: string; pages: number; valid: number; errors: number }>()
    for (const cfg of configs) {
      const type = cfg.schemaType ?? cfg.resourceType
      const row = schemaGroups.get(type) ?? { type, pages: 0, valid: 0, errors: 0 }
      row.pages += 1
      if ((cfg.seoScore ?? 100) >= 70) row.valid += 1
      else row.errors += 1
      schemaGroups.set(type, row)
    }
    if (schemaGroups.size === 0) {
      schemaGroups.set('Product', { type: 'Product', pages: products.length, valid: productAudits.filter((p) => p.score >= 70).length, errors: productAudits.filter((p) => p.score < 70).length })
    }

    const sitemaps = [
      { id: 'sm-products', name: 'products.xml', urls: products.length, status: 'good' },
      { id: 'sm-collections', name: 'collections.xml', urls: collections, status: 'good' },
      { id: 'sm-categories', name: 'categories.xml', urls: categories, status: 'good' },
      { id: 'sm-blog', name: 'blog.xml', urls: blogPosts, status: blogPosts > 0 ? 'good' : 'warning' },
    ]

    const redirects = configs
      .filter((c) => c.canonicalUrl)
      .map((c, i) => ({
        id: `canonical-${c.id}`,
        from: `/${c.resourceType}/${c.resourceId ?? i}`,
        to: c.canonicalUrl!,
        type: '301',
        hits: 0,
        status: 'good',
        source: 'canonical' as const,
      }))

    let managedRedirects: {
      id: string
      from: string
      to: string
      type: string
      hits: number
      status: string
      source: 'rule'
      note: string | null
      isActive: boolean
    }[] = []

    try {
      const urlRedirects = await this.prisma.urlRedirect.findMany({
        where: { storeId },
        orderBy: { createdAt: 'asc' },
      })
      managedRedirects = urlRedirects.map((r) => ({
        id: r.id,
        from: r.fromPath,
        to: r.toPath,
        type: r.type,
        hits: r.hits,
        status: r.isActive ? 'good' : 'warning',
        source: 'rule' as const,
        note: r.note,
        isActive: r.isActive,
      }))
    } catch {
      /* Stale Prisma client until API restart after schema change */
    }

    const allRedirects = [...managedRedirects, ...redirects]

    const avgScore =
      productAudits.length > 0
        ? Math.round(productAudits.reduce((s, p) => s + p.score, 0) / productAudits.length)
        : 0

    return {
      keywords,
      indexPages,
      schemas: [...schemaGroups.values()].map((s, i) => ({
        id: `sch-${i}`,
        ...s,
        lastCheck: new Date().toISOString(),
      })),
      sitemaps: sitemaps.map((s) => ({
        ...s,
        lastGen: new Date().toISOString(),
        submitted: 'Not submitted',
      })),
      redirects: allRedirects,
      productAudits,
      searchConsole: await this.seoSearchConsole(storeId),
      summary: {
        avgScore,
        criticalErrors: productAudits.filter((p) => p.score < 50).length,
        warnings: productAudits.filter((p) => p.score >= 50 && p.score < 80).length,
        products: products.length,
      },
    }
  }

  private async seoSearchConsole(storeId: string) {
    try {
      const gsc = await this.searchConsole.getStatus(storeId)
      return {
        connected: gsc.connected,
        status: gsc.status,
        message: gsc.message,
        property: gsc.property,
        lastSuccessAt: gsc.lastSuccessAt,
      }
    } catch {
      return {
        connected: false,
        status: 'not_connected' as const,
        message: 'Google ranking and crawl data unavailable until Search Console OAuth is connected.',
        property: null,
        lastSuccessAt: null,
      }
    }
  }

  async marketingOverview(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const [affiliates, campaigns, whatsappLogs, emailCampaigns, emailLogs, smsLogs] = await Promise.all([
      this.prisma.affiliateAccount.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.campaign.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' }, take: 30 }),
      this.prisma.notificationDeliveryLog.findMany({
        where: { storeId, channel: 'WHATSAPP' },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.campaign.findMany({
        where: { storeId, type: 'EMAIL' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.notificationDeliveryLog.findMany({
        where: { storeId, channel: 'EMAIL' },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.notificationDeliveryLog.findMany({
        where: { storeId, channel: 'SMS' },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
    ])

    const whatsappCampaigns = campaigns.filter((c) => c.type === 'WHATSAPP')
    const social = await this.buildSocialChannels(storeId, whatsappLogs.length)

    return {
      affiliates,
      campaigns,
      whatsappLogs,
      whatsappCampaigns,
      emailCampaigns,
      emailLogs,
      smsLogs,
      socialChannels: social.channels,
      socialSummary: social.summary,
    }
  }

  async notificationsOverview(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const logs = await this.prisma.notificationDeliveryLog.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 60,
    })
    const sent = logs.filter((l) => l.status === 'SENT' || l.status === 'DELIVERED').length
    const failed = logs.filter((l) => l.status === 'FAILED').length
    const pending = logs.filter((l) => l.status === 'PENDING').length
    return {
      logs: logs.map((l) => ({
        id: l.id,
        channel: l.channel,
        recipient: l.recipient,
        subject: l.subject,
        body: l.body,
        status: l.status,
        level: l.level,
        createdAt: l.createdAt.toISOString(),
      })),
      summary: {
        total: logs.length,
        sent,
        failed,
        pending,
        critical: logs.filter((l) => l.level === 'critical').length,
        deliveredRate: logs.length > 0 ? Math.round((sent / logs.length) * 1000) / 10 : 0,
      },
    }
  }

  async commerceSubscriptionsOverview(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const customers = await this.prisma.customer.findMany({
      where: { storeId, totalOrders: { gte: 2 } },
      orderBy: { totalOrders: 'desc' },
      take: 50,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        totalOrders: true,
        totalSpent: true,
        loyaltyTier: true,
        updatedAt: true,
      },
    })
    return customers.map((c) => {
      const spent = Number(c.totalSpent)
      const avg = c.totalOrders > 0 ? spent / c.totalOrders : 0
      return {
        id: c.id,
        customer: `${c.firstName} ${c.lastName}`.trim(),
        plan: c.loyaltyTier === 'PLATINUM' || c.loyaltyTier === 'GOLD' ? 'VIP Repeat' : 'Repeat buyer',
        frequency: c.totalOrders >= 5 ? 'Frequent' : 'Regular',
        amount: Math.round(avg),
        nextBill: '—',
        status: 'active',
        orders: c.totalOrders,
        updatedAt: c.updatedAt.toISOString(),
      }
    })
  }

  async createAffiliate(
    storeIdOrSlug: string,
    body: { name: string; email?: string; code: string; commissionRate?: number },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    return this.prisma.affiliateAccount.create({
      data: {
        storeId,
        name: body.name,
        email: body.email,
        code: body.code.toUpperCase(),
        commissionRate: body.commissionRate ?? 10,
        status: 'PENDING',
      },
    })
  }

  // ── Procurement ─────────────────────────────────────────────────────────

  async listSupplierMarkets(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    return this.prisma.supplierMarket.findMany({
      where: { storeId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { suppliers: true } } },
    })
  }

  async createSupplierMarket(
    storeIdOrSlug: string,
    body: { name: string; area?: string; city?: string; country?: string; note?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const name = body.name?.trim()
    if (!name) throw new BadRequestException('Market name is required')

    const existing = await this.prisma.supplierMarket.findFirst({ where: { storeId, name } })
    if (existing) throw new BadRequestException(`Market "${name}" already exists`)

    return this.prisma.supplierMarket.create({
      data: {
        storeId,
        name,
        area: body.area?.trim() || null,
        city: body.city?.trim() || null,
        country: body.country?.trim() || null,
        note: body.note?.trim() || null,
      },
    })
  }

  async updateSupplierMarket(
    storeIdOrSlug: string,
    marketId: string,
    body: {
      name?: string
      area?: string
      city?: string
      country?: string
      note?: string
      isActive?: boolean
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const market = await this.prisma.supplierMarket.findFirst({ where: { id: marketId, storeId } })
    if (!market) throw new NotFoundException('Market not found')

    const name = body.name?.trim()
    if (name && name !== market.name) {
      const clash = await this.prisma.supplierMarket.findFirst({ where: { storeId, name } })
      if (clash) throw new BadRequestException(`Market "${name}" already exists`)
    }

    return this.prisma.supplierMarket.update({
      where: { id: market.id },
      data: {
        name: name ?? undefined,
        area: body.area?.trim() ?? undefined,
        city: body.city?.trim() ?? undefined,
        country: body.country?.trim() ?? undefined,
        note: body.note?.trim() ?? undefined,
        isActive: body.isActive ?? undefined,
      },
    })
  }

  async listSuppliers(storeIdOrSlug: string, query?: { search?: string; marketId?: string }) {
    const storeId = await this.sid(storeIdOrSlug)
    const search = query?.search?.trim()
    const marketId = query?.marketId?.trim()

    return this.prisma.supplier.findMany({
      where: {
        storeId,
        ...(marketId ? { marketId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search } },
                { shopName: { contains: search, mode: 'insensitive' as const } },
                { code: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        market: { select: { id: true, name: true, city: true } },
        categories: { include: { category: { select: { id: true, name: true } } } },
        _count: { select: { purchaseOrders: true } },
      },
    })
  }

  async getSupplier(storeIdOrSlug: string, supplierId: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, storeId },
      include: {
        market: true,
        categories: { include: { category: { select: { id: true, name: true } } } },
      },
    })
    if (!supplier) throw new NotFoundException('Supplier not found')

    const [purchases, payments, ledger] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: { storeId, supplierId },
        orderBy: { purchasedAt: 'desc' },
        take: 50,
        include: { items: true, market: { select: { name: true } } },
      }),
      this.prisma.supplierPayment.findMany({
        where: { supplierId },
        orderBy: { paidAt: 'desc' },
        take: 50,
      }),
      this.prisma.supplierLedgerEntry.findMany({
        where: { supplierId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    return { supplier, purchases, payments, ledger }
  }

  /** Categories must belong to this store — a cross-store id would leak a name. */
  private async assertCategoriesInStore(storeId: string, categoryIds: string[]): Promise<string[]> {
    const ids = [...new Set(categoryIds.map((id) => id.trim()).filter(Boolean))]
    if (!ids.length) return []
    const found = await this.prisma.category.findMany({
      where: { id: { in: ids }, storeId },
      select: { id: true },
    })
    if (found.length !== ids.length) {
      throw new BadRequestException('One or more categories do not belong to this store')
    }
    return ids
  }

  async createSupplier(
    storeIdOrSlug: string,
    body: {
      name: string
      phone?: string
      altPhone?: string
      whatsapp?: string
      email?: string
      shopName?: string
      address?: string
      note?: string
      marketId?: string
      categoryIds?: string[]
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const name = body.name?.trim()
    if (!name) throw new BadRequestException('Supplier name is required')

    const phone = normalizePhone(body.phone)
    if (phone) {
      // No unique index on phone: existing rows may already hold duplicates, and
      // adding one would have failed the migration. Enforced here instead, where
      // the operator gets a name to go look at.
      const existing = await this.prisma.supplier.findMany({
        where: { storeId },
        select: { id: true, name: true, phone: true },
      })
      const clash = existing.find((s) => normalizePhone(s.phone) === phone)
      if (clash) {
        throw new BadRequestException(
          `Phone ${body.phone} already belongs to supplier "${clash.name}"`,
        )
      }
    }

    if (body.marketId) {
      const market = await this.prisma.supplierMarket.findFirst({
        where: { id: body.marketId, storeId },
      })
      if (!market) throw new BadRequestException('Market not found for this store')
    }

    const categoryIds = await this.assertCategoriesInStore(storeId, body.categoryIds ?? [])
    const codes = await this.prisma.supplier.findMany({ where: { storeId }, select: { code: true } })
    const code = nextSequenceCode(
      'SUP',
      codes.map((row) => row.code),
    )

    return this.prisma.supplier.create({
      data: {
        storeId,
        code,
        name,
        phone: body.phone?.trim() || null,
        altPhone: body.altPhone?.trim() || null,
        whatsapp: body.whatsapp?.trim() || null,
        email: body.email?.trim() || null,
        shopName: body.shopName?.trim() || null,
        address: body.address?.trim() || null,
        note: body.note?.trim() || null,
        marketId: body.marketId?.trim() || null,
        categories: categoryIds.length
          ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
      },
      include: {
        market: { select: { id: true, name: true } },
        categories: { include: { category: { select: { id: true, name: true } } } },
      },
    })
  }

  async updateSupplier(
    storeIdOrSlug: string,
    supplierId: string,
    body: {
      name?: string
      phone?: string
      altPhone?: string
      whatsapp?: string
      email?: string
      shopName?: string
      address?: string
      note?: string
      marketId?: string | null
      categoryIds?: string[]
      isActive?: boolean
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, storeId } })
    if (!supplier) throw new NotFoundException('Supplier not found')

    const phone = normalizePhone(body.phone)
    if (phone && normalizePhone(supplier.phone) !== phone) {
      const others = await this.prisma.supplier.findMany({
        where: { storeId, id: { not: supplier.id } },
        select: { name: true, phone: true },
      })
      const clash = others.find((s) => normalizePhone(s.phone) === phone)
      if (clash) {
        throw new BadRequestException(
          `Phone ${body.phone} already belongs to supplier "${clash.name}"`,
        )
      }
    }

    if (body.marketId) {
      const market = await this.prisma.supplierMarket.findFirst({
        where: { id: body.marketId, storeId },
      })
      if (!market) throw new BadRequestException('Market not found for this store')
    }

    const categoryIds =
      body.categoryIds === undefined
        ? null
        : await this.assertCategoriesInStore(storeId, body.categoryIds)

    return this.prisma.$transaction(async (tx) => {
      if (categoryIds !== null) {
        await tx.supplierCategory.deleteMany({ where: { supplierId: supplier.id } })
        if (categoryIds.length) {
          await tx.supplierCategory.createMany({
            data: categoryIds.map((categoryId) => ({ supplierId: supplier.id, categoryId })),
          })
        }
      }

      return tx.supplier.update({
        where: { id: supplier.id },
        data: {
          name: body.name?.trim() || undefined,
          phone: body.phone?.trim() ?? undefined,
          altPhone: body.altPhone?.trim() ?? undefined,
          whatsapp: body.whatsapp?.trim() ?? undefined,
          email: body.email?.trim() ?? undefined,
          shopName: body.shopName?.trim() ?? undefined,
          address: body.address?.trim() ?? undefined,
          note: body.note?.trim() ?? undefined,
          marketId: body.marketId === undefined ? undefined : body.marketId || null,
          isActive: body.isActive ?? undefined,
        },
        include: {
          market: { select: { id: true, name: true } },
          categories: { include: { category: { select: { id: true, name: true } } } },
        },
      })
    })
  }

  async createPurchaseOrder(
    storeIdOrSlug: string,
    body: {
      supplierId: string
      marketId?: string
      purchasedAt?: string
      notes?: string
      discount?: number
      transportCost?: number
      otherCost?: number
      paidAmount?: number
      paymentMethod?: string
      items: PurchaseItemInput[]
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: body.supplierId, storeId },
    })
    if (!supplier) throw new NotFoundException('Supplier not found for this store')

    const items = normalizePurchaseItems(body.items ?? [])
    if (!items.length) throw new BadRequestException('At least one line item is required')

    // Every catalog link is re-checked against this store. Without it a crafted
    // productId would attach another store's product to this purchase, and the
    // receive step would then move that store's stock.
    const variantIds = items.map((i) => i.variantId).filter((id): id is string => Boolean(id))
    const productIds = items.map((i) => i.productId).filter((id): id is string => Boolean(id))

    // `in: []` matches nothing, so the empty case needs no special branch.
    const [variants, products] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: { id: { in: variantIds }, product: { storeId } },
        select: { id: true, sku: true, productId: true },
      }),
      this.prisma.product.findMany({
        where: { id: { in: productIds }, storeId },
        select: { id: true, name: true },
      }),
    ])

    const variantById = new Map(variants.map((v) => [v.id, v]))
    const productById = new Map(products.map((p) => [p.id, p]))

    for (const id of new Set(variantIds)) {
      if (!variantById.has(id)) throw new BadRequestException('Variant not found for this store')
    }
    for (const id of new Set(productIds)) {
      if (!productById.has(id)) throw new BadRequestException('Product not found for this store')
    }

    const totals = computePurchaseTotals(items, body)
    const marketId = body.marketId?.trim() || supplier.marketId || null
    if (marketId) {
      const market = await this.prisma.supplierMarket.findFirst({
        where: { id: marketId, storeId },
      })
      if (!market) throw new BadRequestException('Market not found for this store')
    }

    const purchasedAt = body.purchasedAt ? new Date(body.purchasedAt) : new Date()
    if (Number.isNaN(purchasedAt.getTime())) {
      throw new BadRequestException('purchasedAt is not a valid date')
    }

    const existingNumbers = await this.prisma.purchaseOrder.findMany({
      where: { storeId },
      select: { poNumber: true },
    })
    const poNumber = nextSequenceCode(
      'PO',
      existingNumbers.map((row) => row.poNumber),
    )

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          storeId,
          supplierId: supplier.id,
          marketId,
          poNumber,
          status: 'DRAFT',
          purchasedAt,
          subtotal: totals.subtotal,
          discount: totals.discount,
          transportCost: totals.transportCost,
          otherCost: totals.otherCost,
          total: totals.total,
          paidAmount: totals.paidAmount,
          dueAmount: totals.dueAmount,
          notes: body.notes?.trim() || null,
          items: {
            create: items.map((item) => {
              const variant = item.variantId ? variantById.get(item.variantId) : undefined
              const product = item.productId ? productById.get(item.productId) : undefined
              return {
                productId: item.productId,
                variantId: item.variantId,
                // Snapshot: a rename or delete later must not rewrite what this
                // purchase said was bought.
                productName: item.productName || product?.name || variant?.sku || 'Item',
                sku: item.sku ?? variant?.sku ?? null,
                quantity: item.quantity,
                unitCost: fromPaisa(item.unitCostPaisa),
                lineTotal: fromPaisa(item.lineTotalPaisa),
              }
            }),
          },
        },
        include: {
          supplier: { select: { id: true, name: true } },
          market: { select: { id: true, name: true } },
          items: true,
        },
      })

      // The liability is real the moment goods are bought, not when they are
      // received, so the supplier balance moves here.
      const balance = applyPurchaseToBalance(
        { dueAmount: Number(supplier.dueAmount), paidAmount: Number(supplier.paidAmount) },
        totals,
      )
      await tx.supplier.update({
        where: { id: supplier.id },
        data: { dueAmount: balance.dueAmount, paidAmount: balance.paidAmount },
      })
      await tx.supplierLedgerEntry.create({
        data: {
          supplierId: supplier.id,
          type: 'PURCHASE',
          amount: totals.total,
          balance: balance.dueAmount,
          note: `${poNumber} · ${items.length} item(s)`,
        },
      })

      if (totals.paidAmount > 0) {
        await tx.supplierPayment.create({
          data: {
            storeId,
            supplierId: supplier.id,
            purchaseOrderId: created.id,
            amount: totals.paidAmount,
            method: body.paymentMethod?.trim() || null,
            note: `Paid at entry · ${poNumber}`,
            paidAt: purchasedAt,
          },
        })
      }

      return created
    })
  }

  async receiveGoodsGrn(
    storeIdOrSlug: string,
    body: { purchaseOrderId?: string; notes?: string; receivedBy?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const purchaseOrderId = body.purchaseOrderId?.trim()
    if (!purchaseOrderId) throw new BadRequestException('purchaseOrderId is required')

    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, storeId },
        include: { items: true },
      })
      if (!po) throw new NotFoundException('Purchase order not found')
      if (po.status === 'CANCELLED') {
        throw new BadRequestException('Cannot receive goods for a cancelled purchase')
      }

      // The idempotency gate. Claiming the flag and the status in one
      // conditional write means a double-tapped or retried receive finds zero
      // rows on the second pass and cannot add stock twice.
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id: po.id, storeId, stockApplied: false },
        data: { stockApplied: true, status: 'RECEIVED', receivedAt: new Date() },
      })
      if (claimed.count === 0) {
        return {
          alreadyReceived: true,
          purchaseOrder: { id: po.id, poNumber: po.poNumber, status: po.status },
          stockedLines: 0,
          skippedLines: po.items.length,
        }
      }

      const grnNumbers = await tx.goodsReceivedNote.findMany({
        where: { purchaseOrder: { storeId } },
        select: { grnNumber: true },
      })
      const grnNumber = nextSequenceCode(
        'GRN',
        grnNumbers.map((row) => row.grnNumber),
      )

      const grn = await tx.goodsReceivedNote.create({
        data: {
          purchaseOrderId: po.id,
          grnNumber,
          receivedBy: body.receivedBy?.trim() || null,
          notes: body.notes?.trim() || null,
        },
      })

      const { stockable, skipped } = splitStockableItems(po.items)
      let stockedLines = 0

      for (const item of stockable) {
        // Prefer the explicit link; fall back to SKU so lines captured before
        // variants were linked still move stock.
        const variant = item.variantId
          ? await tx.productVariant.findFirst({
              where: { id: item.variantId, product: { storeId } },
              select: { id: true, sku: true, stock: true, productId: true },
            })
          : await tx.productVariant.findFirst({
              where: { sku: item.sku ?? undefined, product: { storeId } },
              select: { id: true, sku: true, stock: true, productId: true },
            })
        if (!variant) continue

        const quantityBefore = variant.stock
        const quantityAfter = quantityBefore + item.quantity
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: quantityAfter },
        })
        await tx.stockMovementLog.create({
          data: {
            storeId,
            variantId: variant.id,
            sku: variant.sku,
            reason: 'PURCHASE',
            quantityBefore,
            quantityAfter,
            delta: item.quantity,
            note: `GRN ${grnNumber} · PO ${po.poNumber}`,
          },
        })
        await tx.inventoryLog.create({
          data: {
            productId: variant.productId,
            variantId: variant.id,
            action: 'PURCHASE',
            quantity: item.quantity,
            stockBefore: quantityBefore,
            stockAfter: quantityAfter,
            note: `GRN ${grnNumber} · PO ${po.poNumber}`,
            createdBy: body.receivedBy?.trim() || null,
          },
        })
        stockedLines += 1
      }

      return {
        alreadyReceived: false,
        grn,
        purchaseOrder: { id: po.id, poNumber: po.poNumber, status: 'RECEIVED' as const },
        stockedLines,
        // Surfaced so the operator is told which lines did not move stock rather
        // than assuming inventory rose for the whole purchase.
        skippedLines: skipped.length + (stockable.length - stockedLines),
      }
    })
  }

  async recordSupplierPayment(
    storeIdOrSlug: string,
    body: {
      supplierId: string
      purchaseOrderId?: string
      amount: number
      method?: string
      reference?: string
      note?: string
      paidAt?: string
      createdBy?: string
    },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: body.supplierId, storeId },
    })
    if (!supplier) throw new NotFoundException('Supplier not found')

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero')
    }

    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date()
    if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('paidAt is not a valid date')

    const purchaseOrderId = body.purchaseOrderId?.trim() || null
    if (purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, storeId, supplierId: supplier.id },
      })
      if (!po) throw new NotFoundException('Purchase order not found for this supplier')
    }

    return this.prisma.$transaction(async (tx) => {
      const balance = applyPaymentToBalance(
        { dueAmount: Number(supplier.dueAmount), paidAmount: Number(supplier.paidAmount) },
        amount,
      )

      if (purchaseOrderId) {
        const po = await tx.purchaseOrder.findFirst({ where: { id: purchaseOrderId, storeId } })
        if (po) {
          const poBalance = applyPaymentToBalance(
            { dueAmount: Number(po.dueAmount), paidAmount: Number(po.paidAmount) },
            amount,
          )
          await tx.purchaseOrder.update({
            where: { id: po.id },
            data: { dueAmount: poBalance.dueAmount, paidAmount: poBalance.paidAmount },
          })
        }
      }

      await tx.supplier.update({
        where: { id: supplier.id },
        data: { dueAmount: balance.dueAmount, paidAmount: balance.paidAmount },
      })

      const payment = await tx.supplierPayment.create({
        data: {
          storeId,
          supplierId: supplier.id,
          purchaseOrderId,
          amount,
          method: body.method?.trim() || null,
          reference: body.reference?.trim() || null,
          note: body.note?.trim() || null,
          createdBy: body.createdBy?.trim() || null,
          paidAt,
        },
      })

      await tx.supplierLedgerEntry.create({
        data: {
          supplierId: supplier.id,
          type: 'PAYMENT',
          amount,
          balance: balance.dueAmount,
          note: body.note?.trim() || body.reference?.trim() || null,
        },
      })

      return { payment, balance }
    })
  }

  async procurementSummary(storeIdOrSlug: string) {
    const storeId = await this.sid(storeIdOrSlug)
    const [activeSuppliers, activeMarkets, purchaseAgg, topDue, spendByMarket, marketNames] =
      await Promise.all([
        this.prisma.supplier.count({ where: { storeId, isActive: true } }),
        this.prisma.supplierMarket.count({ where: { storeId, isActive: true } }),
        this.prisma.purchaseOrder.aggregate({
          where: { storeId },
          _sum: { total: true, paidAmount: true, dueAmount: true },
          _count: true,
        }),
        this.prisma.supplier.findMany({
          where: { storeId, dueAmount: { gt: 0 } },
          orderBy: { dueAmount: 'desc' },
          take: 10,
          select: { id: true, name: true, phone: true, dueAmount: true },
        }),
        this.prisma.purchaseOrder.groupBy({
          by: ['marketId'],
          where: { storeId },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.supplierMarket.findMany({ where: { storeId }, select: { id: true, name: true } }),
      ])

    const marketNameById = new Map(marketNames.map((m) => [m.id, m.name]))

    return {
      activeSuppliers,
      activeMarkets,
      purchaseCount: purchaseAgg._count,
      totalPurchased: Number(purchaseAgg._sum.total ?? 0),
      totalPaid: Number(purchaseAgg._sum.paidAmount ?? 0),
      totalDue: Number(purchaseAgg._sum.dueAmount ?? 0),
      topDueSuppliers: topDue.map((s) => ({ ...s, dueAmount: Number(s.dueAmount) })),
      spendByMarket: spendByMarket.map((row) => ({
        marketId: row.marketId,
        marketName: row.marketId ? (marketNameById.get(row.marketId) ?? 'Unknown') : 'Unassigned',
        purchases: row._count,
        total: Number(row._sum.total ?? 0),
      })),
    }
  }

  async createSupportTicket(
    storeIdOrSlug: string,
    body: { subject: string; channel?: SupportTicketChannel; priority?: TaskPriority; message?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    const ticket = await this.prisma.supportTicket.create({
      data: {
        storeId,
        subject: body.subject,
        channel: body.channel ?? 'WHATSAPP',
        priority: body.priority ?? 'MEDIUM',
        status: 'OPEN',
      },
    })
    if (body.message?.trim()) {
      await this.prisma.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          body: body.message.trim(),
          sender: 'admin',
          isStaff: true,
        },
      })
    }
    return ticket
  }
}
