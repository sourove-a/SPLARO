import { Controller, Get, Inject, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from './common/auth/public.decorator'
import { PrismaService } from './common/prisma.service'
import { RedisService } from './common/redis.service'
import { buildApiRouteProbes } from './common/api-routes.manifest'

@Controller()
export class AppController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  @SkipThrottle()
  @Public()
  @Get()
  index() {
    return {
      service: 'splaro-api',
      version: 'v1',
      status: 'ok',
      docs: {
        health: '/api/v1/health',
        healthFull: '/api/v1/health/full',
        healthRoutes: '/api/v1/health/routes',
        storefrontSettings: '/api/v1/storefront/settings?storeId=splaro',
      },
    }
  }

  @SkipThrottle()
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString(), service: 'splaro-api' }
  }

  private buildRouteProbeHeaders(authHeader?: string | null): Record<string, string> {
    const headers: Record<string, string> = {}
    const internalSecret = process.env['INTERNAL_HEALTH_SECRET']
    if (internalSecret) headers['x-splaro-internal'] = internalSecret
    if (authHeader) headers['Authorization'] = authHeader
    return headers
  }

  @Get('health/routes')
  @SkipThrottle()
  async routeHealth(@Query('storeId') storeId = 'splaro', @Req() req?: Request) {
    const port =
      process.env['API_PORT'] ?? process.env['PORT_API'] ?? process.env['PORT'] ?? '4000'
    const base = `http://127.0.0.1:${port}/api/v1`
    const probes = buildApiRouteProbes(storeId)
    const started = Date.now()
    const authHeader =
      typeof req?.headers?.authorization === 'string' ? req.headers.authorization : null
    const probeHeaders = this.buildRouteProbeHeaders(authHeader)

    const results = await Promise.all(
      probes.map(async (probe) => {
        const url = `${base}${probe.path}`
        const t0 = Date.now()
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: probeHeaders })
          const ok = res.ok || (probe.allowNotFound && res.status === 404)
          return {
            id: probe.id,
            name: probe.name,
            group: probe.group,
            endpoint: url.replace(/\?.*$/, ''),
            status: ok ? ('healthy' as const) : res.status >= 500 ? ('down' as const) : ('degraded' as const),
            latencyMs: Date.now() - t0,
            message: `HTTP ${res.status}`,
          }
        } catch (err) {
          return {
            id: probe.id,
            name: probe.name,
            group: probe.group,
            endpoint: url.replace(/\?.*$/, ''),
            status: 'down' as const,
            latencyMs: null,
            message: err instanceof Error ? err.message : 'Unreachable',
          }
        }
      }),
    )

    const healthy = results.filter((r) => r.status === 'healthy').length
    const down = results.filter((r) => r.status === 'down').length
    const degraded = results.filter((r) => r.status === 'degraded').length

    return {
      status: down > 0 ? 'down' : degraded > 0 ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
      summary: { total: results.length, healthy, degraded, down },
      checks: results,
    }
  }

  @SkipThrottle()
  @Public()
  @Get('health/full')
  async fullHealth() {
    const started = Date.now()
    const checks: {
      id: string
      name: string
      group: string
      status: 'healthy' | 'degraded' | 'down'
      latencyMs: number
      message?: string
    }[] = []

    const add = (
      id: string,
      name: string,
      group: string,
      ok: boolean,
      latencyMs: number,
      message?: string,
    ) => {
      checks.push({
        id,
        name,
        group,
        status: ok ? 'healthy' : 'down',
        latencyMs,
        ...(message ? { message } : {}),
      })
    }

    const dbStart = Date.now()
    try {
      await this.prisma.$queryRaw`SELECT 1`
      add('postgresql', 'PostgreSQL Database', 'Infrastructure', true, Date.now() - dbStart)
    } catch (err) {
      add(
        'postgresql',
        'PostgreSQL Database',
        'Infrastructure',
        false,
        Date.now() - dbStart,
        err instanceof Error ? err.message : 'Connection failed',
      )
    }

    const redisStart = Date.now()
    const redisOk = await this.redis.ping()
    add(
      'redis',
      'Redis Cache',
      'Infrastructure',
      redisOk,
      Date.now() - redisStart,
      redisOk ? 'Connected' : 'Unavailable — run: brew services start redis',
    )

    const storeStart = Date.now()
    try {
      const store = await this.prisma.store.findFirst({ select: { id: true, slug: true } })
      add(
        'store',
        'Store Config',
        'Commerce',
        !!store,
        Date.now() - storeStart,
        store ? `Store: ${store.slug}` : 'No store found — run db:seed',
      )
    } catch (err) {
      add('store', 'Store Config', 'Commerce', false, Date.now() - storeStart, 'Query failed')
    }

    const productStart = Date.now()
    try {
      const count = await this.prisma.product.count()
      add('products-db', 'Products Table', 'Catalog', true, Date.now() - productStart, `${count} products`)
    } catch {
      add('products-db', 'Products Table', 'Catalog', false, Date.now() - productStart)
    }

    const orderStart = Date.now()
    try {
      const count = await this.prisma.order.count()
      add('orders-db', 'Orders Table', 'Commerce', true, Date.now() - orderStart, `${count} orders`)
    } catch {
      add('orders-db', 'Orders Table', 'Commerce', false, Date.now() - orderStart)
    }

    const down = checks.filter((c) => c.status === 'down').length
    const degraded = checks.filter((c) => c.status === 'degraded').length

    return {
      status: down > 0 ? 'down' : degraded > 0 ? 'degraded' : 'healthy',
      service: 'splaro-api',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
      summary: { total: checks.length, healthy: checks.filter((c) => c.status === 'healthy').length, degraded, down },
      checks,
    }
  }
}
