'use client'

import { RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useAdminConnection, type ConnectionPulse, type ServiceConnection } from '@/lib/hooks/use-admin-connection'
import { cn } from '@/lib/utils/cn'

const PULSE_LABEL: Record<ConnectionPulse, string> = {
  checking: 'Checking…',
  online: 'Connected',
  degraded: 'Degraded',
  offline: 'Offline',
}

function ServiceCard({
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
        'admin-conn-card',
        service.pulse === 'online' && 'admin-conn-card--on',
        service.pulse === 'degraded' && 'admin-conn-card--warn',
        service.pulse === 'offline' && 'admin-conn-card--off',
        service.pulse === 'checking' && 'admin-conn-card--checking',
      )}
    >
      <div className="admin-conn-card__head">
        <span className={cn('admin-conn-card__dot', `admin-conn-card__dot--${service.pulse}`)} />
        <p className="admin-conn-card__label">{label}</p>
      </div>
      <p className="admin-conn-card__value">{PULSE_LABEL[service.pulse]}</p>
      <p className="admin-conn-card__meta">
        {service.latencyMs !== null ? `${service.latencyMs}ms` : '—'}
        {hint ? ` · ${hint}` : ''}
      </p>
      {service.message && service.pulse !== 'online' ? (
        <p className="admin-conn-card__hint">{service.message}</p>
      ) : null}
    </div>
  )
}

/** Full platform connection panel — API Health and dedicated diagnostics only. */
export function PlatformConnectionPanel({
  onRefresh,
  refreshing = false,
}: {
  onRefresh?: () => void
  refreshing?: boolean
} = {}) {
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
    <div className="admin-conn-platform">
      <div className="admin-conn-platform__toolbar">
        <div>
          <p className="admin-conn-platform__title">Platform connections</p>
          <p className="admin-conn-platform__sub">Last checked {lastCheckedLabel}</p>
        </div>
        <div className="admin-conn-platform__actions">
          <button
            type="button"
            className="admin-conn-strip__refresh"
            onClick={handleRefresh}
            disabled={conn.checking || refreshing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (conn.checking || refreshing) && 'animate-spin')} />
            Refresh
          </button>
          <Link href="/dashboard/api-health" className="admin-conn-platform__link">
            API Health
          </Link>
        </div>
      </div>
      <div className="admin-conn-platform__services">
        <ServiceCard label="NestJS API" service={conn.api} hint=":4000" />
        <ServiceCard label="Storefront" service={conn.storefront} hint=":3000" />
        <ServiceCard label="Database" service={conn.database} hint="PostgreSQL" />
      </div>
    </div>
  )
}
