import { NextResponse } from 'next/server'
import { getServerApiBaseUrl, SPLARO_DOMAINS } from '@splaro/config'

export const dynamic = 'force-dynamic'

const isProd = process.env.NODE_ENV === 'production'

function offlineHint(service: 'api' | 'storefront'): string {
  if (isProd) {
    return service === 'api' ? 'API unreachable — check VPS splaro-api' : 'Storefront unreachable'
  }
  return service === 'api' ? 'Start pnpm dev:api' : 'Start pnpm dev:web'
}

function internalProbeHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_HEALTH_SECRET
  return secret ? { 'x-splaro-internal': secret } : {}
}

async function probe(url: string, timeoutMs: number, headers?: Record<string, string>) {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
      headers: headers ?? {},
    })
    return { ok: res.ok, latencyMs: Date.now() - start, status: res.status }
  } catch (err) {
    return {
      ok: false,
      latencyMs: null as number | null,
      status: 0,
      message: err instanceof Error ? err.message : 'Unreachable',
    }
  }
}

/** Same-origin ping for admin connection UI — API, storefront, database. */
export async function GET() {
  const base = getServerApiBaseUrl()
  const checkedAt = new Date().toISOString()

  const apiProbe = await probe(`${base}/health`, 5000)
  let databaseOnline = false
  let databaseLatency: number | null = null
  let databaseMessage: string | undefined

  if (apiProbe.ok) {
    const probeHeaders = internalProbeHeaders()
    try {
      const fullRes = await fetch(`${base}/health/full`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
        headers: probeHeaders,
      })
      if (fullRes.ok) {
        const full = (await fullRes.json()) as {
          checks?: { id: string; status: string; latencyMs?: number; message?: string }[]
        }
        const pg = full.checks?.find((c) => c.id === 'postgresql')
        databaseOnline = pg?.status === 'healthy'
        databaseLatency = typeof pg?.latencyMs === 'number' ? pg.latencyMs : null
        if (!databaseOnline && pg?.message) databaseMessage = pg.message
      } else {
        databaseMessage = 'Health full endpoint unavailable'
      }
    } catch {
      databaseOnline = false
      databaseMessage = 'Could not read database health'
    }
  } else {
    databaseMessage = 'API offline'
  }

  const storefrontUrl = `${SPLARO_DOMAINS.site.replace(/\/+$/, '')}/api/products`
  const storefrontProbe = await probe(storefrontUrl, 6000)

  const services = {
    api: {
      online: apiProbe.ok,
      latencyMs: apiProbe.latencyMs,
      message: apiProbe.ok ? `HTTP ${apiProbe.status}` : apiProbe.message ?? offlineHint('api'),
      url: `${base}/health`,
    },
    storefront: {
      online: storefrontProbe.ok,
      latencyMs: storefrontProbe.latencyMs,
      message: storefrontProbe.ok
        ? `HTTP ${storefrontProbe.status}`
        : storefrontProbe.message ?? offlineHint('storefront'),
      url: SPLARO_DOMAINS.site,
    },
    database: {
      online: databaseOnline,
      latencyMs: databaseLatency,
      message: databaseMessage ?? (databaseOnline ? 'PostgreSQL OK' : isProd ? 'Database check failed' : 'Check pnpm db:push'),
    },
  }

  const online = apiProbe.ok

  return NextResponse.json({
    online,
    latencyMs: apiProbe.latencyMs,
    checkedAt,
    services,
  })
}
