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

export async function runAllHealthChecks(): Promise<ServiceHealthCheck[]> {
  const token = getAdminApiToken()
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('/api/health', {
    cache: 'no-store',
    signal: AbortSignal.timeout(120_000),
    headers,
  })
  if (!res.ok) {
    throw new Error(`Health check failed: HTTP ${res.status}`)
  }
  const data = (await res.json()) as { checks: ServiceHealthCheck[] }
  return data.checks
}

export function healthSummary(checks: ServiceHealthCheck[]) {
  return {
    total: checks.length,
    healthy: checks.filter((c) => c.status === 'healthy').length,
    degraded: checks.filter((c) => c.status === 'degraded').length,
    down: checks.filter((c) => c.status === 'down').length,
    overall:
      checks.some((c) => c.status === 'down')
        ? ('down' as const)
        : checks.some((c) => c.status === 'degraded')
          ? ('degraded' as const)
          : ('healthy' as const),
  }
}
