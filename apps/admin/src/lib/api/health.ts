export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'checking'

export interface ServiceHealthCheck {
  id: string
  name: string
  group: string
  endpoint: string
  status: HealthStatus
  latencyMs: number | null
  message?: string
  fixHint?: string
}

import { getAdminApiToken } from '@/lib/auth/api-token'

export type HealthScope = 'core' | 'full'

export async function runAllHealthChecks(scope: HealthScope = 'core'): Promise<ServiceHealthCheck[]> {
  const token = getAdminApiToken()
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const timeoutMs = scope === 'full' ? 90_000 : 20_000
  const res = await fetch(`/api/health?scope=${scope}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers,
  })
  if (!res.ok) {
    throw new Error(`Health check failed: HTTP ${res.status}`)
  }
  const data = (await res.json()) as { checks: ServiceHealthCheck[] }
  return data.checks
}

export function healthSummary(checks: ServiceHealthCheck[]) {
  const checking = checks.filter((c) => c.status === 'checking').length
  const healthy = checks.filter((c) => c.status === 'healthy').length
  const degraded = checks.filter((c) => c.status === 'degraded').length
  const down = checks.filter((c) => c.status === 'down').length

  let overall: HealthStatus = 'healthy'
  if (checks.length === 0 || checking > 0) {
    overall = 'checking'
  } else if (down > 0) {
    overall = 'down'
  } else if (degraded > 0) {
    overall = 'degraded'
  }

  return {
    total: checks.length,
    healthy,
    degraded,
    down,
    checking,
    overall,
  }
}
