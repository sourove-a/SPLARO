import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../common/prisma.service'
import { RedisService } from '../../../common/redis.service'
import { buildApiRouteProbes } from '../../../common/api-routes.manifest'
import { runApiRouteProbes } from '../../../common/route-probe-runner'
import { resolveStoreId } from '../../../common/store.util'
import { IntegrationsService } from '../../integrations/integrations.service'
import { PlatformService } from '../../platform/platform.service'
import { ModelRouter } from '../providers/model-router'
import type { AgentHealthSnapshot } from '../agent.types'

export interface AdminProblem {
  severity: 'critical' | 'warning' | 'info'
  area: string
  message: string
  fix?: string
}

@Injectable()
export class AgentDiagnosticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly integrations: IntegrationsService,
    private readonly platform: PlatformService,
    private readonly router: ModelRouter,
  ) {}

  async getInfrastructureHealth() {
    const checks: { id: string; name: string; status: 'healthy' | 'down'; message?: string }[] = []

    try {
      await this.prisma.$queryRaw`SELECT 1`
      checks.push({ id: 'postgresql', name: 'PostgreSQL', status: 'healthy' })
    } catch (err) {
      checks.push({
        id: 'postgresql',
        name: 'PostgreSQL',
        status: 'down',
        message: err instanceof Error ? err.message : 'Connection failed',
      })
    }

    const redisOk = await this.redis.ping()
    checks.push({
      id: 'redis',
      name: 'Redis',
      status: redisOk ? 'healthy' : 'down',
      message: redisOk ? undefined : 'Redis unavailable',
    })

    return {
      status: checks.some((c) => c.status === 'down') ? 'down' : 'healthy',
      checks,
    }
  }

  async getRouteHealth(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const port = this.config.get<string>('API_PORT') ?? this.config.get<string>('PORT_API') ?? '4000'
    const base = `http://127.0.0.1:${port}/api/v1`
    const probes = buildApiRouteProbes(storeId)
    const internalSecret = this.config.get<string>('INTERNAL_HEALTH_SECRET')
    const headers: Record<string, string> = {}
    if (internalSecret) headers['x-splaro-internal'] = internalSecret

    const results = await runApiRouteProbes({ base, probes, headers })

    const down = results.filter((r) => r.status === 'down')
    const degraded = results.filter((r) => r.status === 'degraded')

    return {
      status: down.length ? 'down' : degraded.length ? 'degraded' : 'healthy',
      summary: {
        total: results.length,
        healthy: results.filter((r) => r.status === 'healthy').length,
        degraded: degraded.length,
        down: down.length,
      },
      failed: [...down, ...degraded],
      checks: results,
    }
  }

  async getIntegrationStatus(storeIdRaw: string) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { settings: true, telegramConfig: true },
    })

    const providers = [
      'telegram',
      'openai',
      'google_sheets',
      'gmail',
      'sslcommerz',
      'bkash',
      'nagad',
      'steadfast',
      'smtp',
      'meta_pixel',
      'google_analytics',
    ]

    const items = await Promise.all(
      providers.map(async (provider) => {
        const meta = await this.integrations.getProviderMeta(storeId, provider)
        let connected = meta.lastTestStatus === 'success'

        if (provider === 'telegram') {
          connected = Boolean(store?.telegramConfig?.botToken && store.telegramConfig.chatId && store.telegramConfig.isActive)
        } else if (provider === 'bkash') {
          connected = store?.settings?.bkashEnabled ?? false
        } else if (provider === 'nagad') {
          connected = store?.settings?.nagadEnabled ?? false
        } else if (provider === 'sslcommerz') {
          connected = store?.settings?.sslcommerzEnabled ?? false
        } else if (provider === 'meta_pixel') {
          const { resolveMetaAccessToken, resolveMetaPixelId } = await import(
            '../../marketing/meta-marketing.util'
          )
          const pixelId = resolveMetaPixelId(store?.settings ?? undefined)
          connected = Boolean(pixelId && resolveMetaAccessToken())
        } else if (provider === 'google_analytics') {
          connected = Boolean(store?.settings?.googleAnalyticsId)
        } else if (provider === 'smtp') {
          connected = store?.settings?.emailEnabled ?? false
        }

        return {
          provider,
          connected,
          status: connected ? 'connected' : meta.lastTestStatus === 'failed' ? 'error' : 'not_connected',
          lastTestedAt: meta.lastTestedAt,
          lastError: meta.lastTestStatus === 'failed' ? meta.lastTestMessage : null,
        }
      }),
    )

    return {
      disconnected: items.filter((i) => !i.connected),
      items,
    }
  }

  async getAdminHealthReport(storeIdRaw: string, storeHealth?: AgentHealthSnapshot) {
    const storeId = await resolveStoreId(this.prisma, storeIdRaw)
    const [infra, routes, integrations, observability, modelStatus, agentConfig, telegramCfg] = await Promise.all([
      this.getInfrastructureHealth(),
      this.getRouteHealth(storeId),
      this.getIntegrationStatus(storeId),
      this.platform.getObservability(storeId),
      this.router.getModelStatus(storeId),
      this.prisma.agentConfig.findUnique({ where: { storeId } }),
      this.prisma.telegramConfig.findUnique({ where: { storeId } }),
    ])

    const problems: AdminProblem[] = []

    for (const check of infra.checks.filter((c) => c.status === 'down')) {
      problems.push({
        severity: 'critical',
        area: 'Infrastructure',
        message: `${check.name} is down`,
        fix: check.id === 'postgresql' ? 'Start PostgreSQL: brew services start postgresql@16' : 'Start Redis: brew services start redis',
      })
    }

    for (const route of routes.failed.slice(0, 15)) {
      problems.push({
        severity: route.status === 'down' ? 'critical' : 'warning',
        area: `API / ${route.group}`,
        message: `${route.name} — ${route.message}`,
        fix: route.message?.includes('401')
          ? 'Admin session expired — log in again at /login'
          : 'Check API Health page (/dashboard/api-health)',
      })
    }

    for (const item of integrations.disconnected) {
      problems.push({
        severity: item.status === 'error' ? 'warning' : 'info',
        area: 'Integrations',
        message: `${item.provider} not connected${item.lastError ? `: ${item.lastError}` : ''}`,
        fix: `Configure in admin integrations panel`,
      })
    }

    if (!modelStatus.activeModelReady) {
      problems.push({
        severity: 'critical',
        area: 'AI Agent',
        message: `Active model "${modelStatus.activeModel}" has no API key or proxy configured`,
        fix: 'Open AI Command Brain → add API key or Antigravity proxy URL',
      })
    }

    if (!telegramCfg?.botToken || !telegramCfg.chatId || !telegramCfg.isActive) {
      problems.push({
        severity: 'warning',
        area: 'Telegram',
        message: 'Telegram bot not fully configured',
        fix: 'Dashboard → Telegram Bot → save token + chat ID',
      })
    }

    const obs = observability as {
      kpis?: { errorsPerHour?: number; queueLag?: number }
      alerts?: unknown[]
    }
    if ((obs.kpis?.errorsPerHour ?? 0) > 0) {
      problems.push({
        severity: 'warning',
        area: 'Platform',
        message: `${obs.kpis?.errorsPerHour} sync/notification errors in last 24h`,
        fix: 'Check System Health → Observability',
      })
    }

    if (storeHealth) {
      if (storeHealth.lowStockCount > 0) {
        problems.push({
          severity: 'warning',
          area: 'Inventory',
          message: `${storeHealth.lowStockCount} products low on stock`,
          fix: 'Review catalog → low stock report',
        })
      }
      if (storeHealth.seoGapCount > 0) {
        problems.push({
          severity: 'info',
          area: 'SEO',
          message: `${storeHealth.seoGapCount} products missing SEO meta`,
          fix: 'Run SEO gaps tool or fix in product editor',
        })
      }
    }

    const critical = problems.filter((p) => p.severity === 'critical').length
    const warning = problems.filter((p) => p.severity === 'warning').length

    return {
      overallStatus: critical > 0 ? 'critical' : warning > 0 ? 'degraded' : 'healthy',
      problemCount: problems.length,
      criticalCount: critical,
      warningCount: warning,
      problems,
      infrastructure: infra,
      apiRoutes: { status: routes.status, summary: routes.summary, failedCount: routes.failed.length },
      integrations: {
        disconnectedCount: integrations.disconnected.length,
        disconnected: integrations.disconnected.map((i) => i.provider),
      },
      aiAgent: {
        activeModel: modelStatus.activeModel,
        ready: modelStatus.activeModelReady,
        models: modelStatus.models,
        systemPromptLength: agentConfig?.systemPrompt?.length ?? 0,
      },
      observability: obs.kpis ?? {},
      generatedAt: new Date().toISOString(),
    }
  }
}
