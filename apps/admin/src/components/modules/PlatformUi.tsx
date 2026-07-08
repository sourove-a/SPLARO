'use client'

import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { ModuleLiveStrip, type ModuleLiveItem } from '@/components/ui/connection/ModuleLiveStrip'
import { PlatformConnectionPanel } from '@/components/ui/connection/PlatformConnectionPanel'
import { AdminErrorState } from '@/components/ui/AdminUiPrimitives'
import { cn } from '@/lib/utils/cn'

export { ModuleLiveStrip, PlatformConnectionPanel }
export type { ModuleLiveItem }

export function ApiOfflineHint({ message }: { message?: string }) {
  return (
    <p className="admin-offline-hint">
      {message ?? 'API offline — showing cached/empty view. Start: pnpm dev:stack'}
    </p>
  )
}

export function ApiOfflineBanner({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="mb-3 space-y-2">
      <AdminErrorState
        title="API offline"
        message={message ?? 'Run pnpm dev:stack (or pnpm dev:api) and refresh.'}
        {...(onRetry ? { onRetry } : {})}
      />
      <AdminNavLink
        href="/dashboard/api-health"
        className="inline-flex text-xs font-bold text-[var(--admin-text-secondary)] underline-offset-2 hover:underline"
      >
        Open API Health →
      </AdminNavLink>
    </div>
  )
}

export function KpiGrid({ items }: { items: [string, string | number, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(([label, value, tone]) => (
        <div key={label} className="admin-kpi">
          <p className="admin-kpi__label">{label}</p>
          <p className={cn('admin-kpi__value', tone !== 'default' && `admin-kpi__value--${tone}`)}>{value}</p>
        </div>
      ))}
    </div>
  )
}

/**
 * @deprecated Use ModuleLiveStrip (module pages) or PlatformConnectionPanel (API Health).
 * Kept for gradual migration — defaults to module strip only (no platform block).
 */
export function StorefrontLiveBar({
  items,
  onRefresh,
  refreshing = false,
  showPlatform = false,
}: {
  items: ModuleLiveItem[]
  onRefresh?: () => void
  refreshing?: boolean
  showPlatform?: boolean
}) {
  return (
    <div className="space-y-3">
      {showPlatform ? (
        <PlatformConnectionPanel {...(onRefresh ? { onRefresh } : {})} refreshing={refreshing} />
      ) : null}
      <ModuleLiveStrip
        items={items}
        {...(onRefresh ? { onRefresh } : {})}
        refreshing={refreshing}
      />
    </div>
  )
}
