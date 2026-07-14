import { isFeatureEnabled } from '@splaro/config'
import type { ApiRouteProbe } from './api-routes.manifest'

export type RouteProbeResult = {
  id: string
  name: string
  group: string
  endpoint: string
  status: 'healthy' | 'degraded' | 'down'
  latencyMs: number | null
  message?: string
}

export type RouteProbeOptions = {
  base: string
  probes: ApiRouteProbe[]
  headers?: Record<string, string>
  /** Per-request timeout (ms). Default 12s — admin list endpoints can be slow on VPS. */
  timeoutMs?: number
  /** Max in-flight probes — avoids saturating a single API worker + DB pool. Default 8. */
  concurrency?: number
}

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_CONCURRENCY = 8

function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.name === 'TimeoutError' || err.name === 'AbortError' || /aborted due to timeout/i.test(err.message)
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  async function worker() {
    while (true) {
      const index = next++
      if (index >= items.length) return
      results[index] = await fn(items[index], index)
    }
  }

  const workers = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

/** Write probes strip auth so empty-body writes don't mutate live data as staff. */
function headersForProbe(
  headers: Record<string, string>,
  isWrite: boolean,
): Record<string, string> {
  if (!isWrite) return headers
  const out = { ...headers }
  delete out['Authorization']
  delete out['authorization']
  delete out['x-admin-token']
  return out
}

export async function runApiRouteProbes(options: RouteProbeOptions): Promise<RouteProbeResult[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY
  const headers = options.headers ?? {}

  return runWithConcurrency(options.probes, concurrency, async (probe) => {
    const url = `${options.base}${probe.path}`
    const endpoint = url.replace(/\?.*$/, '')

    // Feature-gated modules (loyalty / SaaS / vendor) are OFF by default for
    // single-store launch — counting them as degraded is false alarm noise.
    if (probe.requiresFeature && !isFeatureEnabled(probe.requiresFeature)) {
      return {
        id: probe.id,
        name: probe.name,
        group: probe.group,
        endpoint,
        status: 'healthy',
        latencyMs: 0,
        message: `Feature ${probe.requiresFeature} off (expected)`,
      }
    }

    const t0 = Date.now()
    const method = probe.method ?? 'GET'
    const isWrite = probe.writeProbe === true || method !== 'GET'
    const probeHeaders = headersForProbe(headers, isWrite)
    const init: RequestInit = {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        ...probeHeaders,
        ...(isWrite ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(isWrite ? { body: probe.body ?? '{}' } : {}),
    }
    try {
      const res = await fetch(url, init)
      // 429 = route exists but rate-limited (health spam) — not a real outage
      const writeOk = [200, 201, 204, 400, 401, 403, 404, 422, 429]
      const ok = isWrite
        ? writeOk.includes(res.status)
        : res.ok ||
          (probe.allowNotFound === true && res.status === 404) ||
          (probe.allowUnauthorized === true && res.status === 401) ||
          // Feature gate race: flag on in env but guard still 403
          (probe.requiresFeature !== undefined && res.status === 403)
      return {
        id: probe.id,
        name: probe.name,
        group: probe.group,
        endpoint,
        status: ok ? ('healthy' as const) : res.status >= 500 ? ('down' as const) : ('degraded' as const),
        latencyMs: Date.now() - t0,
        message: isWrite ? `${method} ${res.status}` : `HTTP ${res.status}`,
      }
    } catch (err) {
      const timedOut = isTimeoutError(err)
      return {
        id: probe.id,
        name: probe.name,
        group: probe.group,
        endpoint,
        status: timedOut ? ('degraded' as const) : ('down' as const),
        latencyMs: timedOut ? Date.now() - t0 : null,
        message: err instanceof Error ? err.message : 'Unreachable',
      }
    }
  })
}
