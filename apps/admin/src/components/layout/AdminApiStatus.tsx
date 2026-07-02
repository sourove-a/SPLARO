'use client'

import Link from 'next/link'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { cn } from '@/lib/utils/cn'

export function AdminApiStatus() {
  const { api, storefront, database, lastChecked, checking, refresh } = useAdminConnection(25_000)

  const latency = api.latencyMs
  const title = [
    `API ${api.pulse}${latency != null ? ` · ${latency}ms` : ''}`,
    `Storefront ${storefront.pulse}${storefront.latencyMs != null ? ` · ${storefront.latencyMs}ms` : ''}`,
    `Database ${database.pulse}`,
    lastChecked ? `Checked ${lastChecked.toLocaleTimeString()}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  if (checking && api.pulse === 'checking') {
    return (
      <span className={cn('admin-conn-pill', 'admin-conn-pill--checking')} title={title}>
        <span className="admin-conn-pill__dot animate-pulse bg-[var(--admin-text-muted)]" />
        Checking…
      </span>
    )
  }

  if (api.pulse === 'offline') {
    return (
      <Link href="/dashboard/api-health" className={cn('admin-conn-pill', 'admin-conn-pill--off')} title={title}>
        <span className="admin-conn-pill__dot animate-pulse bg-zinc-500" />
        API offline
      </Link>
    )
  }

  const degraded =
    api.pulse === 'degraded' ||
    database.pulse === 'offline' ||
    database.pulse === 'degraded' ||
    (storefront.pulse === 'offline' && database.pulse !== 'online')

  const allGreen = !degraded && api.pulse === 'online' && storefront.pulse === 'online' && database.pulse === 'online'

  return (
    <button
      type="button"
      onClick={() => void refresh()}
      className={cn(
        'admin-conn-pill',
        degraded ? 'admin-conn-pill--warn' : allGreen ? 'admin-conn-pill--ok-gold' : 'admin-conn-pill--ok',
      )}
      title={title}
    >
      <span
        className={cn(
          'admin-conn-pill__dot',
          degraded ? 'bg-zinc-500' : allGreen ? 'bg-[#101114]' : 'bg-emerald-500',
        )}
      />
      {degraded ? 'Degraded' : `API ${latency !== null ? `${latency}ms` : 'live'}`}
      <span
        className={cn(
          'admin-conn-pill__dot',
          storefront.pulse === 'online' ? 'bg-emerald-400' : storefront.pulse === 'degraded' ? 'bg-zinc-400' : 'bg-red-400',
        )}
        title={`Storefront ${storefront.pulse}`}
      />
      <span
        className={cn(
          'admin-conn-pill__dot',
          database.pulse === 'online' ? 'bg-emerald-400' : database.pulse === 'degraded' ? 'bg-zinc-400' : 'bg-red-400',
        )}
        title={`Database ${database.pulse}`}
      />
    </button>
  )
}
