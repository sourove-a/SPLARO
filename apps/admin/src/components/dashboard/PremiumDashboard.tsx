'use client'

import { useEffect, useState } from 'react'
import {
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  WifiOff,
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
    <div className="admin-dashboard-canvas premium-dash min-h-full w-full space-y-5 pb-20">
      <header className="premium-dash__hero">
        <div className="premium-dash__hero-inner">
          <div className="premium-dash__hero-copy">
            <p className="admin-page-eyebrow">Commerce OS</p>
            <h1 className="admin-page-title mt-1">
              Welcome back, <span className="admin-page-title__accent">{userName}</span>
            </h1>
            <p className="premium-dash__sub">
              <ClientDateTime suffix=" — your luxury storefront at a glance" />
            </p>
          </div>

          <div className="premium-dash__hero-actions">
            {isError ? (
              <span className="premium-dash__offline">
                <WifiOff className="h-3 w-3" />
                API offline
              </span>
            ) : null}

            <div className="admin-segment" role="group" aria-label="Date range">
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
          </div>
        </div>
      </header>

      <StoreHealthCards onAsk={(q) => openAgentChat(q)} />

      <section className="premium-dash__kpi-grid" aria-label="Key metrics">
        <StatCard title="Total Revenue" value={fmt(revenue)} change={stats?.revenue.change} icon={DollarSign} color="gold" loading={isLoading} sparkline />
        <StatCard title="Total Orders" value={fmtNum(orders)} change={stats?.orders.change} icon={ShoppingBag} loading={isLoading} sparkline />
        <StatCard title="Total Customers" value={fmtNum(customers)} change={stats?.customers.change} icon={Users} loading={isLoading} sparkline />
        <StatCard title="Net Profit" value={fmt(netProfit)} change={stats?.revenue.change} icon={TrendingUp} color="green" loading={isLoading} sparkline />
        <StatCard title="Avg Order Value" value={fmt(aov)} change={stats?.avgOrderValue.change} icon={BarChart3} loading={isLoading} sparkline />
        <StatCard title="Conversion" value="—" emptyHint="Visitor analytics not connected yet" icon={Percent} color="gold" loading={isLoading} />
      </section>

      <section className="premium-dash__charts grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChart period={dateRange} title="Sales Overview" />
        </div>
        <ChannelDonutChart period={dateRange} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <RecentActivities period={dateRange} />
        <AlertsPanel
          {...(stats?.alerts.codRiskOrders !== undefined ? { codRisk: stats.alerts.codRiskOrders } : {})}
          {...(stats?.alerts.failedPayments !== undefined ? { failedPayments: stats.alerts.failedPayments } : {})}
        />
      </section>

      <RecentOrdersTable />

      <section className="grid gap-5 lg:grid-cols-2">
        <TopCategories period={dateRange} />
        <TopProducts period={dateRange} />
      </section>

      <div className="lg:hidden">
        <QuickActions />
      </div>
    </div>
  )
}
