import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

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
    const [staff, auditLogs, failedLogins, sessions, twoFaCount] = await Promise.all([
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
      this.prisma.user.count({ where: { twoFAEnabled: true, staffRoles: { some: { storeId } } } }),
    ])

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
      twoFA: s.user.twoFAEnabled,
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
        failedLogins24h: failedLogins,
        threatLevel: failedLogins > 5 ? 'high' : failedLogins > 0 ? 'medium' : 'low',
      },
      adminUsers,
      roles,
      auditLogs: logs,
      threats,
      posture: [
        { label: 'HTTPS enforced', value: process.env.NODE_ENV === 'production' ? 'Active' : 'Dev mode', ok: process.env.NODE_ENV === 'production' },
        { label: 'Admin session timeout', value: '12 hours', ok: true },
        { label: 'Failed login lockout', value: failedLogins > 0 ? `${failedLogins} in 24h` : 'None recent', ok: failedLogins < 5 },
        { label: '2FA coverage', value: `${adminUsers.length ? Math.round((twoFaCount / adminUsers.length) * 100) : 0}%`, ok: twoFaCount > 0 },
      ],
    }
  }

  async getMedia(storeIdOrSlug: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdOrSlug)
    const [images, banners, categories] = await Promise.all([
      this.prisma.productImage.findMany({
        where: { product: { storeId } },
        include: { product: { select: { name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.banner.findMany({
        where: { storeId },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.category.findMany({
        where: { storeId, image: { not: null } },
        select: { id: true, name: true, image: true, slug: true },
      }),
    ])

    const assets = [
      ...images.map((img) => ({
        id: img.id,
        type: 'product' as const,
        name: img.product.name,
        url: img.url,
        altText: img.altText ?? '',
        source: `Product · ${img.product.slug}`,
        updated: relTime(img.createdAt),
        productId: img.productId,
        productSlug: img.product.slug,
      })),
      ...banners.map((b) => ({
        id: b.id,
        type: 'banner' as const,
        name: b.title ?? 'Hero banner',
        url: b.image,
        altText: b.title ?? '',
        source: b.position === 'library' ? 'Media library' : `Banner · ${b.position}`,
        updated: relTime(b.updatedAt),
      })),
      ...categories
        .filter((c) => c.image)
        .map((c) => ({
          id: c.id,
          type: 'category' as const,
          name: c.name,
          url: c.image!,
          altText: c.name,
          source: `Category · ${c.slug}`,
          updated: '—',
        })),
    ]

    return {
      stats: {
        total: assets.length,
        products: images.length,
        banners: banners.length,
        categories: categories.filter((c) => c.image).length,
      },
      assets,
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
    const [apiKeys, rules] = await Promise.all([
      this.prisma.apiKey.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.automationRule.findMany({
        where: { storeId },
        include: { actions: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    const webhooks = rules.filter((r) => r.actions.some((a) => a.action === 'CUSTOM_WEBHOOK'))

    return {
      kpis: {
        apiKeys: apiKeys.filter((k) => k.isActive).length,
        webhooks: webhooks.length,
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
      webhooks: rules.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.isActive ? 'active' : 'inactive',
        trigger: r.trigger,
        updated: relTime(r.updatedAt),
      })),
    }
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
