'use client'

import { RefreshCw, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { useAdminConnection, type ConnectionPulse, type ServiceConnection } from '@/lib/hooks/use-admin-connection'
import { cn } from '@/lib/utils/cn'

export function ApiOfflineHint({ message }: { message?: string }) {
  return (
    <p className="rounded-[14px] border border-amber-200/60 bg-amber-50/70 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
      {message ?? 'API offline — showing cached/empty view. Start: pnpm dev:stack'}
    </p>
  )
}

export function ApiOfflineBanner({ message }: { message?: string }) {
  return (
    <div className="admin-offline-banner">
      <p className="flex items-center gap-2 text-sm font-black text-amber-900">
        <WifiOff className="h-4 w-4 shrink-0" />
        {message ?? 'API offline — run pnpm dev:stack (or pnpm dev:api)'}
      </p>
      <AdminNavLink href="/dashboard/api-health" className="mt-2 inline-flex text-xs font-black text-amber-900 underline">
        Open API Health →
      </AdminNavLink>
    </div>
  )
}

export function KpiGrid({ items }: { items: [string, string | number, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(([label, value, tone]) => (
        <div key={label} className="admin-kpi rounded-[20px]">
          <p className="admin-kpi__label">{label}</p>
          <p className={`admin-kpi__value${tone !== 'default' ? ` admin-kpi__value--${tone}` : ''}`}>{value}</p>
        </div>
      ))}
    </div>
  )
}

const PULSE_LABEL: Record<ConnectionPulse, string> = {
  checking: 'Checking…',
  online: 'Connected',
  degraded: 'Degraded',
  offline: 'Offline',
}

function ConnectionServiceCard({
  label,
  service,
  hint,
}: {
  label: string
  service: ServiceConnection
  hint?: string
}) {
  return (
    <div
      className={cn(
        'connection-service-card',
        service.pulse === 'online' && 'connection-service-card--on',
        service.pulse === 'degraded' && 'connection-service-card--warn',
        service.pulse === 'offline' && 'connection-service-card--off',
        service.pulse === 'checking' && 'connection-service-card--checking',
      )}
    >
      <div className="connection-service-card__head">
        <span className={cn('connection-service-card__dot', `connection-service-card__dot--${service.pulse}`)} />
        <p className="connection-service-card__label">{label}</p>
      </div>
      <p className="connection-service-card__value">{PULSE_LABEL[service.pulse]}</p>
      <p className="connection-service-card__meta">
        {service.latencyMs !== null ? `${service.latencyMs}ms` : '—'}
        {hint ? ` · ${hint}` : ''}
      </p>
      {service.message && service.pulse !== 'online' ? (
        <p className="connection-service-card__hint">{service.message}</p>
      ) : null}
    </div>
  )
}

/** Platform + module connection status for content/catalog/settings panels. */
export function StorefrontLiveBar({
  items,
  onRefresh,
  refreshing = false,
  showPlatform = true,
}: {
  items: { label: string; value: string; ok: boolean; hint?: string }[]
  onRefresh?: () => void
  refreshing?: boolean
  showPlatform?: boolean
}) {
  const conn = useAdminConnection()

  const handleRefresh = () => {
    void conn.refresh()
    onRefresh?.()
  }

  const lastCheckedLabel =
    conn.lastChecked && !conn.checking
      ? conn.lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '…'

  return (
    <div className="connection-status-bar">
      {showPlatform ? (
        <div className="connection-status-bar__platform">
          <div className="connection-status-bar__toolbar">
            <div>
              <p className="connection-status-bar__title">Platform connections</p>
              <p className="connection-status-bar__sub">Last checked {lastCheckedLabel}</p>
            </div>
            <div className="connection-status-bar__actions">
              <button
                type="button"
                className="connection-status-bar__refresh"
                onClick={handleRefresh}
                disabled={conn.checking || refreshing}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', (conn.checking || refreshing) && 'animate-spin')} />
                Refresh
              </button>
              <Link href="/dashboard/api-health" className="connection-status-bar__link">
                API Health
              </Link>
            </div>
          </div>
          <div className="connection-status-bar__services">
            <ConnectionServiceCard label="NestJS API" service={conn.api} hint=":4000" />
            <ConnectionServiceCard label="Storefront" service={conn.storefront} hint=":3000" />
            <ConnectionServiceCard label="Database" service={conn.database} hint="PostgreSQL" />
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="storefront-live-bar">
          {items.map((item) => (
            <div key={item.label} className="storefront-live-bar__item">
              <span className={item.ok ? 'storefront-live-bar__dot storefront-live-bar__dot--on' : 'storefront-live-bar__dot'} />
              <div>
                <p className="storefront-live-bar__label">{item.label}</p>
                <p className="storefront-live-bar__value">{item.value}</p>
                {item.hint ? <p className="storefront-live-bar__hint">{item.hint}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
