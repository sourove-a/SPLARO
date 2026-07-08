'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Zap,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { PlatformConnectionPanel } from '@/components/ui/connection/PlatformConnectionPanel'
import {
  healthSummary,
  runAllHealthChecks,
  type HealthStatus,
  type ServiceHealthCheck,
} from '@/lib/api/health'
import { ADMIN_NAV_GROUP_ORDER } from '@/lib/navigation/admin-nav'
import { cn } from '@/lib/utils/cn'

const STATUS_META: Record<
  HealthStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  healthy: { label: 'Healthy', className: 'admin-status admin-status--delivered', icon: CheckCircle2 },
  degraded: { label: 'Degraded', className: 'admin-status admin-status--pending', icon: AlertTriangle },
  down: { label: 'Down', className: 'admin-status admin-status--pending admin-health-status--down', icon: XCircle },
  checking: { label: 'Checking…', className: 'admin-status admin-status--processing', icon: RefreshCw },
}

const GROUP_ORDER = ['Core', 'Infrastructure', ...ADMIN_NAV_GROUP_ORDER, 'Storefront', 'Web App']

function sectionStatus(items: ServiceHealthCheck[]): HealthStatus {
  if (items.some((i) => i.status === 'down')) return 'down'
  if (items.some((i) => i.status === 'degraded')) return 'degraded'
  if (items.some((i) => i.status === 'checking')) return 'checking'
  return 'healthy'
}

export function ApiHealthPanel() {
  const [checks, setChecks] = useState<ServiceHealthCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRun, setLastRun] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const run = useCallback(async () => {
    setLoading(true)
    setChecks((prev) =>
      prev.length
        ? prev.map((c) => ({ ...c, status: 'checking' as HealthStatus, latencyMs: null }))
        : [],
    )
    try {
      const results = await runAllHealthChecks()
      setChecks(results)
    } catch (err) {
      const isProd = process.env.NODE_ENV === 'production'
      const timedOut = err instanceof Error && err.name === 'TimeoutError'
      setChecks([
        {
          id: 'health-route',
          name: 'Admin Health Proxy',
          group: 'Core',
          endpoint: '/api/health',
          status: 'down',
          latencyMs: null,
          message: timedOut
            ? 'Health check timed out — first load can take ~20s on cold start'
            : 'Could not reach health endpoint',
          fixHint: isProd
            ? 'Wait and refresh — or check splaro-api on VPS (pm2 logs splaro-api)'
            : 'Restart admin: pnpm dev:admin',
        },
      ])
    }
    setLastRun(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    void run()
  }, [run])

  useEffect(() => {
    if (!autoRefresh) return
    const id = window.setInterval(() => void run(), 30_000)
    return () => window.clearInterval(id)
  }, [autoRefresh, run])

  const summary = useMemo(() => healthSummary(checks), [checks])

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceHealthCheck[]>()
    for (const check of checks) {
      const list = map.get(check.group) ?? []
      list.push(check)
      map.set(check.group, list)
    }
    const ordered = GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      items: map.get(g)!,
      status: sectionStatus(map.get(g)!),
    }))
    const extra = [...map.keys()]
      .filter((g) => !GROUP_ORDER.includes(g))
      .sort()
      .map((g) => ({
        group: g,
        items: map.get(g)!,
        status: sectionStatus(map.get(g)!),
      }))
    return [...ordered, ...extra]
  }, [checks])

  const sectionOverview = useMemo(
    () =>
      grouped.filter((g) =>
        (ADMIN_NAV_GROUP_ORDER as readonly string[]).includes(g.group),
      ),
    [grouped],
  )

  const downItems = checks.filter((c) => c.status === 'down')

  return (
    <div className="space-y-5">
      <PlatformConnectionPanel />

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Overall', summary.overall, summary.overall === 'healthy' ? 'success' : summary.overall === 'down' ? 'danger' : 'warning'],
          ['Healthy', summary.healthy, 'success'],
          ['Degraded', summary.degraded, 'warning'],
          ['Down', summary.down, 'danger'],
        ].map(([label, value, tone]) => (
          <div
            key={label as string}
            className={cn(
              'admin-kpi rounded-[20px] border',
              tone === 'success' && 'admin-health-kpi--success',
              tone === 'warning' && 'admin-health-kpi--warning',
              tone === 'danger' && 'admin-health-kpi--danger',
            )}
          >
            <p className="admin-kpi__label">{label as string}</p>
            <p
              className={cn(
                'admin-kpi__value capitalize',
                tone === 'success' && 'admin-kpi__value--success',
                tone === 'warning' && 'admin-kpi__value--warning',
                tone === 'danger' && 'admin-kpi__value--warning',
              )}
            >
              {value as string | number}
            </p>
          </div>
        ))}
      </div>

      {/* Section overview — one chip per sidebar group */}
      {sectionOverview.length > 0 ? (
        <div className="admin-health-sections">
          <p className="admin-health-sections__title">Section status</p>
          <div className="admin-health-sections__grid">
            {sectionOverview.map(({ group, items, status }) => {
              const ok = items.filter((i) => i.status === 'healthy').length
              const meta = STATUS_META[status]
              const Icon = meta.icon
              return (
                <div
                  key={group}
                  className={cn(
                    'admin-health-section-chip',
                    status === 'healthy' && 'admin-health-section-chip--ok',
                    status === 'degraded' && 'admin-health-section-chip--warn',
                    status === 'down' && 'admin-health-section-chip--down',
                    status === 'checking' && 'admin-health-section-chip--checking',
                  )}
                >
                  <Icon className="admin-health-section-chip__icon" />
                  <div className="min-w-0">
                    <p className="admin-health-section-chip__label">{group}</p>
                    <p className="admin-health-section-chip__meta">
                      {ok}/{items.length} OK
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="admin-health-toolbar">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--admin-accent)]" />
          <div>
            <p className="admin-health-toolbar__title">Live API monitoring</p>
            <p className="admin-health-toolbar__sub">
              {mounted && lastRun ? `Last checked ${lastRun.toLocaleTimeString()}` : 'Running checks…'}
              {checks.length > 0 ? ` · ${checks.length} endpoints` : ''}
              {autoRefresh ? ' · auto-refresh 30s' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="admin-health-toolbar__toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--admin-accent)]"
            />
            Auto refresh
          </label>
          <AdminButton onClick={() => void run()} loading={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Run check
          </AdminButton>
        </div>
      </div>

      {/* PostgreSQL setup banner */}
      {checks.some((c) => c.id === 'infra-postgresql' && c.status === 'down') ? (
        <div className="admin-health-banner admin-health-banner--warn">
          <p className="admin-health-banner__title">PostgreSQL is not running</p>
          <p className="admin-health-banner__body">
            Most API services need a database. Install PostgreSQL locally, or use Docker:
          </p>
          <pre className="admin-health-banner__code">
            pnpm infra:up{'\n'}pnpm db:push{'\n'}pnpm db:seed
          </pre>
        </div>
      ) : null}

      {/* Down alert */}
      {downItems.length > 0 ? (
        <div className="admin-health-banner admin-health-banner--danger">
          <p className="admin-health-banner__title admin-health-banner__title--row">
            <XCircle className="h-4 w-4 shrink-0" />
            {downItems.length} service{downItems.length > 1 ? 's' : ''} down
          </p>
          <ul className="admin-health-banner__list">
            {downItems.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                {item.fixHint ? ` — ${item.fixHint}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : !loading && checks.length > 0 ? (
        <div className="admin-health-banner admin-health-banner--ok">
          <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
          All monitored endpoints responding.
        </div>
      ) : null}

      {/* Grouped checks */}
      {grouped.map(({ group, items, status }) => {
        const ok = items.filter((i) => i.status === 'healthy').length
        const meta = STATUS_META[status]
        const GroupIcon = meta.icon
        return (
          <section key={group} className="admin-module-table-wrap overflow-hidden">
            <div className="admin-module-table-head">
              <GroupIcon
                className={cn(
                  'h-4 w-4 shrink-0',
                  status === 'healthy' && 'text-emerald-500',
                  status === 'degraded' && 'text-amber-500',
                  status === 'down' && 'text-red-500',
                  status === 'checking' && 'animate-spin',
                )}
              />
              <p className="font-black text-[var(--admin-text-strong)]">{group}</p>
              <span className="ml-auto text-[10px] font-bold text-[var(--admin-text-muted)]">
                {ok}/{items.length} OK
              </span>
            </div>
            <div className="admin-health-rows">
              {items.map((check) => {
                const rowMeta = STATUS_META[check.status]
                const Icon = rowMeta.icon
                return (
                  <div
                    key={check.id}
                    className={cn(
                      'admin-health-row',
                      check.status === 'down' && 'admin-health-row--down',
                      check.status === 'degraded' && 'admin-health-row--warn',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            check.status === 'healthy' && 'text-emerald-500',
                            check.status === 'degraded' && 'text-amber-500',
                            check.status === 'down' && 'text-red-500',
                            check.status === 'checking' && 'animate-spin text-[var(--admin-text-muted)]',
                          )}
                        />
                        <p className="text-sm font-black text-[var(--admin-text-strong)]">{check.name}</p>
                        <span className={rowMeta.className}>{rowMeta.label}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-[var(--admin-text-muted)]">
                        {check.endpoint}
                      </p>
                      {check.message ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-[var(--admin-text-secondary)]">
                          {check.message}
                        </p>
                      ) : null}
                      {check.fixHint && check.status !== 'healthy' ? (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          <Zap className="h-3 w-3" />
                          {check.fixHint}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-black text-[var(--admin-text-strong)]">
                        {check.latencyMs !== null ? `${check.latencyMs}ms` : '—'}
                      </p>
                      <p className="text-[10px] font-semibold text-[var(--admin-text-muted)]">latency</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <p className="text-center text-[11px] font-semibold text-[var(--admin-text-muted)]">
        Need help?{' '}
        <AdminNavLink href="/dashboard/all-integrations" className="font-black text-[var(--admin-accent)] hover:underline">
          View all integrations
        </AdminNavLink>
      </p>
    </div>
  )
}
