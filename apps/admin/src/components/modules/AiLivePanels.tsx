'use client'

import { useMemo, useState } from 'react'
import { refreshWithToast, toastInfo, toastNotImplemented } from '@/lib/admin/feedback'
import { Sparkles, Globe, LineChart, TrendingUp, Users } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { ModulePanelShell, STATUS_CLASS, formatBDT } from '@/components/modules/ModulePanelShell'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { cn } from '@/lib/utils/cn'
import { useSeoOverview, useExecutiveDashboard, useCustomers } from '@/lib/api/hooks'
import { formatBDT as formatCurrency } from '@/lib/utils/currency'
import type { ApiCustomer } from '@/lib/api/customers'

type JobStatus = 'running' | 'completed' | 'queued' | 'failed'

function spent(c: ApiCustomer) {
  return Number(c.totalSpent) || 0
}

import { AiCommandCenterPanel } from '@/components/agent/AiCommandCenterPanel'

export function AiAgentPanelLive() {
  return <AiCommandCenterPanel />
}

export function AiContentPanelLive() {
  const { data, isError, refetch } = useSeoOverview()
  const [query, setQuery] = useState('')
  const audits = data?.productAudits ?? []

  const items = useMemo(
    () =>
      audits.map((p) => ({
        id: p.id,
        product: p.name,
        en: p.hasMetaTitle ? 'Ready' : 'Missing title',
        bn: p.hasMetaDescription ? 'Ready' : 'Missing description',
        social: p.score >= 80 ? 'Ready' : 'Needs work',
        status: (p.score >= 80 ? 'completed' : p.score >= 50 ? 'running' : 'queued') as JobStatus,
      })),
    [audits],
  )

  const filtered = useMemo(
    () => items.filter((i) => !query || i.product.toLowerCase().includes(query.toLowerCase())),
    [query, items],
  )

  if (isError) return <ApiOfflineBanner message="AI content API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Products', audits.length, 'default'],
        ['SEO ready', audits.filter((p) => p.score >= 80).length, 'success'],
        ['Needs content', audits.filter((p) => !p.hasMetaTitle || !p.hasMetaDescription).length, 'warning'],
        ['Avg score', data?.summary.avgScore ?? 0, 'gold'],
      ]}
      pipeline={[['Ready', audits.filter((p) => p.score >= 80).length], ['Warning', data?.summary.warnings ?? 0], ['Critical', data?.summary.criticalErrors ?? 0], ['Total', audits.length], ['API', 1]]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search product..."
      createLabel="Bulk generate"
      onCreate={() => toastInfo('Bulk AI copy generation coming — edit meta in Products for now.')}
      onRefresh={() => void refreshWithToast(refetch, 'Content data refreshed')}
      tableIcon={Sparkles}
      tableTitle={`AI content queue · ${filtered.length}`}
      footer="Derived from product SEO audits"
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#6B6B6B]">No published products to optimize yet.</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Meta title</th>
              <th>Meta description</th>
              <th>Score</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 30).map((i) => (
              <tr key={i.id}>
                <td className="font-semibold">{i.product}</td>
                <td className="text-xs">{i.en}</td>
                <td className="text-xs">{i.bn}</td>
                <td className="text-xs">{i.social}</td>
                <td>
                  <span className={STATUS_CLASS[i.status === 'completed' ? 'success' : 'processing']}>{i.status}</span>
                </td>
                <td>
                  <AdminButton size="sm" onClick={() => window.location.assign('/dashboard/products')}>
                    Edit
                  </AdminButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}

export function AiSeoPanelLive() {
  const { data, isError, refetch } = useSeoOverview()
  const fixes = useMemo(
    () =>
      (data?.productAudits ?? [])
        .filter((p) => p.score < 80)
        .map((p) => ({
          id: p.id,
          page: `/products/${p.slug}`,
          issue: !p.hasMetaTitle ? 'Missing meta title' : !p.hasMetaDescription ? 'Missing meta description' : 'Low SEO score',
          score: p.score,
          fix: 'Auto-generate meta',
        })),
    [data],
  )

  if (isError) return <ApiOfflineBanner message="AI SEO API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Pages audited', data?.summary.products ?? 0, 'default'],
        ['Issues', fixes.length, 'warning'],
        ['Auto-fixable', fixes.filter((f) => f.issue.includes('meta')).length, 'success'],
        ['Avg score', data?.summary.avgScore ?? 0, 'gold'],
      ]}
      pipeline={[['Critical', data?.summary.criticalErrors ?? 0], ['Warnings', data?.summary.warnings ?? 0], ['Products', data?.summary.products ?? 0], ['API', 1], ['Live', 1]]}
      query=""
      onQuery={() => {}}
      searchPlaceholder=""
      createLabel="Run AI audit"
      onCreate={() => void refetch()}
      onRefresh={() => void refreshWithToast(refetch, 'SEO data refreshed')}
      tableIcon={Globe}
      tableTitle="AI SEO fixes"
      footer={`${fixes.length} issues from live catalog`}
    >
      {fixes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#6B6B6B]">All products pass SEO threshold (80+).</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Issue</th>
              <th>Score</th>
              <th>Suggested fix</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fixes.slice(0, 25).map((f) => (
              <tr key={f.id}>
                <td className="font-mono text-xs">{f.page}</td>
                <td className="text-xs">{f.issue}</td>
                <td className={cn('font-black', f.score < 60 && 'text-red-600', f.score < 80 && f.score >= 60 && 'text-amber-700')}>
                  {f.score}
                </td>
                <td className="text-xs font-semibold text-[#5E7CFF]">{f.fix}</td>
                <td>
                  {/* Honest label: this opens the product editor — it does not
                      apply anything automatically. */}
                  <AdminButton variant="gold" size="sm" onClick={() => window.location.assign('/dashboard/products')}>
                    Edit product
                  </AdminButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}

export function AiAnalyticsPanelLive() {
  const { data, isError, refetch } = useExecutiveDashboard()
  const kpis = data?.kpis

  const forecasts = useMemo(
    () => [
      { metric: 'Revenue (MTD)', forecast: formatBDT(kpis?.revenue ?? 0), confidence: 'Live', trend: `+${kpis?.growth ?? 0}%` },
      { metric: 'Orders (MTD)', forecast: String(kpis?.orders ?? 0), confidence: 'Live', trend: '—' },
      { metric: 'Net profit', forecast: formatBDT(kpis?.netProfit ?? 0), confidence: 'Live', trend: '—' },
      { metric: 'Customers', forecast: String(kpis?.customers ?? 0), confidence: 'Live', trend: '—' },
    ],
    [kpis],
  )

  if (isError) return <ApiOfflineBanner message="AI analytics API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Revenue MTD', formatBDT(kpis?.revenue ?? 0), 'gold'],
        ['Orders', kpis?.orders ?? 0, 'default'],
        ['Products', kpis?.products ?? 0, 'success'],
        ['Growth', `${kpis?.growth ?? 0}%`, 'warning'],
      ]}
      pipeline={[['Revenue', '↑'], ['Orders', String(kpis?.orders ?? 0)], ['Customers', String(kpis?.customers ?? 0)], ['Warehouses', String(kpis?.warehouses ?? 0)], ['Live', 1]]}
      query=""
      onQuery={() => {}}
      searchPlaceholder=""
      createLabel="Refresh KPIs"
      onCreate={() => void refetch()}
      onRefresh={() => void refreshWithToast(refetch, 'Analytics refreshed')}
      tableIcon={LineChart}
      tableTitle="Live business KPIs"
      footer="From executive dashboard — month-to-date (no AI forecasting yet)"
    >
      <table className="admin-module-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Current</th>
            <th>Source</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          {forecasts.map((f) => (
            <tr key={f.metric}>
              <td className="font-semibold">{f.metric}</td>
              <td className="font-black text-[#5E7CFF]">{f.forecast}</td>
              <td>{f.confidence}</td>
              <td className="font-bold text-emerald-700">{f.trend}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModulePanelShell>
  )
}

export function AiCustomerInsightsPanelLive() {
  const { data, isError, isLoading, refetch } = useCustomers({ limit: 200 })
  const customers = data?.customers ?? []

  const segments = useMemo(() => {
    const vip = customers.filter((c) => c.loyaltyTier === 'GOLD' || c.loyaltyTier === 'PLATINUM')
    const atRisk = customers.filter((c) => c.codRiskScore >= 60)
    const repeat = customers.filter((c) => c.totalOrders >= 3)
    const avgClv = customers.length > 0 ? customers.reduce((s, c) => s + spent(c), 0) / customers.length : 0
    return [
      { id: 'vip', segment: 'High CLV · VIP', customers: vip.length, clv: formatCurrency(vip.length ? vip.reduce((s, c) => s + spent(c), 0) / vip.length : 0), churnRisk: 'Low', action: 'VIP early access' },
      { id: 'risk', segment: 'COD at-risk', customers: atRisk.length, clv: formatCurrency(avgClv), churnRisk: 'High', action: 'Review COD orders' },
      { id: 'repeat', segment: 'Repeat buyers (3+)', customers: repeat.length, clv: formatCurrency(repeat.length ? repeat.reduce((s, c) => s + spent(c), 0) / repeat.length : 0), churnRisk: 'Low', action: 'Cross-sell campaigns' },
    ]
  }, [customers])

  if (isError) return <ApiOfflineBanner message="Customer intelligence API offline — start pnpm dev:api." />

  return (
    <ModulePanelShell
      kpis={[
        ['Customers', isLoading ? '…' : customers.length, 'default'],
        ['At-risk COD', isLoading ? '…' : customers.filter((c) => c.codRiskScore >= 60).length, 'warning'],
        ['VIP', isLoading ? '…' : customers.filter((c) => c.loyaltyTier === 'GOLD' || c.loyaltyTier === 'PLATINUM').length, 'gold'],
        ['Repeat 3+', isLoading ? '…' : customers.filter((c) => c.totalOrders >= 3).length, 'success'],
      ]}
      pipeline={segments.map((s) => [s.segment.split(' ')[0] ?? 'Seg', s.customers] as [string, number])}
      query=""
      onQuery={() => {}}
      searchPlaceholder=""
      createLabel="Run analysis"
      onCreate={() => void refreshWithToast(refetch, 'Segments refreshed')}
      onRefresh={() => void refreshWithToast(refetch, 'Customer data refreshed')}
      tableIcon={Users}
      tableTitle="AI customer segments"
      footer={isLoading ? 'Loading customers…' : customers.length === 0 ? 'No customers yet — run pnpm db:seed or add customers in Commerce.' : 'Computed from live customer records'}
    >
      {isLoading ? (
        <p className="px-4 py-8 text-sm text-[#6B6B6B]">Loading customer segments…</p>
      ) : customers.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-semibold text-[#1A1A1A]">No customer data yet</p>
          <p className="mt-2 text-xs text-[#6B6B6B]">Start the API with <code className="rounded bg-black/5 px-1">pnpm dev:api</code> and seed the database with <code className="rounded bg-black/5 px-1">pnpm db:seed</code>.</p>
        </div>
      ) : (
      <table className="admin-module-table">
        <thead>
          <tr>
            <th>Segment</th>
            <th>Customers</th>
            <th>Avg CLV</th>
            <th>Risk</th>
            <th>AI action</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.id}>
              <td className="font-semibold">{s.segment}</td>
              <td>{s.customers}</td>
              <td className="font-black">{s.clv}</td>
              <td>
                <span className={cn('text-xs font-bold', s.churnRisk === 'High' ? 'text-red-600' : 'text-emerald-700')}>{s.churnRisk}</span>
              </td>
              <td className="text-xs font-semibold text-[#5E7CFF]">{s.action}</td>
              <td>
                <AdminButton size="sm" onClick={() => toastNotImplemented('Campaign from segment')}>
                  Activate
                </AdminButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </ModulePanelShell>
  )
}

export function AiSalesPanelLive() {
  const { data, isError, refetch } = useExecutiveDashboard()
  const kpis = data?.kpis

  const recs = useMemo(
    () => [
      { id: 'upsell', type: 'Upsell', trigger: 'High AOV orders', suggestion: `Target ${kpis?.orders ?? 0} MTD orders`, convBoost: '—', status: 'active' },
      { id: 'cross', type: 'Cross-sell', trigger: 'Repeat customers', suggestion: `${kpis?.customers ?? 0} customer base`, convBoost: '—', status: 'active' },
      { id: 'inventory', type: 'Restock', trigger: 'Low stock SKUs', suggestion: `${kpis?.products ?? 0} products in catalog`, convBoost: '—', status: 'draft' },
    ],
    [kpis],
  )

  if (isError) return <ApiOfflineBanner message="AI sales API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Revenue MTD', formatBDT(kpis?.revenue ?? 0), 'gold'],
        ['Orders', kpis?.orders ?? 0, 'default'],
        ['Customers', kpis?.customers ?? 0, 'success'],
        ['Growth', `${kpis?.growth ?? 0}%`, 'warning'],
      ]}
      pipeline={[['Revenue', formatBDT(kpis?.revenue ?? 0)], ['Orders', kpis?.orders ?? 0], ['Customers', kpis?.customers ?? 0], ['Products', kpis?.products ?? 0], ['Live', 1]]}
      query=""
      onQuery={() => {}}
      searchPlaceholder=""
      createLabel="New rule"
      onCreate={() => toastInfo('Sales rules — use Coupons and Campaigns modules.')}
      onRefresh={() => void refreshWithToast(refetch, 'Sales data refreshed')}
      tableIcon={TrendingUp}
      tableTitle="AI sales recommendations"
      footer="Recommendations from executive KPIs"
    >
      <table className="admin-module-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Trigger</th>
            <th>Suggestion</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {recs.map((r) => (
            <tr key={r.id}>
              <td className="font-bold">{r.type}</td>
              <td className="text-xs">{r.trigger}</td>
              <td className="text-xs">{r.suggestion}</td>
              <td>
                <span className={STATUS_CLASS[r.status === 'active' ? 'active' : 'draft']}>{r.status}</span>
              </td>
              <td>
                <RowActionsMenu recordName={r.type} moduleHref="/dashboard/ai-sales" recordId={r.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModulePanelShell>
  )
}
