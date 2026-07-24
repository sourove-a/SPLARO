import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerApiBaseUrl, SPLARO_DOMAINS } from '@splaro/config'

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

/** Short cache for core; full route catalog is expensive (~250 probes). */
let healthCache: { at: number; key: string; payload: unknown } | null = null
const HEALTH_CACHE_CORE_MS = 45_000
const HEALTH_CACHE_FULL_MS = 60_000
const HEALTH_FETCH_CORE_MS = 25_000
const HEALTH_FETCH_FULL_MS = 90_000

async function pingApiCore(base: string): Promise<{ ok: boolean; latencyMs: number | null; message: string }> {
  const start = Date.now()
  try {
    const res = await fetch(`${base}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    })
    return {
      ok: res.ok,
      latencyMs: Date.now() - start,
      message: `HTTP ${res.status}`,
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: null,
      message: err instanceof Error ? err.message : 'fetch failed',
    }
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
      message: `HTTP ${res.status}`,
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
  if (c.message?.includes('timeout') || c.message?.includes('aborted')) {
    return 'Route responded slowly under load — refresh health; not necessarily broken'
  }
  if (c.id === 'health' || c.id === 'api-core') return 'Run: pnpm dev:api (port 4000)'
  if (c.id === 'health-routes') {
    return 'Set INTERNAL_HEALTH_SECRET in apps/admin/.env.local (same as root .env), then restart admin'
  }
  if (c.id === 'admin-invoices') {
    return 'Set INTERNAL_HEALTH_SECRET in apps/admin/.env.local (same as root .env) — then restart admin'
  }
  if (c.group === 'Finance') return 'Check finance module / run pnpm db:seed'
  return 'Verify API route and database seed'
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const scope = request.nextUrl.searchParams.get('scope') === 'full' ? 'full' : 'core'
  const cacheKey = `${scope}:${authHeader ? 'auth' : 'anon'}`
  const cacheMs = scope === 'full' ? HEALTH_CACHE_FULL_MS : HEALTH_CACHE_CORE_MS
  const fetchTimeoutMs = scope === 'full' ? HEALTH_FETCH_FULL_MS : HEALTH_FETCH_CORE_MS

  if (healthCache && healthCache.key === cacheKey && Date.now() - healthCache.at < cacheMs) {
    return NextResponse.json(healthCache.payload)
  }

  const base = getServerApiBaseUrl()
  const sid = encodeURIComponent(STORE_ID)
  const routeProbeHeaders = probeAuthHeaders(authHeader)
  const fetchOpts = {
    cache: 'no-store' as const,
    signal: AbortSignal.timeout(fetchTimeoutMs),
    headers: routeProbeHeaders,
  }

  const [corePing, routesRes, fullRes, webCheck] = await Promise.all([
    pingApiCore(base),
    scope === 'full'
      ? fetch(`${base}/health/routes?storeId=${sid}`, fetchOpts).catch(() => null)
      : Promise.resolve(null),
    fetch(`${base}/health/full`, fetchOpts).catch(() => null),
    pingWebShop(),
  ])

  const coreCheck: ServiceHealthCheck = {
    id: 'api-core',
    name: 'NestJS API Core',
    group: 'Core',
    endpoint: `${base}/health`,
    status: corePing.ok ? 'healthy' : 'down',
    latencyMs: corePing.latencyMs,
    message: corePing.message,
    ...(corePing.ok ? {} : { fixHint: 'Run: pnpm dev:api (port 4000)' }),
  }

  let apiChecks: ServiceHealthCheck[] = [coreCheck]
  const apiOnline = corePing.ok

  if (scope === 'full' && apiOnline && routesRes) {
    try {
      const data = (await routesRes.json()) as {
        status?: HealthStatus
        checks?: {
          id: string
          name: string
          group: string
          endpoint: string
          status: HealthStatus
          latencyMs: number | null
          message?: string
        }[]
      }

      if (Array.isArray(data.checks) && data.checks.length > 0) {
        apiChecks = data.checks.map((c) => {
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
        // Ensure core ping truth is never lost if routes catalog omitted it
        if (!apiChecks.some((c) => c.id === 'health' || c.id === 'api-core')) {
          apiChecks = [coreCheck, ...apiChecks]
        }
      } else if (!routesRes.ok) {
        apiChecks = [
          coreCheck,
          {
            id: 'health-routes',
            name: 'API route catalog',
            group: 'Core',
            endpoint: `${base}/health/routes`,
            status: 'degraded',
            latencyMs: null,
            message: `HTTP ${routesRes.status} — catalog unavailable`,
            fixHint: fixHintForCheck({ id: 'health-routes', group: 'Core', message: String(routesRes.status) }),
          },
        ]
      }
    } catch {
      apiChecks = [
        coreCheck,
        {
          id: 'health-routes',
          name: 'API route catalog',
          group: 'Core',
          endpoint: `${base}/health/routes`,
          status: 'degraded',
          latencyMs: null,
          message: 'Could not parse route catalog',
          fixHint: fixHintForCheck({ id: 'health-routes', group: 'Core' }),
        },
      ]
    }
  } else if (!apiOnline) {
    apiChecks = [coreCheck]
  } else if (scope === 'core') {
    apiChecks = [
      coreCheck,
      {
        id: 'health-routes-skipped',
        name: 'Full route catalog',
        group: 'Core',
        endpoint: `${base}/health/routes`,
        status: 'healthy',
        latencyMs: null,
        message: 'Skipped on core check — use Full scan for ~250 route probes',
      },
    ]
  }

  let infraChecks: ServiceHealthCheck[] = []
  if (apiOnline && fullRes?.ok) {
    try {
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
    } catch {
      /* optional infra layer */
    }
  }

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
    scope,
  }

  const payload = { timestamp: new Date().toISOString(), summary, checks }
  healthCache = { at: Date.now(), key: cacheKey, payload }
  return NextResponse.json(payload)
}
