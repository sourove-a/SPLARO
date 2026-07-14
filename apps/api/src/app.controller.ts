import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from './common/auth/public.decorator'
import { PrismaService } from './common/prisma.service'
import { RedisService } from './common/redis.service'
import { buildApiRouteProbes } from './common/api-routes.manifest'
import { runApiRouteProbes } from './common/route-probe-runner'
import { parseFeatureFlags } from '@splaro/config'

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  @SkipThrottle()
  @Public()
  @Get()
  @ApiOperation({ summary: 'API index' })
  index() {
    return {
      service: 'splaro-api',
      version: 'v1',
      status: 'ok',
      docs: {
        swagger: '/api/v1/docs',
        health: '/api/v1/health',
        healthFull: '/api/v1/health/full',
        healthRoutes: '/api/v1/health/routes',
        storefrontSettings: '/api/v1/storefront/settings?storeId=splaro',
      },
    }
  }

  @SkipThrottle()
  @Public()
  @Get('features')
  @ApiOperation({ summary: 'Runtime feature flags (admin + storefront gates)' })
  features() {
    return parseFeatureFlags()
  }

  @SkipThrottle()
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe (database ping)' })
  async health(@Res({ passthrough: true }) res: Response) {
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
      res.status(503)
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
  @ApiOperation({ summary: 'Route-level health probes (admin or internal secret)' })
  async routeHealth(
    @Query('storeId') storeId = 'splaro',
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
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
    const status = down > 0 ? 'down' : degraded > 0 ? 'degraded' : 'healthy'

    // Only hard-fail the HTTP status when probes are fully down.
    // Degraded (e.g. feature-flagged modules) must stay 200 so admin Health
    // does not falsely report "NestJS API Core — fetch failed".
    if (status === 'down') res?.status(503)

    return {
      status,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
      summary: { total: results.length, healthy, degraded, down },
      checks: results,
    }
  }

  @SkipThrottle()
  @Public()
  @Get('health/full')
  @ApiOperation({ summary: 'Full infrastructure health check' })
  async fullHealth(@Res({ passthrough: true }) res: Response) {
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
    const status = down > 0 ? 'down' : degraded > 0 ? 'degraded' : 'healthy'

    if (status === 'down') res.status(503)
    else if (status === 'degraded') res.status(503)

    return {
      status,
      service: 'splaro-api',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
      summary: { total: checks.length, healthy: checks.filter((c) => c.status === 'healthy').length, degraded, down },
      checks,
    }
  }
}
