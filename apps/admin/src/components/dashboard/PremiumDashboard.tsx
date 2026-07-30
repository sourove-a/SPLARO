'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  BarChart3,
  DollarSign,
  LayoutDashboard,
  Percent,
  Radio,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
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
import { HandoffPageChrome } from '@/components/ui/HandoffPageChrome'
import { DecisionCard } from '@/components/ui/AdminHandoffBlocks'
import { formatBDT } from '@/lib/utils/currency'
import { useAdminSession, useDashboardStats, useExecutiveDashboard } from '@/lib/api/hooks'
import { cn } from '@/lib/utils/cn'

const DATE_RANGES = ['Today', '7 Days', '30 Days', 'Quarter'] as const
type DateRange = (typeof DATE_RANGES)[number]

function DashboardSectionHeader({
  id,
  title,
  meta,
  icon: Icon,
}: {
  id: string
  title: string
  meta: string
  icon: typeof Activity
}) {
  return (
    <div className="premium-dash__section-head">
      <div className="premium-dash__section-title-wrap">
        <span className="premium-dash__section-icon" aria-hidden>
          <Icon strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="premium-dash__section-title">
            {title}
          </h2>
          <p className="premium-dash__section-meta premium-dash__section-meta--under">{meta}</p>
        </div>
      </div>
    </div>
  )
}

export function PremiumDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('30 Days')
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
    <div className="admin-dashboard-canvas premium-dash admin-panel-page ho-stack min-h-full w-full pb-20">
      <HandoffPageChrome
        group="Overview"
        title="Dashboard"
        sync={isError ? 'API offline' : `${dateRange} · storefront overview`}
        live={!isError}
        offline={isError}
        actions={
          <div className="admin-segment premium-dash__segment" role="group" aria-label="Date range">
            {DATE_RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDateRange(range)}
                className={cn(
                  'admin-segment__btn',
                  dateRange === range && 'admin-segment__btn--active',
                )}
              >
                {range}
              </button>
            ))}
          </div>
        }
      >
        <p className="m-0 text-sm font-semibold text-[var(--admin-text-secondary)]">
          Welcome back, {userName}. <ClientDateTime suffix=" — what needs you next." />
        </p>
      </HandoffPageChrome>

      <div className="ho-grid">
        <div className="ho-stack">
          <div className="ho-hero-metric">
            <p className="ho-hero-metric__label">Revenue · {dateRange.toLowerCase()}</p>
            <p className="ho-hero-metric__value">{fmt(revenue)}</p>
            {stats?.revenue.change !== undefined ? (
              <span className="ho-hero-metric__delta">
                {stats.revenue.change > 0 ? '+' : ''}
                {stats.revenue.change}%
              </span>
            ) : null}
            <p className="ho-hero-metric__sub">
              {isError
                ? 'API offline — numbers unavailable.'
                : `${fmtNum(orders)} orders · AOV ${fmt(aov)}`}
            </p>
          </div>

          <section className="premium-dash__zone" aria-labelledby="dash-live-pulse">
            <DashboardSectionHeader
              id="dash-live-pulse"
              title="Live pulse"
              meta="Store signals · now"
              icon={Radio}
            />
            <div className="premium-dash__zone-body">
              <StoreHealthCards />
            </div>
          </section>
        </div>

        <div className="ho-stack">
          <DecisionCard
            tone={isError ? 'bad' : 'info'}
            title="What to do next"
            decision={
              isError
                ? 'API is offline — start pnpm dev:api before trusting KPIs'
                : `${fmtNum(orders)} orders in range — open Orders or Packing Station`
            }
            why="Never show a bare number without a decision. Revenue above is live only when the API responds."
            stats={[
              { label: 'Orders', value: fmtNum(orders) },
              { label: 'Customers', value: fmtNum(customers) },
              { label: 'Net profit', value: fmt(netProfit) },
            ]}
            actions={
              <>
                <Link href="/dashboard/orders" scroll={false} className="admin-btn admin-btn--accent px-3 py-2 text-xs font-semibold">
                  Open orders
                </Link>
                <Link href="/dashboard/packing-station" scroll={false} className="admin-btn admin-btn--ghost px-3 py-2 text-xs font-semibold">
                  Packing
                </Link>
              </>
            }
          />
        </div>
      </div>

      <section className="premium-dash__zone" aria-labelledby="dash-performance">
        <DashboardSectionHeader
          id="dash-performance"
          title="Performance ledger"
          meta={`${dateRange} · verified commerce data`}
          icon={LayoutDashboard}
        />
        <div className="premium-dash__zone-body">
          <div className="premium-dash__kpi-grid" aria-label="Key metrics">
            <div className="premium-dash__kpi premium-dash__kpi--amber">
              <StatCard
                title="Total Revenue"
                value={fmt(revenue)}
                change={stats?.revenue.change}
                icon={DollarSign}
                color="amber"
                loading={isLoading}
                href="/dashboard/finance/finance-reports"
              />
            </div>
            <div className="premium-dash__kpi premium-dash__kpi--sky">
              <StatCard
                title="Total Orders"
                value={fmtNum(orders)}
                change={stats?.orders.change}
                icon={ShoppingBag}
                color="sky"
                loading={isLoading}
                href="/dashboard/orders"
              />
            </div>
            <div className="premium-dash__kpi premium-dash__kpi--teal">
              <StatCard
                title="Total Customers"
                value={fmtNum(customers)}
                change={stats?.customers.change}
                icon={Users}
                color="teal"
                loading={isLoading}
                href="/dashboard/customers"
              />
            </div>
            <div className="premium-dash__kpi premium-dash__kpi--green">
              <StatCard
                title="Net Profit"
                value={fmt(netProfit)}
                change={stats?.revenue.change}
                icon={TrendingUp}
                color="green"
                loading={isLoading}
                href="/dashboard/finance/profit-loss"
              />
            </div>
            <div className="premium-dash__kpi premium-dash__kpi--slate">
              <StatCard
                title="Avg Order Value"
                value={fmt(aov)}
                change={stats?.avgOrderValue.change}
                icon={BarChart3}
                color="slate"
                loading={isLoading}
                href="/dashboard/orders"
              />
            </div>
            <div className="premium-dash__kpi premium-dash__kpi--gold">
              <StatCard
                title="Conversion"
                value="—"
                emptyHint="Visitor analytics not connected yet"
                icon={Percent}
                color="gold"
                loading={isLoading}
                href="/dashboard/analytics"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="premium-dash__zone" aria-labelledby="dash-shortcuts">
        <DashboardSectionHeader
          id="dash-shortcuts"
          title="Quick actions"
          meta="One-tap luxury commerce shortcuts"
          icon={Zap}
        />
        <div className="premium-dash__zone-body">
          <QuickActions embedded />
        </div>
      </section>

      <section className="premium-dash__zone" aria-labelledby="dash-revenue-intelligence">
        <DashboardSectionHeader
          id="dash-revenue-intelligence"
          title="Revenue intelligence"
          meta="Trend and payment mix"
          icon={Sparkles}
        />
        <div className="premium-dash__zone-body">
          <div className="premium-dash__charts grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SalesChart period={dateRange} title="Sales Overview" />
            </div>
            <ChannelDonutChart period={dateRange} />
          </div>
        </div>
      </section>

      <section className="premium-dash__zone" aria-labelledby="dash-operations-desk">
        <DashboardSectionHeader
          id="dash-operations-desk"
          title="Operations desk"
          meta="Activity, alerts and recent orders"
          icon={Activity}
        />
        <div className="premium-dash__zone-body">
          <div className="premium-dash__operations">
            <div className="grid gap-5 lg:grid-cols-2">
              <RecentActivities period={dateRange} />
              <AlertsPanel
                {...(stats?.alerts.codRiskOrders !== undefined
                  ? { codRisk: stats.alerts.codRiskOrders }
                  : {})}
                {...(stats?.alerts.failedPayments !== undefined
                  ? { failedPayments: stats.alerts.failedPayments }
                  : {})}
              />
            </div>

            <RecentOrdersTable />

            <div className="grid gap-5 lg:grid-cols-2">
              <TopCategories period={dateRange} />
              <TopProducts period={dateRange} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
