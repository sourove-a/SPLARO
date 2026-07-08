import { Controller, Get, Inject, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from './common/auth/public.decorator'
import { PrismaService } from './common/prisma.service'
import { RedisService } from './common/redis.service'
import { buildApiRouteProbes } from './common/api-routes.manifest'
import { runApiRouteProbes } from './common/route-probe-runner'

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
  async health() {
    const started = Date.now()
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        service: 'splaro-api',
        latencyMs: Date.now() - started,
      }
    } catch (err) {
      return {
        status: 'down',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
        service: 'splaro-api',
        latencyMs: Date.now() - started,
        message: err instanceof Error ? err.message : 'Database connection failed',
      }
    }
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
  @Public()
  async routeHealth(@Query('storeId') storeId = 'splaro', @Req() req?: Request) {
    const port =
      process.env['API_PORT'] ?? process.env['PORT_API'] ?? process.env['PORT'] ?? '4000'
    const base = `http://127.0.0.1:${port}/api/v1`
    const probes = buildApiRouteProbes(storeId)
    const started = Date.now()
    const authHeader =
      typeof req?.headers?.authorization === 'string' ? req.headers.authorization : null
    const probeHeaders = this.buildRouteProbeHeaders(authHeader)

    const results = await runApiRouteProbes({
      base,
      probes,
      headers: probeHeaders,
    })

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
    const redisStart = Date.now()
    const storeStart = Date.now()
    const productStart = Date.now()
    const orderStart = Date.now()

    const [dbResult, redisOk, store, productCount, orderCount] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true as const).catch((err: unknown) => err),
      this.redis.ping(),
      this.prisma.store
        .findFirst({ select: { id: true, slug: true } })
        .catch(() => null),
      this.prisma.product.count().catch(() => null),
      this.prisma.order.count().catch(() => null),
    ])

    if (dbResult === true) {
      add('postgresql', 'PostgreSQL Database', 'Infrastructure', true, Date.now() - dbStart)
    } else {
      add(
        'postgresql',
        'PostgreSQL Database',
        'Infrastructure',
        false,
        Date.now() - dbStart,
        dbResult instanceof Error ? dbResult.message : 'Connection failed',
      )
    }

    add(
      'redis',
      'Redis Cache',
      'Infrastructure',
      redisOk,
      Date.now() - redisStart,
      redisOk ? 'Connected' : 'Unavailable — run: brew services start redis',
    )

    add(
      'store',
      'Store Config',
      'Commerce',
      !!store,
      Date.now() - storeStart,
      store ? `Store: ${store.slug}` : 'No store found — run db:seed',
    )

    if (productCount !== null) {
      add('products-db', 'Products Table', 'Catalog', true, Date.now() - productStart, `${productCount} products`)
    } else {
      add('products-db', 'Products Table', 'Catalog', false, Date.now() - productStart)
    }

    if (orderCount !== null) {
      add('orders-db', 'Orders Table', 'Commerce', true, Date.now() - orderStart, `${orderCount} orders`)
    } else {
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
