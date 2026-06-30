'use client'

import { useEffect, useState } from 'react'
import { Package, Search, ShoppingBag, User, WifiOff } from 'lucide-react'
import { fetchAgentHealth, type AgentHealthSnapshot } from '@/lib/api/agent'
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
        <Icon className="h-4 w-4 text-[#5E7CFF]" strokeWidth={1.75} />
      </div>
      <p className="mt-2 text-xl font-black text-[var(--admin-text)]">{value}</p>
      {sub ? <p className="mt-1 text-[11px] font-semibold text-[var(--admin-text-secondary)]">{sub}</p> : null}
      {action ? (
        <p className="mt-2 text-[10px] font-bold text-[#9a7b52] opacity-0 transition-opacity group-hover:opacity-100">
          {action} →
        </p>
      ) : null}
    </button>
  )
}

export function StoreHealthCards({ onAsk }: StoreHealthCardsProps) {
  const [health, setHealth] = useState<AgentHealthSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    fetchAgentHealth()
      .then((data) => {
        setHealth(data)
        setOffline(false)
      })
      .catch(() => {
        setHealth(null)
        setOffline(true)
      })
      .finally(() => setLoading(false))
  }, [])

  const fmt = (n: number | undefined) => (n !== undefined ? String(n) : loading ? '…' : '—')

  if (offline) {
    return (
      <div className="admin-glass-mini flex items-center gap-3 p-4 text-amber-800 dark:text-amber-300">
        <WifiOff className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">Store health unavailable — API offline. Start <code className="rounded bg-amber-100/60 px-1 dark:bg-amber-900/30">pnpm dev:stack</code>.</p>
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
        value={health?.topCustomer?.name ?? (loading ? '…' : '—')}
        {...(health?.topCustomer ? { sub: `${health.topCustomer.orders} orders` } : {})}
        icon={User}
        action="Details"
        onClick={() => onAsk?.('Who are my top customers by spend?')}
      />
    </div>
  )
}
