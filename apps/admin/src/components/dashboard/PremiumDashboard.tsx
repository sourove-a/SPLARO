'use client'

import { useEffect, useState, type ElementType } from 'react'
import toast from 'react-hot-toast'
import {
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  SlidersHorizontal,
  WifiOff,
  Sparkles,
  Percent,
  BarChart3,
} from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { SalesChart } from '@/components/analytics/SalesChart'
import { ChannelDonutChart } from '@/components/dashboard/ChannelDonutChart'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { AlertsPanel } from '@/components/dashboard/AlertsPanel'
import { RecentOrdersTable } from '@/components/dashboard/RecentOrdersTable'
import { TopCategories } from '@/components/dashboard/TopCategories'
import { TopProducts } from '@/components/dashboard/TopProducts'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { StoreHealthCards } from '@/components/agent/StoreHealthCards'
import { ClientDateTime } from '@/components/ui/ClientDateTime'
import { formatBDT } from '@/lib/utils/currency'
import { useDashboardStats, useExecutiveDashboard } from '@/lib/api/hooks'
import { useAdminUiStore } from '@/store/uiStore'

const DATE_RANGES = ['Today', '7 Days', '30 Days', 'Quarter'] as const
type DateRange = (typeof DATE_RANGES)[number]

function StorePerformanceCard({
  label,
  value,
  change,
  icon: Icon,
}: {
  label: string
  value: string
  change?: number
  icon: ElementType
}) {
  return (
    <div className="admin-glass-mini p-4 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--admin-text-muted)]">{label}</p>
        <Icon className="h-4 w-4 text-[#5E7CFF]" strokeWidth={1.75} />
      </div>
      <p className="mt-2 text-xl font-black text-[var(--admin-text)]">{value}</p>
      {change !== undefined ? (
        <p className={`mt-1 text-[11px] font-bold ${change >= 0 ? 'text-[var(--admin-success)]' : 'text-[var(--admin-danger)]'}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
        </p>
      ) : null}
    </div>
  )
}

export function PremiumDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('30 Days')
  const [userName, setUserName] = useState('there')
  const openAgentChat = useAdminUiStore((s) => s.openAgentChat)
  const { data: stats, isLoading, isError } = useDashboardStats(dateRange)
  const { data: executive } = useExecutiveDashboard()

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.name) {
          const first = String(data.user.name).split(' ')[0]
          setUserName(first ?? 'there')
        }
      })
      .catch(() => undefined)
  }, [])

  const revenue = stats?.revenue.value
  const orders = stats?.orders.value
  const customers = stats?.customers.value
  const aov = stats?.avgOrderValue.value
  const netProfit = executive?.kpis?.netProfit
  const fmt = (n: number | undefined) =>
    n !== undefined ? formatBDT(n) : isError ? '—' : isLoading ? '…' : '—'
  const fmtNum = (n: number | undefined) =>
    n !== undefined ? new Intl.NumberFormat('en-US').format(n) : isError ? '—' : isLoading ? '…' : '—'

  return (
    <div className="admin-dashboard-canvas min-h-full w-full space-y-6 pb-20">
      <div className="space-y-6">
        <div>
          <div className="admin-hero">
            <div className="admin-hero__inner flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-[#5E7CFF]" strokeWidth={2} />
                  <p className="admin-page-eyebrow">Commerce OS</p>
                </div>
                <h1 className="admin-page-title mt-1.5">
                  Welcome back, <span className="admin-page-title__accent">{userName}</span>
                </h1>
                <p className="mt-1.5 text-sm font-medium text-[var(--admin-text-secondary)]">
                  <ClientDateTime suffix=" — your luxury storefront at a glance" />
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isError ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50/90 px-3 py-1.5 text-[11px] font-semibold text-amber-800 shadow-sm">
                    <WifiOff className="h-3 w-3" /> API offline — run <code className="rounded bg-amber-100/80 px-1">pnpm dev:stack</code>
                  </span>
                ) : null}

                <div className="admin-segment">
                  {DATE_RANGES.map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setDateRange(range)}
                      className={`admin-segment__btn ${dateRange === range ? 'admin-segment__btn--active' : ''}`}
                    >
                      {range}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => toast('Advanced filters coming soon.', { icon: '🎛️' })}
                  className="admin-filter-btn"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
                  Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        <StoreHealthCards onAsk={(q) => openAgentChat(q)} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="Total Revenue" value={fmt(revenue)} change={stats?.revenue.change} icon={DollarSign} color="gold" loading={isLoading} sparkline />
          <StatCard title="Total Orders" value={fmtNum(orders)} change={stats?.orders.change} icon={ShoppingBag} loading={isLoading} sparkline />
          <StatCard title="Total Customers" value={fmtNum(customers)} change={stats?.customers.change} icon={Users} loading={isLoading} sparkline />
          <StatCard title="Net Profit" value={fmt(netProfit)} change={stats?.revenue.change} icon={TrendingUp} color="green" loading={isLoading} sparkline />
          <StatCard title="Avg Order Value" value={fmt(aov)} change={stats?.avgOrderValue.change} icon={BarChart3} loading={isLoading} sparkline />
          <StatCard title="Conversion" value="3.2%" change={12} icon={Percent} color="gold" loading={isLoading} sparkline />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SalesChart period={dateRange} title="Sales Overview" />
          </div>
          <ChannelDonutChart period={dateRange} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StorePerformanceCard label="Visitors" value="24.8K" change={8.4} icon={Users} />
          <StorePerformanceCard label="Conversion Rate" value="3.2%" change={12} icon={Percent} />
          <StorePerformanceCard label="Avg Order Value" value={fmt(aov)} icon={ShoppingBag} {...(stats?.avgOrderValue.change !== undefined ? { change: stats.avgOrderValue.change } : {})} />
          <StorePerformanceCard label="Return Rate" value="1.8%" change={-4} icon={TrendingUp} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <RecentActivities period={dateRange} />
          <AlertsPanel
            {...(stats?.alerts.codRiskOrders !== undefined ? { codRisk: stats.alerts.codRiskOrders } : {})}
            {...(stats?.alerts.failedPayments !== undefined ? { failedPayments: stats.alerts.failedPayments } : {})}
          />
        </div>

        <div>
          <RecentOrdersTable />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <TopCategories period={dateRange} />
          <TopProducts period={dateRange} />
        </div>

        <div className="lg:hidden">
          <QuickActions />
        </div>
      </div>
    </div>
  )
}
