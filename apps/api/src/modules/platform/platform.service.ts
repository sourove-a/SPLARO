import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import { resolvePublicSiteUrl } from '@splaro/config'
import { isMediaDeptFolder, resolveMediaFolderFilter } from '../../common/media-folder.util'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { admin2faPosture } from './admin-2fa-posture'
import { httpsEnforcedPosture } from './https-posture'

function relTime(date: Date | null | undefined): string {
  if (!date) return 'Never'
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

type MediaCursor = { at: Date; id: string }

function parseMediaCursor(value?: string): MediaCursor | null {
  if (!value) return null
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { at?: string; id?: string }
    const at = new Date(decoded.at ?? '')
    if (!decoded.id || Number.isNaN(at.getTime())) throw new Error('invalid')
    return { at, id: decoded.id }
  } catch {
    throw new BadRequestException('Invalid media cursor')
  }
}

function encodeMediaCursor(at: Date, id: string): string {
  return Buffer.from(JSON.stringify({ at: at.toISOString(), id })).toString('base64url')
}

function absoluteMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `${resolvePublicSiteUrl()}${url.startsWith('/') ? url : `/${url}`}`
}

const CEO_EMAIL = 'splaro.bd@gmail.com'

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Editor',
}

function roleLabel(role: string, email?: string | null): string {
  if (email?.toLowerCase() === CEO_EMAIL) return 'CEO'
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async getSaaS(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const [store, subscription, staffCount, allStores] = await Promise.all([
      this.prisma.store.findUnique({
        where: { id: storeId },
        include: { settings: true, owner: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.subscription.findUnique({ where: { storeId } }),
      this.prisma.staffRole.count({ where: { storeId } }),
      this.prisma.store.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          subscriptionPlan: true,
          isActive: true,
          _count: { select: { staff: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    if (!store) return null

    const plan = subscription?.plan ?? store.subscriptionPlan
    return {
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        domain: store.domain ?? `${store.slug}.splaro.co`,
        email: store.email,
        isActive: store.isActive,
        currency: store.currency,
        timezone: store.timezone,
        owner: store.owner,
      },
      subscription: {
        plan: roleLabel(plan),
        status: subscription?.status ?? 'ACTIVE',
        periodEnd: subscription?.currentPeriodEnd ?? null,
        mrr: plan === 'ENTERPRISE' ? '৳0' : plan === 'PROFESSIONAL' ? '৳4,999' : '৳0',
      },
      stats: {
        staff: staffCount,
        stores: allStores.length,
      },
      tenants: allStores.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain ?? s.slug,
        plan: roleLabel(s.subscriptionPlan),
        users: s._count.staff,
        status: s.isActive ? 'active' : 'inactive',
      })),
    }
  }

  async getSecurity(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const [staff, auditLogs, successfulLogins, failedLogins, sessions] = await Promise.all([
      this.prisma.staffRole.findMany({
        where: { storeId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              isActive: true,
              lastLoginAt: true,
              twoFAEnabled: true,
              telegramId: true,
              telegramUsername: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.loginHistory.count({
        where: {
          success: true,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          user: { staffRoles: { some: { storeId } } },
        },
      }),
      this.prisma.loginHistory.count({
        where: {
          success: false,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          user: { staffRoles: { some: { storeId } } },
        },
      }),
      this.prisma.deviceSession.count({
        where: {
          isRevoked: false,
          expiresAt: { gt: new Date() },
          user: { staffRoles: { some: { storeId } } },
        },
      }),
    ])

    const twoFaCount = staff.filter(
      (s) => Boolean(s.user.telegramId?.trim()) || s.user.twoFAEnabled,
    ).length

    const roleMap = new Map<string, { name: string; users: number; permissions: string[] }>()
    for (const s of staff) {
      const key = s.role
      const existing = roleMap.get(key) ?? { name: roleLabel(key), users: 0, permissions: s.permissions }
      existing.users += 1
      roleMap.set(key, existing)
    }

    const adminUsers = staff.map((s) => ({
      id: s.user.id,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      email: s.user.email ?? '—',
      role: roleLabel(s.role, s.user.email),
      status: s.user.isActive ? 'active' : 'inactive',
      lastLogin: relTime(s.user.lastLoginAt),
      twoFA: Boolean(s.user.telegramId?.trim()) || s.user.twoFAEnabled,
      telegramLinked: Boolean(s.user.telegramId?.trim()),
      telegramUsername: s.user.telegramUsername ?? null,
    }))

    const roles = [...roleMap.entries()].map(([id, r]) => ({
      id,
      name: r.name,
      users: r.users,
      permissions: r.permissions.length ? r.permissions.join(', ') : 'Default access',
      status: 'active',
    }))

    const logs = auditLogs.map((log) => ({
      id: log.id,
      actor: log.user ? `${log.user.firstName} ${log.user.lastName}`.trim() : 'System',
      action: log.action,
      target: log.module,
      resource: log.resource,
      time: relTime(log.createdAt),
      severity: log.action.toLowerCase().includes('fail') || log.action.toLowerCase().includes('block') ? 'danger' : 'info',
      createdAt: log.createdAt,
    }))

    const threats = auditLogs
      .filter((l) => l.action.toLowerCase().includes('fail') || l.action.toLowerCase().includes('block'))
      .slice(0, 5)
      .map((l) => ({
        id: l.id,
        action: l.action,
        time: relTime(l.createdAt),
      }))

    return {
      kpis: {
        totalAdmins: adminUsers.length,
        activeAdmins: adminUsers.filter((u) => u.status === 'active').length,
        twoFaEnabled: twoFaCount,
        activeSessions: sessions,
        logins24h: successfulLogins,
        failedLogins24h: failedLogins,
        threatLevel: failedLogins > 5 ? 'high' : failedLogins > 0 ? 'medium' : 'low',
      },
      adminUsers,
      roles,
      auditLogs: logs,
      threats,
      posture: [
        httpsEnforcedPosture(resolvePublicSiteUrl(), process.env.NODE_ENV),
        { label: 'Admin session timeout', value: '12 hours', ok: true },
        { label: 'Failed login lockout', value: failedLogins > 0 ? `${failedLogins} in 24h` : 'None recent', ok: failedLogins < 5 },
        admin2faPosture({
          staffTotal: adminUsers.length,
          telegramOrTotpCount: twoFaCount,
          passwordLoginAllowed: process.env.ALLOW_ADMIN_PASSWORD_LOGIN === 'true',
        }),
      ],
    }
  }

  async getMedia(
    storeIdOrSlug: string,
    options: { cursor?: string; limit?: number; q?: string; type?: string; folder?: string } = {},
  ) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const cursor = parseMediaCursor(options.cursor)
    const requestedLimit = options.limit ?? 60
    if (!Number.isFinite(requestedLimit)) throw new BadRequestException('Invalid media limit')
    const limit = Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
    const q = options.q?.trim().slice(0, 120) ?? ''
    const selectedType = options.type?.trim().toLowerCase() ?? 'all'
    const allowedTypes = new Set(['all', 'library', 'product', 'banner', 'category'])
    if (!allowedTypes.has(selectedType)) throw new BadRequestException('Unsupported media type')
    // Folders are store-defined, so this filter normalizes rather than
    // allowlists — an allowlist here would 400 on every folder the store made.
    // Empty means "all"; the queries below keep using that sentinel.
    const folderFilter = resolveMediaFolderFilter(options.folder)
    const selectedFolder = folderFilter || 'all'

    const updatedBoundary = cursor
      ? [{ OR: [{ updatedAt: { lt: cursor.at } }, { updatedAt: cursor.at, id: { lt: cursor.id } }] }]
      : []
    const createdBoundary = cursor
      ? [{ OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }] }]
      : []
    const includeType = (type: string) => selectedType === 'all' || selectedType === type
    const productFolder = selectedFolder === 'all'
      ? undefined
      : selectedFolder === 'media'
        ? '/uploads/products/'
        : `/uploads/products-${selectedFolder}/`
    // Only the department buckets have a product directory on disk. A folder the
    // store invented has none, so product images can never belong to it — skip
    // that query rather than let it fall through to "any product image".
    const folderHasProductImages =
      selectedFolder === 'all' || selectedFolder === 'media' || isMediaDeptFolder(selectedFolder)

    const [mediaAssets, images, banners, categories, libraryCount, productCount, bannerCount, categoryCount, libraryMissingAlt, productMissingAlt, bannerMissingAlt] = await Promise.all([
      includeType('library')
        ? this.prisma.mediaAsset.findMany({
            where: {
              storeId,
              deletedAt: null,
              ...(selectedFolder !== 'all' ? { folder: selectedFolder } : {}),
              AND: [
                ...updatedBoundary,
                ...(q ? [{ OR: [
                  { name: { contains: q, mode: 'insensitive' as const } },
                  { altText: { contains: q, mode: 'insensitive' as const } },
                  { path: { contains: q, mode: 'insensitive' as const } },
                ] }] : []),
              ],
            },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
          })
        : Promise.resolve([]),
      includeType('product') && selectedFolder !== 'media' && folderHasProductImages
        ? this.prisma.productImage.findMany({
            where: {
              product: { storeId },
              ...(productFolder ? { url: { contains: productFolder } } : {}),
              AND: [
                ...createdBoundary,
                ...(q ? [{ OR: [
                  { url: { contains: q, mode: 'insensitive' as const } },
                  { altText: { contains: q, mode: 'insensitive' as const } },
                  { product: { name: { contains: q, mode: 'insensitive' as const } } },
                ] }] : []),
              ],
            },
            include: { product: { select: { name: true, slug: true } } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
          })
        : Promise.resolve([]),
      includeType('banner') && (selectedFolder === 'all' || selectedFolder === 'media')
        ? this.prisma.banner.findMany({
            where: {
              storeId,
              position: { not: 'library' },
              AND: [
                ...updatedBoundary,
                ...(q ? [{ OR: [
                  { title: { contains: q, mode: 'insensitive' as const } },
                  { image: { contains: q, mode: 'insensitive' as const } },
                  { mobileImage: { contains: q, mode: 'insensitive' as const } },
                ] }] : []),
              ],
            },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
          })
        : Promise.resolve([]),
      includeType('category') && (selectedFolder === 'all' || selectedFolder === 'media')
        ? this.prisma.category.findMany({
            where: {
              storeId,
              image: { not: null },
              AND: [
                ...updatedBoundary,
                ...(q ? [{ OR: [
                  { name: { contains: q, mode: 'insensitive' as const } },
                  { image: { contains: q, mode: 'insensitive' as const } },
                ] }] : []),
              ],
            },
            select: { id: true, name: true, image: true, slug: true, updatedAt: true },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
          })
        : Promise.resolve([]),
      this.prisma.mediaAsset.count({ where: { storeId, deletedAt: null } }),
      this.prisma.productImage.count({ where: { product: { storeId } } }),
      this.prisma.banner.count({ where: { storeId, position: { not: 'library' } } }),
      this.prisma.category.count({ where: { storeId, image: { not: null } } }),
      this.prisma.mediaAsset.count({ where: { storeId, deletedAt: null, OR: [{ altText: null }, { altText: '' }] } }),
      this.prisma.productImage.count({ where: { product: { storeId }, OR: [{ altText: null }, { altText: '' }] } }),
      this.prisma.banner.count({ where: { storeId, position: { not: 'library' }, OR: [{ title: null }, { title: '' }] } }),
    ])

    const candidates = [
      ...mediaAssets.map((asset) => ({
        id: asset.id,
        type: 'library' as const,
        name: asset.name,
        url: asset.path,
        publicUrl: absoluteMediaUrl(asset.path),
        altText: asset.altText ?? '',
        source: 'Media library',
        folder: asset.folder,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
        contentHash: asset.contentHash,
        kind: asset.kind,
        focalX: asset.focalX,
        focalY: asset.focalY,
        watermarked: asset.watermarked,
        updated: relTime(asset.updatedAt),
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
        sortAt: asset.updatedAt,
      })),
      ...images.map((img) => ({
        id: img.id,
        type: 'product' as const,
        name: img.product.name,
        url: img.url,
        publicUrl: absoluteMediaUrl(img.url),
        altText: img.altText ?? '',
        source: `Product · ${img.product.slug}`,
        updated: relTime(img.createdAt),
        createdAt: img.createdAt.toISOString(),
        sortAt: img.createdAt,
        productId: img.productId,
        productSlug: img.product.slug,
      })),
      ...banners.map((b) => ({
        id: b.id,
        type: 'banner' as const,
        name: b.title ?? 'Hero banner',
        url: b.image,
        publicUrl: absoluteMediaUrl(b.image),
        altText: b.title ?? '',
        source: b.position === 'library' ? 'Media library' : `Banner · ${b.position}`,
        updated: relTime(b.updatedAt),
        updatedAt: b.updatedAt.toISOString(),
        sortAt: b.updatedAt,
      })),
      ...categories
        .filter((c) => c.image)
        .map((c) => ({
          id: c.id,
          type: 'category' as const,
          name: c.name,
          url: c.image!,
          publicUrl: absoluteMediaUrl(c.image!),
          altText: c.name,
          source: `Category · ${c.slug}`,
          updated: relTime(c.updatedAt),
          updatedAt: c.updatedAt.toISOString(),
          sortAt: c.updatedAt,
        })),
    ]

    candidates.sort((a, b) => {
      const timeDiff = b.sortAt.getTime() - a.sortAt.getTime()
      return timeDiff || b.id.localeCompare(a.id)
    })
    const page = candidates.slice(0, limit)
    const last = page.at(-1)
    const hasMore = candidates.length > limit || mediaAssets.length > limit || images.length > limit || banners.length > limit || categories.length > limit
    const assets = page.map(({ sortAt: _sortAt, ...asset }) => asset)

    return {
      stats: {
        total: libraryCount + productCount + bannerCount + categoryCount,
        library: libraryCount,
        products: productCount,
        banners: bannerCount,
        categories: categoryCount,
        missingAlt: libraryMissingAlt + productMissingAlt + bannerMissingAlt,
      },
      assets,
      pageInfo: {
        hasMore,
        nextCursor: hasMore && last ? encodeMediaCursor(last.sortAt, last.id) : null,
      },
    }
  }

  async getMarketplace(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const vendors = await this.prisma.vendor.findMany({
      where: { storeId },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const totalEarned = vendors.reduce((sum, v) => sum + Number(v.totalEarned), 0)
    const pendingKyc = vendors.filter((v) => !v.isVerified).length

    return {
      kpis: {
        vendors: vendors.length,
        gmv: totalEarned,
        pendingKyc,
        active: vendors.filter((v) => v.isActive).length,
      },
      vendors: vendors.map((v) => ({
        id: v.id,
        name: v.businessName,
        email: v.email,
        status: v.isVerified ? (v.isActive ? 'active' : 'inactive') : 'pending',
        metric: `Commission ${Number(v.commissionRate)}%`,
        updated: relTime(v.updatedAt),
      })),
    }
  }

  async getDeveloper(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const [apiKeys, rules, settings] = await Promise.all([
      this.prisma.apiKey.findMany({
        where: {
          storeId,
          NOT: {
            OR: [{ scopes: { has: 'mcp:read' } }, { scopes: { has: 'mcp:write' } }],
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.automationRule.findMany({
        where: { storeId },
        include: { actions: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.siteSettings.findUnique({
        where: { storeId },
        select: { storefrontConfig: true },
      }),
    ])

    const cfg = settings?.storefrontConfig as { webhookEndpoints?: Array<{ url: string; events?: string[]; isActive?: boolean }> } | null
    const dedicatedWebhooks = (cfg?.webhookEndpoints ?? []).map((w, idx) => ({
      id: `wh-${idx}-${w.url}`,
      name: w.url,
      status: w.isActive !== false ? 'active' : 'inactive',
      trigger: Array.isArray(w.events) && w.events.length > 0 ? w.events.join(', ') : 'All events',
      updated: 'Configured',
    }))

    const automationWebhooks = rules
      .filter((r) => r.actions.some((a) => a.action === 'CUSTOM_WEBHOOK'))
      .map((r) => ({
        id: r.id,
        name: r.name,
        status: r.isActive ? 'active' : 'inactive',
        trigger: r.trigger,
        updated: relTime(r.updatedAt),
      }))

    const allWebhooks = [...dedicatedWebhooks, ...automationWebhooks]

    return {
      kpis: {
        apiKeys: apiKeys.filter((k) => k.isActive).length,
        webhooks: allWebhooks.length,
        automationRules: rules.length,
        sandbox: process.env.NODE_ENV !== 'production',
      },
      apiKeys: apiKeys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        status: k.isActive ? 'active' : 'revoked',
        scopes: k.scopes.join(', ') || 'Full access',
        lastUsed: relTime(k.lastUsed),
      })),
      webhooks: allWebhooks,
    }
  }

  async createApiKey(storeIdOrSlug: string, data: { name: string; scopes?: string[] }) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    if (!data.name?.trim()) throw new BadRequestException('API key name is required')

    const requested = (data.scopes ?? []).filter((s) => typeof s === 'string' && s.trim())
    if (requested.some((s) => s.startsWith('mcp:'))) {
      throw new BadRequestException('MCP link tokens are created from Developer → MCP, not API keys')
    }

    const rawToken = `spl_live_${randomBytes(24).toString('hex')}`
    const keyHash = createHash('sha256').update(rawToken).digest('hex')
    const prefix = `${rawToken.slice(0, 14)}...`

    const created = await this.prisma.apiKey.create({
      data: {
        storeId,
        name: data.name.trim(),
        keyHash,
        prefix,
        scopes: requested.length > 0 ? requested : ['read', 'write'],
        isActive: true,
      },
    })

    return {
      apiKey: {
        id: created.id,
        name: created.name,
        prefix: created.prefix,
        scopes: created.scopes.join(', ') || 'Full access',
        status: 'active' as const,
        lastUsed: 'Never',
      },
      rawKey: rawToken,
    }
  }

  async revokeApiKey(storeIdOrSlug: string, keyId: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const existing = await this.prisma.apiKey.findFirst({
      where: { id: keyId, storeId },
    })
    if (!existing) throw new NotFoundException('API key not found')
    if (existing.scopes.includes('mcp:read') || existing.scopes.includes('mcp:write')) {
      throw new BadRequestException('Revoke MCP link tokens from Developer → MCP')
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    })

    return { ok: true, id: keyId }
  }

  async getObservability(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [healthLogs, cronLogs, syncErrors, notificationFails] = await Promise.all([
      this.prisma.systemHealthLog.findMany({ orderBy: { checkedAt: 'desc' }, take: 20 }),
      this.prisma.cronJobLog.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
      this.prisma.googleSheetSyncLog.count({
        where: { storeId, status: 'FAILED', createdAt: { gte: since } },
      }),
      this.prisma.notificationDeliveryLog.count({
        where: { storeId, status: 'FAILED', createdAt: { gte: since } },
      }),
    ])

    const upCount = healthLogs.filter((h) => h.status === 'UP').length
    const uptime = healthLogs.length ? `${((upCount / healthLogs.length) * 100).toFixed(2)}%` : '—'
    const avgMs =
      healthLogs.filter((h) => h.responseMs).reduce((s, h) => s + (h.responseMs ?? 0), 0) /
        (healthLogs.filter((h) => h.responseMs).length || 1)

    const services = healthLogs.length
      ? [...new Map(healthLogs.map((h) => [h.service, h])).values()].map((h) => ({
          id: h.id,
          name: h.service,
          status: h.status === 'UP' ? 'healthy' : h.status === 'DEGRADED' ? 'degraded' : 'down',
          latency: h.responseMs ? `${h.responseMs}ms` : '—',
          updated: relTime(h.checkedAt),
        }))
      : [
          { id: 'api', name: 'NestJS API', status: 'unknown', latency: '—', updated: 'Check API Health page' },
          { id: 'db', name: 'PostgreSQL', status: 'unknown', latency: '—', updated: 'Check API Health page' },
        ]

    return {
      kpis: {
        uptime,
        apiP95: avgMs ? `${Math.round(avgMs)}ms` : '—',
        errorsPerHour: syncErrors + notificationFails,
        queueLag: cronLogs.filter((c) => !c.completedAt).length,
      },
      services,
      cronJobs: cronLogs.map((c) => ({
        id: c.id,
        name: c.jobName,
        status: !c.completedAt ? 'running' : c.success ? 'completed' : 'failed',
        duration: c.duration ? `${c.duration}ms` : '—',
        updated: relTime(c.startedAt),
      })),
      backups: [
        { id: 'BK-AUTO', name: 'PostgreSQL auto snapshot', status: 'active', metric: 'Every 6h', updated: 'Scheduled' },
        { id: 'BK-MEDIA', name: 'Media backup', status: 'active', metric: 'Nightly 02:00', updated: 'Asia/Dhaka' },
      ],
    }
  }

  async getIntegrations(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { settings: true, telegramConfig: true },
    })
    if (!store) return { integrations: [] }

    const s = store.settings
    const tg = store.telegramConfig
    const [sheetSyncs, automationCount] = await Promise.all([
      this.prisma.googleSheetSyncLog.findFirst({
        where: { storeId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.automationRule.count({ where: { storeId, isActive: true } }),
    ])

    return {
      integrations: [
        {
          id: 'telegram',
          name: 'Telegram Bot',
          status: tg?.isActive ? 'connected' : s?.telegramEnabled ? 'pending' : 'disconnected',
          lastSync: tg ? relTime(tg.updatedAt) : 'Not configured',
        },
        {
          id: 'sheets',
          name: 'Google Sheets',
          status: sheetSyncs ? 'connected' : 'pending',
          lastSync: sheetSyncs ? relTime(sheetSyncs.createdAt) : 'Never synced',
        },
        {
          id: 'bkash',
          name: 'bKash Payments',
          status: s?.bkashEnabled ? 'connected' : 'disconnected',
          lastSync: 'Live',
        },
        {
          id: 'nagad',
          name: 'Nagad Payments',
          status: s?.nagadEnabled ? 'connected' : 'disconnected',
          lastSync: 'Live',
        },
        {
          id: 'sslcommerz',
          name: 'SSLCommerz',
          status: s?.sslcommerzEnabled ? 'connected' : 'disconnected',
          lastSync: 'Live',
        },
        {
          id: 'automation',
          name: 'Automation Rules',
          status: automationCount > 0 ? 'connected' : 'pending',
          lastSync: `${automationCount} active rules`,
        },
        {
          id: 'steadfast',
          name: 'Steadfast Courier',
          status: s?.defaultCourier === 'STEADFAST' ? 'connected' : 'pending',
          lastSync: 'Default courier',
        },
        {
          id: 'pathao',
          name: 'Pathao Courier',
          status: 'pending',
          lastSync: 'Configure in settings',
        },
      ],
    }
  }

  async getSystemLogs(storeIdOrSlug: string, limit = 50) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const [audit, telegram, notifications, cron] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.telegramLog.findMany({
        where: { config: { storeId } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notificationDeliveryLog.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.cronJobLog.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
    ])

    const combined = [
      ...audit.map((l) => ({
        id: l.id,
        level: 'info' as const,
        msg: `${l.action} · ${l.module}/${l.resource}`,
        time: relTime(l.createdAt),
        createdAt: l.createdAt,
      })),
      ...telegram.map((l) => ({
        id: l.id,
        level: (l.success ? 'info' : 'error') as 'info' | 'error' | 'warn',
        msg: `[Telegram] ${l.type}${l.command ? ` ${l.command}` : ''}: ${l.message.slice(0, 120)}`,
        time: relTime(l.createdAt),
        createdAt: l.createdAt,
      })),
      ...notifications.map((l) => ({
        id: l.id,
        level: (l.status === 'FAILED' ? 'error' : l.status === 'PENDING' ? 'warn' : 'info') as 'info' | 'error' | 'warn',
        msg: `[${l.channel}] ${l.subject ?? l.recipient}: ${l.status}`,
        time: relTime(l.createdAt),
        createdAt: l.createdAt,
      })),
      ...cron.map((l) => ({
        id: l.id,
        level: (l.success ? 'info' : 'error') as 'info' | 'error' | 'warn',
        msg: `[Cron] ${l.jobName} · ${l.success ? 'OK' : 'FAILED'}`,
        time: relTime(l.startedAt),
        createdAt: l.startedAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)

    return { logs: combined }
  }

  async getTelegramLogs(storeIdOrSlug: string, limit = 50) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const logs = await this.prisma.telegramLog.findMany({
      where: { config: { storeId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return {
      logs: logs.map((l) => ({
        id: l.id,
        type: l.type,
        command: l.command,
        message: l.message,
        success: l.success,
        createdAt: l.createdAt.toISOString(),
        time: relTime(l.createdAt),
      })),
    }
  }
}
