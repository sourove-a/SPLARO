'use client'

import { WifiOff } from 'lucide-react'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { ModuleLiveStrip, type ModuleLiveItem } from '@/components/ui/connection/ModuleLiveStrip'
import { PlatformConnectionPanel } from '@/components/ui/connection/PlatformConnectionPanel'
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

export function ApiOfflineBanner({ message }: { message?: string }) {
  return (
    <div className="admin-offline-banner">
      <p className="flex items-center gap-2 text-sm font-black text-[var(--admin-text)]">
        <WifiOff className="h-4 w-4 shrink-0" />
        {message ?? 'API offline — run pnpm dev:stack (or pnpm dev:api)'}
      </p>
      <AdminNavLink href="/dashboard/api-health" className="mt-2 inline-flex text-xs font-black text-[var(--admin-text)] underline opacity-80">
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
