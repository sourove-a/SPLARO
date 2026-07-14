'use client'

import { useMemo, useState } from 'react'
import { Activity, Code2, Store, Search, Plus } from 'lucide-react'
import { BACKEND_NOT_CONNECTED_TITLE } from '@/lib/admin/feedback'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useDeveloper, useMarketplace, useObservability } from '@/lib/api/hooks'
import { formatBDT } from '@/lib/utils/currency'
import { ApiOfflineBanner, KpiGrid } from '@/components/modules/PlatformUi'

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'active' || status === 'healthy' || status === 'completed'
  const warn = status === 'pending' || status === 'degraded' || status === 'running' || status === 'unknown'
  return (
    <span className={`admin-status admin-status--${ok ? 'delivered' : warn ? 'processing' : 'pending'}`}>
      {status}
    </span>
  )
}

export function ObservabilityModulePanel({ moduleHref }: ModuleContextProps) {
  const { data, isError, isLoading } = useObservability()
  const [query, setQuery] = useState('')

  if (isError) return <ApiOfflineBanner />

  const kpis = data?.kpis
  const rows =
    moduleHref === '/dashboard/observability/disaster-recovery'
      ? (data?.backups ?? [])
      : (data?.services ?? [])
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="space-y-5">
      <KpiGrid
        items={
          moduleHref === '/dashboard/observability/disaster-recovery'
            ? [
                ['Last backup', 'Scheduled', 'success'],
                ['RPO', '15 min', 'gold'],
                ['RTO', '30 min', 'default'],
                ['DR status', 'Ready', 'success'],
              ]
            : [
                ['Uptime', isLoading ? '…' : kpis?.uptime ?? '—', 'success'],
                ['API latency', isLoading ? '…' : kpis?.apiP95 ?? '—', 'gold'],
                ['Errors/hr', isLoading ? '…' : kpis?.errorsPerHour ?? 0, 'warning'],
                ['Queue lag', isLoading ? '…' : kpis?.queueLag ?? 0, 'default'],
              ]
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="admin-search max-w-md flex-1">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services..."
            className="flex-1 bg-transparent text-sm font-semibold outline-none"
          />
        </div>
        <AdminNavLink href="/dashboard/api-health" className="admin-btn admin-btn--gold px-4 py-2 text-xs font-black">
          Full API Health
        </AdminNavLink>
      </div>

      <div className="admin-module-table-wrap">
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Status</th>
              <th>Metric</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td className="font-semibold">{row.name}</td>
                <td>
                  <StatusBadge status={'status' in row ? row.status : 'active'} />
                </td>
                <td className="muted">{'latency' in row ? row.latency : row.metric}</td>
                <td className="muted">{row.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {moduleHref !== '/dashboard/observability/disaster-recovery' && (data?.cronJobs?.length ?? 0) > 0 ? (
        <section className="admin-module-card">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#5E7CFF]" />
            <h3 className="admin-module-card__title">Recent cron jobs</h3>
          </div>
          <div className="space-y-2">
            {data!.cronJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between text-xs font-semibold">
                <span>{job.name}</span>
                <StatusBadge status={job.status} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

export function MarketplaceModulePanel(_props: ModuleContextProps) {
  const { data, isError, isLoading } = useMarketplace()
  const [query, setQuery] = useState('')

  const vendors = useMemo(
    () => (data?.vendors ?? []).filter((v) => v.name.toLowerCase().includes(query.toLowerCase())),
    [data, query],
  )

  if (isError) return <ApiOfflineBanner />

  const kpis = data?.kpis

  return (
    <div className="space-y-5">
      <KpiGrid
        items={[
          ['Vendors', isLoading ? '…' : kpis?.vendors ?? 0, 'default'],
          ['GMV', isLoading ? '…' : formatBDT(kpis?.gmv ?? 0), 'gold'],
          ['Active', isLoading ? '…' : kpis?.active ?? 0, 'success'],
          ['Pending KYC', isLoading ? '…' : kpis?.pendingKyc ?? 0, 'warning'],
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="admin-search max-w-md flex-1">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors..."
            className="flex-1 bg-transparent text-sm font-semibold outline-none"
          />
        </div>
        <AdminButton variant="gold" disabled title={BACKEND_NOT_CONNECTED_TITLE}>
          <Plus className="h-4 w-4" />
          Add vendor
        </AdminButton>
      </div>

      {vendors.length === 0 && !isLoading ? (
        <div className="admin-module-card text-center">
          <Store className="mx-auto h-8 w-8 text-[#5E7CFF]" />
          <p className="mt-2 text-sm font-semibold text-[#6B6B6B]">No vendors yet. Marketplace is ready for onboarding.</p>
        </div>
      ) : (
        <div className="admin-module-table-wrap">
          <table className="admin-module-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Email</th>
                <th>Status</th>
                <th>Commission</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td className="font-semibold">{v.name}</td>
                  <td className="muted">{v.email}</td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td>{v.metric}</td>
                  <td className="muted">{v.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function DeveloperModulePanel(_props: ModuleContextProps) {
  const { data, isError, isLoading } = useDeveloper()

  if (isError) return <ApiOfflineBanner />

  const kpis = data?.kpis

  return (
    <div className="space-y-5">
      <KpiGrid
        items={[
          ['API keys', isLoading ? '…' : kpis?.apiKeys ?? 0, 'default'],
          ['Webhooks', isLoading ? '…' : kpis?.webhooks ?? 0, 'success'],
          ['Automation rules', isLoading ? '…' : kpis?.automationRules ?? 0, 'gold'],
          ['Sandbox', kpis?.sandbox ? 'On' : 'Off', 'success'],
        ]}
      />

      <section className="admin-module-card">
        <div className="mb-3 flex items-center gap-2">
          <Code2 className="h-5 w-5 text-[#5E7CFF]" />
          <h3 className="admin-module-card__title">API keys</h3>
        </div>
        {(data?.apiKeys.length ?? 0) === 0 ? (
          <p className="text-sm font-semibold text-[#6B6B6B]">No API keys yet. Create one for external integrations.</p>
        ) : (
          <div className="space-y-2">
            {data!.apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between rounded-[14px] bg-white/70 px-3 py-2">
                <div>
                  <p className="text-sm font-black">{key.name}</p>
                  <p className="font-mono text-[10px] text-[#6B6B6B]">{key.prefix}••••</p>
                </div>
                <StatusBadge status={key.status} />
              </div>
            ))}
          </div>
        )}
        <AdminButton className="mt-3" variant="gold" disabled title={BACKEND_NOT_CONNECTED_TITLE}>
          Generate API key
        </AdminButton>
      </section>

      <section className="admin-module-card">
        <h3 className="admin-module-card__title">Automation webhooks</h3>
        {(data?.webhooks.length ?? 0) === 0 ? (
          <p className="text-sm font-semibold text-[#6B6B6B]">No webhook rules. Add CUSTOM_WEBHOOK actions in Automation Rules.</p>
        ) : (
          <div className="admin-module-table-wrap mt-3">
            <table className="admin-module-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data!.webhooks.map((w) => (
                  <tr key={w.id}>
                    <td className="font-semibold">{w.name}</td>
                    <td className="muted">{w.trigger}</td>
                    <td>
                      <StatusBadge status={w.status} />
                    </td>
                    <td className="muted">{w.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminNavLink href="/dashboard/automation-rules" className="mt-3 inline-flex text-xs font-black text-[#5E7CFF] hover:underline">
          Manage automation rules →
        </AdminNavLink>
      </section>
    </div>
  )
}
