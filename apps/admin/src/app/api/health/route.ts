import { NextRequest, NextResponse } from 'next/server'
import { getApiBaseUrl, SPLARO_DOMAINS } from '@splaro/config'

export const dynamic = 'force-dynamic'

type HealthStatus = 'healthy' | 'degraded' | 'down'

interface ServiceHealthCheck {
  id: string
  name: string
  group: string
  endpoint: string
  status: HealthStatus
  latencyMs: number | null
  message?: string
  fixHint?: string
}

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

/** Avoid hammering the API during dashboard polling. */
let healthCache: { at: number; key: string; payload: unknown } | null = null
const HEALTH_CACHE_MS = 12_000

async function pingApiCore(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    })
    return res.ok
  } catch {
    return false
  }
}

async function pingWebShop(): Promise<ServiceHealthCheck> {
  const url = `${SPLARO_DOMAINS.site}/api/products`
  const start = Date.now()
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    const ok = res.ok
    return {
      id: 'web-store',
      name: 'Web Shop',
      group: 'Web App',
      endpoint: url,
      status: ok ? 'healthy' : 'degraded',
      latencyMs: Date.now() - start,
      message: ok ? `HTTP ${res.status}` : `HTTP ${res.status}`,
      ...(ok ? {} : { fixHint: 'Run: pnpm dev:web (port 3000)' }),
    }
  } catch (err) {
    return {
      id: 'web-store',
      name: 'Web Shop',
      group: 'Web App',
      endpoint: url,
      status: 'down',
      latencyMs: null,
      message: err instanceof Error ? err.message : 'Unreachable',
      fixHint: 'Run: pnpm dev:web (port 3000)',
    }
  }
}

function probeAuthHeaders(authHeader: string | null): Record<string, string> {
  const headers: Record<string, string> = {}
  const internalSecret = process.env['INTERNAL_HEALTH_SECRET']
  if (internalSecret) headers['x-splaro-internal'] = internalSecret
  if (authHeader) headers['Authorization'] = authHeader
  return headers
}

function fixHintForCheck(c: { id: string; group: string; message?: string }): string {
  if (c.message?.includes('401')) {
    return 'Admin session expired — log out and log in again'
  }
  if (c.id === 'health') return 'Run: pnpm dev:api (port 4000)'
  if (c.id === 'admin-invoices') {
    return 'Set INTERNAL_HEALTH_SECRET in apps/admin/.env.local (same as root .env) — then restart admin'
  }
  if (c.group === 'Finance') return 'Check finance module / run pnpm db:seed'
  return 'Verify API route and database seed'
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cacheKey = authHeader ? 'auth' : 'anon'

  if (healthCache && healthCache.key === cacheKey && Date.now() - healthCache.at < HEALTH_CACHE_MS) {
    return NextResponse.json(healthCache.payload)
  }

  const base = getApiBaseUrl()
  const sid = encodeURIComponent(STORE_ID)
  const routeProbeHeaders = probeAuthHeaders(authHeader)

  let apiChecks: ServiceHealthCheck[] = []
  let apiOnline = await pingApiCore(base)

  if (apiOnline) {
    try {
      const routesRes = await fetch(`${base}/health/routes?storeId=${sid}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
        headers: routeProbeHeaders,
      })
      if (routesRes.ok) {
        const data = (await routesRes.json()) as {
          checks: {
            id: string
            name: string
            group: string
            endpoint: string
            status: HealthStatus
            latencyMs: number | null
            message?: string
          }[]
        }
        apiChecks = (data.checks ?? []).map((c) => {
          const row: ServiceHealthCheck = {
            id: c.id,
            name: c.name,
            group: c.group,
            endpoint: c.endpoint,
            status: c.status,
            latencyMs: c.latencyMs,
          }
          if (c.message) row.message = c.message
          if (c.status !== 'healthy') {
            row.fixHint = fixHintForCheck(c)
          }
          return row
        })
      } else {
        apiOnline = false
      }
    } catch {
      apiOnline = false
    }
  }

  if (!apiOnline) {
    apiChecks = [
      {
        id: 'api-core',
        name: 'NestJS API Core',
        group: 'Core',
        endpoint: `${base}/health`,
        status: 'down',
        latencyMs: null,
        message: 'fetch failed',
        fixHint: 'Run: pnpm dev:api (port 4000)',
      },
    ]
  }

  let infraChecks: ServiceHealthCheck[] = []
  if (apiOnline) {
    try {
      const fullRes = await fetch(`${base}/health/full`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (fullRes.ok) {
        const full = (await fullRes.json()) as {
          checks?: { id: string; name: string; group: string; status: HealthStatus; latencyMs: number; message?: string }[]
        }
        infraChecks = (full.checks ?? []).map((c) => {
          const row: ServiceHealthCheck = {
            id: `infra-${c.id}`,
            name: c.name,
            group: 'Infrastructure',
            endpoint: `${base}/health/full`,
            status: c.status,
            latencyMs: c.latencyMs,
          }
          if (c.message) row.message = c.message
          if (c.status !== 'healthy') {
            row.fixHint =
              c.id === 'postgresql'
                ? 'Install PostgreSQL or run: pnpm infra:up. Then: pnpm db:push && pnpm db:seed'
                : c.id === 'redis'
                  ? 'Run: brew services start redis — or: pnpm infra:up (Docker)'
                  : 'Run: pnpm db:push && pnpm db:seed'
          }
          return row
        })
      }
    } catch {
      /* optional infra layer */
    }
  }

  const webCheck = await pingWebShop()
  const checks = [...apiChecks, ...infraChecks, webCheck]

  const summary = {
    total: checks.length,
    healthy: checks.filter((c) => c.status === 'healthy').length,
    degraded: checks.filter((c) => c.status === 'degraded').length,
    down: checks.filter((c) => c.status === 'down').length,
    overall: checks.some((c) => c.status === 'down')
      ? 'down'
      : checks.some((c) => c.status === 'degraded')
        ? 'degraded'
        : 'healthy',
    apiOnline,
    routeCount: apiChecks.length,
  }

  const payload = { timestamp: new Date().toISOString(), summary, checks }
  healthCache = { at: Date.now(), key: cacheKey, payload }
  return NextResponse.json(payload)
}
