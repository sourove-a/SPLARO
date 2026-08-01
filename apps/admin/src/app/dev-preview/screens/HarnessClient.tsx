'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'

import { DcCustomers } from '@/components/customers/DcCustomers'
import { DcDashboard } from '@/components/dashboard/DcDashboard'
import { DcProducts } from '@/components/products/DcProducts'
import { DcNotificationsPopover } from '@/components/dc/DcNotificationsPopover'
import { DcAnalytics } from '@/components/dc/screens/DcAnalytics'
import { DcBulkCsv } from '@/components/dc/screens/DcBulkCsv'
import { DcCampaigns } from '@/components/dc/screens/DcCampaigns'
import { DcCoupons } from '@/components/dc/screens/DcCoupons'
import { DcFinanceOverview } from '@/components/dc/screens/DcFinanceOverview'
import { DcGoogleSheets } from '@/components/dc/screens/DcGoogleSheets'
import { DcOperationsHub } from '@/components/dc/screens/DcOperationsHub'
import { DcProfitLoss } from '@/components/dc/screens/DcProfitLoss'
import { DcPurchaseOrders } from '@/components/dc/screens/DcPurchaseOrders'
import { DcReturnsRma } from '@/components/dc/screens/DcReturnsRma'
import { DcSmsCenter } from '@/components/dc/screens/DcSmsCenter'
import { DcWarehouseStock } from '@/components/dc/screens/DcWarehouseStock'
import * as fx from './fixtures'

/** Every screen the harness can mount, keyed by the `?screen=` value. */
const SCREENS: Record<string, { label: string; render: () => React.ReactElement }> = {
  dashboard: { label: 'Dashboard', render: () => <DcDashboard /> },
  customers: { label: 'Customers', render: () => <DcCustomers /> },
  products: { label: 'Products', render: () => <DcProducts /> },
  notifications: {
    label: 'Notification tray',
    // Pinned open — the tray is normally a header popover with no route.
    render: () => <DcNotificationsPopover open onClose={() => undefined} />,
  },
  procurement: { label: 'Purchase Orders', render: () => <DcPurchaseOrders /> },
  returns: { label: 'Returns / RMA', render: () => <DcReturnsRma /> },
  operations: { label: 'Operations Hub', render: () => <DcOperationsHub /> },
  wms: { label: 'Warehouse & Stock', render: () => <DcWarehouseStock /> },
  finance: { label: 'Finance Overview', render: () => <DcFinanceOverview /> },
  pl: { label: 'Profit & Loss', render: () => <DcProfitLoss /> },
  coupons: { label: 'Coupons', render: () => <DcCoupons /> },
  campaigns: { label: 'Campaigns', render: () => <DcCampaigns /> },
  sms: { label: 'SMS Center', render: () => <DcSmsCenter /> },
  sheets: { label: 'Google Sheets', render: () => <DcGoogleSheets /> },
  bulk: { label: 'Bulk & CSV', render: () => <DcBulkCsv /> },
  analytics: { label: 'Analytics', render: () => <DcAnalytics /> },
}

export const HARNESS_SCREENS = Object.keys(SCREENS)

/**
 * Seeds a throwaway QueryClient so the screens render their `live` state.
 * `?state=empty` and `?state=error` exercise the other module states instead.
 */
function buildClient(state: string): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
        // Nothing in the harness should ever reach the network.
        //
        // Caveat for the `notifications` screen: a hook that sets its own
        // `queryFn` and `refetchInterval` — as useNotificationsOverview does,
        // polling every 15s — outranks both of these defaults, so after ~15s
        // that screen swaps the fixture for its live-API error state. That is
        // the harness hitting its limit, not the tray misbehaving; grab the
        // screenshot in the first few seconds.
        queryFn: async () => {
          throw new Error('harness: no network')
        },
      },
    },
  })

  if (state === 'error') return client

  const empty = state === 'empty'
  const seed = <T,>(key: unknown[], live: T, blank: T) =>
    client.setQueryData(key, empty ? blank : live)

  seed(['procurement-overview'], fx.procurementOverview, { suppliers: [], orders: [], grns: [] })
  seed(['returns', undefined], fx.returns, [])
  seed(['returns'], fx.returns, [])
  seed(['wms-overview'], fx.wmsOverview, {
    warehouses: [],
    movements: [],
    transfers: [],
    stockSummary: { available: 0, reserved: 0, damaged: 0 },
  })
  seed(['coupons'], fx.coupons, { coupons: [], total: 0 })
  seed(['campaigns'], fx.campaigns, [])
  seed(['campaign-stats'], fx.campaignStats, {
    byStatus: [],
    byType: [],
    totalSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    openRate: 0,
    clickRate: 0,
  })
  seed(['marketing-overview'], fx.marketingOverview, { ...fx.marketingOverview, smsLogs: [] })
  seed(['google-sheets-dashboard'], fx.sheetsDashboard, {
    ...fx.sheetsDashboard,
    sheets: [],
    stats: { total: 0, configured: 0, completed: 0, failed: 0, pending: 0 },
  })
  seed(['google-sync-logs'], fx.syncLogs, { items: [], total: 0, page: 1 })
  seed(['finance-dashboard'], fx.financeDashboard, {
    ...fx.financeDashboard,
    partners: [],
    expensesByCategory: [],
    pendingApprovals: 0,
  })
  for (const p of ['daily', 'weekly', 'monthly', 'yearly']) {
    seed(['profit-loss', p], fx.profitLoss, {
      ...fx.profitLoss,
      orderCount: 0,
      totals: {
        grossRevenue: 0,
        productCost: 0,
        courierCost: 0,
        packagingCost: 0,
        paymentGatewayFee: 0,
        discount: 0,
        returnLoss: 0,
        netProfit: 0,
      },
    })
  }
  for (const p of ['1d', '7d', '30d', '90d']) {
    seed(['dashboard-stats', p], fx.dashboardStats, {
      ...fx.dashboardStats,
      alerts: { codRiskOrders: 0, failedPayments: 0 },
    })
    seed(['dashboard-insights', p], fx.dashboardInsights, {
      topCategories: [],
      topProducts: [],
      paymentMix: [],
      paymentMixTotal: 0,
      recentActivities: [],
    })
  }
  seed(['orders', { limit: 50, page: 1 }], fx.ordersList, { ...fx.ordersList, orders: [], total: 0 })
  seed(['orders', { limit: 50 }], fx.ordersList, { ...fx.ordersList, orders: [], total: 0 })
  seed(['orders', { limit: 100 }], fx.ordersList, { ...fx.ordersList, orders: [], total: 0 })
  seed(['products', { limit: 200 }], fx.productsList, { ...fx.productsList, products: [], total: 0 })
  seed(['customers', { limit: 200 }], fx.customersList, { customers: [], total: 0 })
  seed(['inventory-alerts'], fx.inventoryAlerts, { lowStock: 0, outOfStock: 0 })
  for (const p of ['7d', '30d', '90d']) {
    seed(['revenue-series', p], fx.revenueSeries, { ...fx.revenueSeries, data: [] })
  }
  seed(['conversion-funnel', '30d'], fx.conversionFunnel, {
    ...fx.conversionFunnel,
    steps: fx.conversionFunnel.steps.map((s) => ({ ...s, count: 0 })),
  })
  seed(['daily-goal'], fx.dailyGoal, {
    goal: null,
    achieved: 0,
    orders: 0,
    percent: null,
    remaining: null,
  })
  seed(['courier-stats', 30], fx.courierStats, {
    byStatus: [],
    byProvider: [],
    recentFailed: [],
  })
  seed(['courier-stats'], fx.courierStats, { byStatus: [], byProvider: [], recentFailed: [] })
  seed(['notifications-overview'], fx.notificationsOverview, {
    logs: [],
    summary: { total: 0, sent: 0, failed: 0, pending: 0, critical: 0, deliveredRate: 0 },
  })

  return client
}

/**
 * `?sweep=1` walks every screen on its own, measuring layout overflow after
 * paint and parking the result in sessionStorage before hopping to the next.
 * The admin sends frame-blocking headers, so iframes cannot be used for this.
 */
function useSweep(screen: string, state: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const KEY = 'dc-sweep-results'
    const timer = window.setTimeout(() => {
      const width = document.documentElement.clientWidth
      const offenders: Array<{ tag: string; right: number; text: string }> = []
      document.querySelectorAll('.dc-root *').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.right > width + 1) {
          offenders.push({
            tag: el.tagName,
            right: Math.round(r.right),
            text: (el.textContent ?? '').trim().slice(0, 40),
          })
        }
      })
      const crashed = document.body.innerText.includes('Admin panel error')
      const prev = JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
      prev[`${screen}@${width}`] = {
        crashed,
        docScrollWidth: document.documentElement.scrollWidth,
        overflows: document.documentElement.scrollWidth > width + 1,
        offenders: offenders.length,
        worst: offenders.slice(0, 3),
        tables: document.querySelectorAll('table').length,
      }
      sessionStorage.setItem(KEY, JSON.stringify(prev))

      const order = Object.keys(SCREENS)
      const next = order[order.indexOf(screen) + 1]
      if (next) {
        window.location.href = `/dev-preview/screens?screen=${next}&state=${state}&sweep=1`
      } else {
        sessionStorage.setItem('dc-sweep-done', '1')
      }
    }, 1400)
    return () => window.clearTimeout(timer)
  }, [screen, state, enabled])
}

export function HarnessClient() {
  const params = useSearchParams()
  const screen = params.get('screen') ?? 'procurement'
  const state = params.get('state') ?? 'live'
  const entry = SCREENS[screen]

  const client = useMemo(() => buildClient(state), [state])
  useSweep(screen, state, params.get('sweep') === '1')

  return (
    <QueryClientProvider client={client}>
      {/* Same root class the real shell puts on, so the DC tokens resolve. */}
      <div
        className="dc-root"
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          color: 'var(--ink)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            paddingBottom: 12,
            borderBottom: '1px solid var(--line)',
          }}
        >
          {Object.entries(SCREENS).map(([key, s]) => (
            <a
              key={key}
              href={`/dev-preview/screens?screen=${key}&state=${state}`}
              style={{
                padding: '5px 10px',
                borderRadius: 99,
                border: `1px solid ${key === screen ? 'var(--violet-solid)' : 'var(--line)'}`,
                background: key === screen ? 'var(--violet-solid)' : 'transparent',
                color: key === screen ? 'var(--on-violet)' : 'var(--ink-2)',
                font: '600 11px/1.4 Inter, sans-serif',
              }}
            >
              {s.label}
            </a>
          ))}
        </div>
        {/* One screen per page on purpose: the screens each own page-level
            chrome, so stacking them is not a state the product ever renders. */}
        {entry ? entry.render() : <p>Unknown screen “{screen}”.</p>}
      </div>
    </QueryClientProvider>
  )
}
