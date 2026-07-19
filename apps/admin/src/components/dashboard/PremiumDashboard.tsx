'use client'

import { useState } from 'react'
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
import { useAdminSession, useDashboardStats, useExecutiveDashboard } from '@/lib/api/hooks'
import { useAdminUiStore } from '@/store/uiStore'

const DATE_RANGES = ['Today', '7 Days', '30 Days', 'Quarter'] as const
type DateRange = (typeof DATE_RANGES)[number]

function DashboardSectionHeader({ id, title, meta }: { id: string; title: string; meta: string }) {
  return (
    <div className="premium-dash__section-head">
      <div className="premium-dash__section-title-wrap">
        <span className="premium-dash__section-mark" aria-hidden />
        <h2 id={id} className="premium-dash__section-title">{title}</h2>
      </div>
      <p className="premium-dash__section-meta">{meta}</p>
    </div>
  )
}

export function PremiumDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('30 Days')
  const openAgentChat = useAdminUiStore((s) => s.openAgentChat)
  const { data: stats, isLoading, isError } = useDashboardStats(dateRange)
  const { data: executive } = useExecutiveDashboard()
  const { data: sessionUser } = useAdminSession()
  const userName = sessionUser?.name?.split(' ')[0] || 'there'

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

      <section className="premium-dash__zone" aria-labelledby="dash-live-pulse">
        <DashboardSectionHeader id="dash-live-pulse" title="Live pulse" meta="Store signals · now" />
        <div>
          <StoreHealthCards onAsk={(q) => openAgentChat(q)} />
        </div>
      </section>

      <section className="premium-dash__zone" aria-labelledby="dash-performance">
        <DashboardSectionHeader id="dash-performance" title="Performance ledger" meta={`${dateRange} · verified commerce data`} />
        <div className="premium-dash__kpi-grid" aria-label="Key metrics">
          <StatCard title="Total Revenue" value={fmt(revenue)} change={stats?.revenue.change} icon={DollarSign} color="gold" loading={isLoading} sparkline />
          <StatCard title="Total Orders" value={fmtNum(orders)} change={stats?.orders.change} icon={ShoppingBag} loading={isLoading} sparkline />
          <StatCard title="Total Customers" value={fmtNum(customers)} change={stats?.customers.change} icon={Users} loading={isLoading} sparkline />
          <StatCard title="Net Profit" value={fmt(netProfit)} change={stats?.revenue.change} icon={TrendingUp} color="green" loading={isLoading} sparkline />
          <StatCard title="Avg Order Value" value={fmt(aov)} change={stats?.avgOrderValue.change} icon={BarChart3} loading={isLoading} sparkline />
          <StatCard title="Conversion" value="—" emptyHint="Visitor analytics not connected yet" icon={Percent} color="gold" loading={isLoading} />
        </div>
      </section>

      <section className="premium-dash__zone" aria-labelledby="dash-revenue-intelligence">
        <DashboardSectionHeader id="dash-revenue-intelligence" title="Revenue intelligence" meta="Trend and payment mix" />
        <div className="premium-dash__charts grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SalesChart period={dateRange} title="Sales Overview" />
          </div>
          <ChannelDonutChart period={dateRange} />
        </div>
      </section>

      <section className="premium-dash__zone" aria-labelledby="dash-operations-desk">
        <DashboardSectionHeader id="dash-operations-desk" title="Operations desk" meta="Activity, alerts and recent orders" />
        <div className="premium-dash__operations">
          <div className="grid gap-5 lg:grid-cols-2">
            <RecentActivities period={dateRange} />
            <AlertsPanel
              {...(stats?.alerts.codRiskOrders !== undefined ? { codRisk: stats.alerts.codRiskOrders } : {})}
              {...(stats?.alerts.failedPayments !== undefined ? { failedPayments: stats.alerts.failedPayments } : {})}
            />
          </div>

          <RecentOrdersTable />

          <div className="grid gap-5 lg:grid-cols-2">
            <TopCategories period={dateRange} />
            <TopProducts period={dateRange} />
          </div>
        </div>
      </section>

      <div className="lg:hidden">
        <QuickActions />
      </div>
    </div>
  )
}
