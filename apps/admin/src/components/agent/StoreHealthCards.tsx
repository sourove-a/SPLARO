'use client'

import Link from 'next/link'
import { Package, Search, ShoppingBag, User, WifiOff } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchAgentHealth } from '@/lib/api/agent'
import { isNetworkOrServerError } from '@/lib/api/offline-defaults'
import { markAdminLinkNavigation } from '@/lib/navigation/client-nav'
import { formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'

type HealthTone = 'sky' | 'amber' | 'teal' | 'rose' | 'green'

function HealthCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  action,
  href,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof Package
  tone: HealthTone
  action: string
  href: string
}) {
  return (
    <Link
      href={href}
      scroll={false}
      prefetch
      onClick={() => markAdminLinkNavigation(href)}
      className={cn(
        'admin-glass-mini premium-dash__health-card group block w-full p-4 text-left no-underline',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-text-muted)]">{label}</p>
        <span className={cn('premium-dash__health-icon', `premium-dash__health-icon--${tone}`)} aria-hidden>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-[var(--admin-text)]">{value}</p>
      {sub ? <p className="mt-1 text-[11px] font-medium text-[var(--admin-text-secondary)]">{sub}</p> : null}
      <p className="mt-2 text-[10px] font-semibold text-[var(--admin-foundation-primary,var(--admin-c-712eff))] opacity-80 transition-opacity group-hover:opacity-100">
        {action} →
      </p>
    </Link>
  )
}

const isProd = process.env.NODE_ENV === 'production'

/** Live store signals — each card opens its real module (never the AI chat). */
export function StoreHealthCards() {
  const { data: health, isLoading, error, refetch } = useQuery({
    queryKey: ['agent-health'],
    queryFn: () => fetchAgentHealth(),
    staleTime: 60_000,
    retry: 1,
  })

  const offline = Boolean(error && isNetworkOrServerError(error))
  const fmt = (n: number | undefined) => (n !== undefined ? String(n) : isLoading ? '…' : '—')
  const lowStockWarn = (health?.lowStockCount ?? 0) > 0

  if (offline) {
    return (
      <div className="admin-glass-mini flex flex-col gap-3 p-4 text-amber-800 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <WifiOff className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">
            {isProd
              ? 'Store health unavailable — API unreachable. Check splaro-api on VPS or refresh.'
              : 'Store health unavailable — start pnpm dev:stack.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-xs font-bold underline underline-offset-2"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <HealthCard
        label="Orders today"
        value={fmt(health?.ordersToday)}
        {...(health ? { sub: `Revenue ${formatBDT(health.revenueToday)}` } : {})}
        icon={ShoppingBag}
        tone="sky"
        action="Open orders"
        href="/dashboard/orders"
      />
      <HealthCard
        label="Low stock"
        value={fmt(health?.lowStockCount)}
        sub="products below threshold"
        icon={Package}
        tone={lowStockWarn ? 'amber' : 'green'}
        action="Open inventory"
        href="/dashboard/inventory?stock=low"
      />
      <HealthCard
        label="SEO gaps"
        value={fmt(health?.seoGapCount)}
        sub="missing meta fields"
        icon={Search}
        tone={(health?.seoGapCount ?? 0) > 0 ? 'rose' : 'teal'}
        action="Open SEO health"
        href="/dashboard/seo-health"
      />
      <HealthCard
        label="Top buyer"
        value={health?.topCustomer?.name ?? (isLoading ? '…' : '—')}
        {...(health?.topCustomer ? { sub: `${health.topCustomer.orders} orders` } : {})}
        icon={User}
        tone="teal"
        action="Open customers"
        href="/dashboard/customers"
      />
    </div>
  )
}
