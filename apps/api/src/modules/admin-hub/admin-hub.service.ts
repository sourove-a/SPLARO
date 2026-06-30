import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import type { Prisma, SupportTicketChannel, TaskPriority } from '@prisma/client'

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
  constructor(private readonly prisma: PrismaService) {}

  private sid(storeIdOrSlug: string) {
    return resolveStoreId(this.prisma, storeIdOrSlug)
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
        position: 0,
        change: '—',
        difficulty: Math.min(99, 20 + volume * 3),
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

    const indexPages = [
      ...products.slice(0, 15).map((p) => ({
        url: `/products/${p.slug}`,
        google: p.metaTitle && p.metaDescription ? 'indexed' : 'pending',
        bing: p.metaTitle ? 'indexed' : 'not indexed',
        lastCrawl: p.updatedAt.toISOString(),
        status: p.metaTitle && p.metaDescription ? 'good' : 'warning',
      })),
      ...collections > 0
        ? [{ url: '/collections', google: 'indexed', bing: 'indexed', lastCrawl: new Date().toISOString(), status: 'good' }]
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
        id: c.id,
        from: `/${c.resourceType}/${c.resourceId ?? i}`,
        to: c.canonicalUrl!,
        type: '301',
        hits: 0,
        status: 'good',
      }))

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
        submitted: s.status === 'good' ? 'Google' : 'Pending',
      })),
      redirects,
      productAudits,
      summary: {
        avgScore,
        criticalErrors: productAudits.filter((p) => p.score < 50).length,
        warnings: productAudits.filter((p) => p.score >= 50 && p.score < 80).length,
        products: products.length,
      },
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

    return { affiliates, campaigns, whatsappLogs, whatsappCampaigns, emailCampaigns, emailLogs, smsLogs }
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
        createdAt: l.createdAt.toISOString(),
      })),
      summary: {
        total: logs.length,
        sent,
        failed,
        pending,
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

  async createSupplier(
    storeIdOrSlug: string,
    body: { name: string; phone?: string; email?: string; address?: string },
  ) {
    const storeId = await this.sid(storeIdOrSlug)
    return this.prisma.supplier.create({
      data: {
        storeId,
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address,
      },
    })
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
