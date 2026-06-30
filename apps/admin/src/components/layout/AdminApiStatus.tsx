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

  if (api.pulse === 'online' && storefront.pulse !== 'offline' && database.pulse !== 'offline') {
    const degraded = storefront.pulse === 'degraded' || database.pulse === 'degraded'
    return (
      <button
        type="button"
        onClick={() => void refresh()}
        className={cn(
          'hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition xl:inline-flex',
          degraded
            ? 'border-amber-200/70 bg-amber-50/80 text-amber-900 hover:bg-amber-100/90 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300'
            : 'border-emerald-200/70 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100/90 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
        )}
        title={title}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            degraded ? 'bg-amber-500' : 'bg-emerald-500 dark:bg-emerald-400',
          )}
        />
        {degraded ? 'Degraded' : `API ${latency !== null ? `${latency}ms` : 'live'}`}
        <span
          className={cn(
            'ml-0.5 h-1.5 w-1.5 rounded-full',
            storefront.pulse === 'online'
              ? 'bg-emerald-400'
              : storefront.pulse === 'degraded'
                ? 'bg-amber-400'
                : 'bg-gray-400',
          )}
          title={`Storefront ${storefront.pulse}`}
        />
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            database.pulse === 'online' ? 'bg-emerald-400' : database.pulse === 'degraded' ? 'bg-amber-400' : 'bg-gray-400',
          )}
          title={`Database ${database.pulse}`}
        />
      </button>
    )
  }

  if (api.pulse === 'offline') {
    return (
      <Link
        href="/dashboard/api-health"
        className="hidden items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-[10px] font-bold text-amber-900 transition hover:bg-amber-100/90 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15 xl:inline-flex"
        title={title}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        API offline
      </Link>
    )
  }

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-black/5 bg-white/50 px-2.5 py-1 text-[10px] font-semibold text-[#6B6B6B] dark:border-white/10 dark:bg-white/5 dark:text-white/55 xl:inline-flex"
      title={title}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full bg-[var(--admin-text-muted)]', checking && 'animate-pulse')} />
      Checking…
    </span>
  )
}
