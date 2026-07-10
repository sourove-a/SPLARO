'use client'

import { Package, Search, ShoppingBag, User, WifiOff } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchAgentHealth } from '@/lib/api/agent'
import { isNetworkOrServerError } from '@/lib/api/offline-defaults'
import { formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'

interface StoreHealthCardsProps {
  onAsk?: (question: string) => void
}

function HealthCard({
  label,
  value,
  sub,
  icon: Icon,
  action,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof Package
  action?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'admin-glass-mini group w-full p-4 text-left transition-transform duration-200 hover:-translate-y-0.5',
        onClick && 'cursor-pointer',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--admin-text-muted)]">{label}</p>
        <Icon className="h-4 w-4 text-[var(--admin-accent)]" strokeWidth={1.75} />
      </div>
      <p className="mt-2 text-xl font-black text-[var(--admin-text)]">{value}</p>
      {sub ? <p className="mt-1 text-[11px] font-semibold text-[var(--admin-text-secondary)]">{sub}</p> : null}
      {action ? (
        <p className="mt-2 text-[10px] font-bold text-[var(--admin-text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
          {action} →
        </p>
      ) : null}
    </button>
  )
}

const isProd = process.env.NODE_ENV === 'production'

export function StoreHealthCards({ onAsk }: StoreHealthCardsProps) {
  const { data: health, isLoading, error, refetch } = useQuery({
    queryKey: ['agent-health'],
    queryFn: () => fetchAgentHealth(),
    staleTime: 60_000,
    retry: 1,
  })

  const offline = Boolean(error && isNetworkOrServerError(error))
  const fmt = (n: number | undefined) => (n !== undefined ? String(n) : isLoading ? '…' : '—')

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
        action="Ask AI"
        onClick={() => onAsk?.("Show me today's orders and revenue breakdown")}
      />
      <HealthCard
        label="Low stock"
        value={fmt(health?.lowStockCount)}
        sub="products below threshold"
        icon={Package}
        action="View all"
        onClick={() => onAsk?.('List all low stock products')}
      />
      <HealthCard
        label="SEO gaps"
        value={fmt(health?.seoGapCount)}
        sub="missing meta fields"
        icon={Search}
        action="Fix now"
        onClick={() => onAsk?.('Show me all products missing SEO meta title or description')}
      />
      <HealthCard
        label="Top buyer"
        value={health?.topCustomer?.name ?? (isLoading ? '…' : '—')}
        {...(health?.topCustomer ? { sub: `${health.topCustomer.orders} orders` } : {})}
        icon={User}
        action="Details"
        onClick={() => onAsk?.('Who are my top customers by spend?')}
      />
    </div>
  )
}
