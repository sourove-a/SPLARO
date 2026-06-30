'use client'

import { Fragment, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Search, Globe, Code, Map, ArrowRightLeft, AlertTriangle, ChevronDown } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { ModulePanelShell } from '@/components/modules/ModulePanelShell'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { cn } from '@/lib/utils/cn'
import { useSeoOverview } from '@/lib/api/hooks'
import { formatRelativeTime } from '@/lib/api/orders'

type SeoStatus = 'good' | 'warning' | 'error' | 'pending'

const SEO_STATUS: Record<SeoStatus, string> = {
  good: 'admin-status admin-status--delivered',
  warning: 'admin-status admin-status--pending',
  error: 'admin-status admin-status--pending',
  pending: 'admin-status admin-status--processing',
}

function asSeoStatus(s: string): SeoStatus {
  if (s === 'good' || s === 'warning' || s === 'error' || s === 'pending') return s
  return 'pending'
}

export function KeywordsPanelLive() {
  const { data, isError, isLoading, refetch } = useSeoOverview()
  const [query, setQuery] = useState('')
  const keywords = data?.keywords ?? []
  const filtered = useMemo(
    () => keywords.filter((k) => !query || k.keyword.includes(query.toLowerCase())),
    [query, keywords],
  )
  const top10 = keywords.filter((k) => k.position > 0 && k.position <= 10).length

  if (isError) return <ApiOfflineBanner message="SEO API offline — start pnpm dev:api." />

  return (
    <ModulePanelShell
      kpis={[
        ['Tracked', isLoading ? '…' : keywords.length, 'default'],
        ['Top 10', top10, 'success'],
        ['Opportunities', keywords.filter((k) => k.status === 'warning').length, 'warning'],
        ['From search', keywords.reduce((s, k) => s + k.volume, 0), 'gold'],
      ]}
      pipeline={[
        ['Good', keywords.filter((k) => k.status === 'good').length],
        ['Warning', keywords.filter((k) => k.status === 'warning').length],
        ['Pending', keywords.filter((k) => k.status === 'pending').length],
        ['API', 'Live'],
        ['Total', keywords.length],
      ]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search keyword..."
      createLabel="Add keyword"
      onCreate={() => toast('Keywords are derived from storefront search analytics.', { icon: '🔍' })}
      onRefresh={() => void refetch()}
      onExport={() => toast.error('This action is not available yet — feature pending.')}
      tableIcon={Search}
      tableTitle={`Keywords · ${filtered.length}`}
      footer={`${keywords.length} keywords from search_analytics`}
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#6B6B6B]">No search keywords yet — they appear when customers search your store.</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Searches</th>
              <th>Position</th>
              <th>Change</th>
              <th>Difficulty</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((k) => (
              <tr key={k.id}>
                <td className="font-semibold">{k.keyword}</td>
                <td>{k.volume.toLocaleString()}</td>
                <td className="font-black">{k.position || '—'}</td>
                <td className="text-xs font-bold">{k.change}</td>
                <td>{k.difficulty}</td>
                <td>
                  <span className={SEO_STATUS[asSeoStatus(k.status)]}>{k.status}</span>
                </td>
                <td>
                  <RowActionsMenu recordName={k.keyword} moduleHref="/dashboard/keywords" recordId={k.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}

export function IndexMonitorPanelLive() {
  const { data, isError, refetch } = useSeoOverview()
  const [query, setQuery] = useState('')
  const pages = data?.indexPages ?? []
  const filtered = useMemo(() => pages.filter((p) => !query || p.url.includes(query)), [query, pages])
  const indexed = pages.filter((p) => p.google === 'indexed').length
  const errors = pages.filter((p) => p.status === 'error').length

  if (isError) return <ApiOfflineBanner message="SEO API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Indexed', indexed, 'success'],
        ['Pending', pages.filter((p) => p.google === 'pending').length, 'warning'],
        ['Issues', errors, 'gold'],
        ['Monitored', pages.length, 'default'],
      ]}
      pipeline={[
        ['Indexed', indexed],
        ['Pending', pages.filter((p) => p.google === 'pending').length],
        ['Products', pages.filter((p) => p.url.startsWith('/products')).length],
        ['Collections', pages.filter((p) => p.url.startsWith('/collections')).length],
        ['API', 'Live'],
      ]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search URL..."
      createLabel="Request indexing"
      onCreate={() => toast.error('This action is not available yet — feature pending.')}
      onRefresh={() => void refetch()}
      onExport={() => toast.error('This action is not available yet — feature pending.')}
      tableIcon={Globe}
      tableTitle={`Index monitor · ${filtered.length}`}
      footer={`${pages.length} URLs from published products`}
      extraFilters={
        errors > 0 ? (
          <div className="flex items-center gap-2 rounded-[14px] border border-red-200/60 bg-red-50/80 px-3 py-2 text-xs font-semibold text-red-800">
            <AlertTriangle className="h-3.5 w-3.5" /> {errors} URL(s) need meta title/description
          </div>
        ) : undefined
      }
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#6B6B6B]">No published products to monitor yet.</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>URL</th>
              <th>Google</th>
              <th>Bing</th>
              <th>Last crawl</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.url}>
                <td className="font-mono text-xs">{p.url}</td>
                <td>
                  <span
                    className={SEO_STATUS[p.google === 'indexed' ? 'good' : p.google === 'pending' ? 'warning' : 'error']}
                  >
                    {p.google}
                  </span>
                </td>
                <td className="text-xs">{p.bing}</td>
                <td className="muted text-xs">{formatRelativeTime(p.lastCrawl)}</td>
                <td>
                  <span className={SEO_STATUS[asSeoStatus(p.status)]}>{p.status}</span>
                </td>
                <td>
                  <AdminButton className="!px-2 !py-1 !text-xs" onClick={() => toast.error('This action is not available yet — feature pending.')}>
                    Re-crawl
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

export function SchemaManagerPanelLive() {
  const { data, isError, refetch } = useSeoOverview()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const schemas = data?.schemas ?? []

  if (isError) return <ApiOfflineBanner message="SEO API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Schema types', schemas.length, 'default'],
        ['Valid pages', schemas.reduce((s, x) => s + x.valid, 0), 'success'],
        ['Errors', schemas.reduce((s, x) => s + x.errors, 0), 'warning'],
        ['API', 'Live', 'gold'],
      ]}
      pipeline={[
        ['Types', schemas.length],
        ['Pages', schemas.reduce((s, x) => s + x.pages, 0)],
        ['Valid', schemas.reduce((s, x) => s + x.valid, 0)],
        ['Errors', schemas.reduce((s, x) => s + x.errors, 0)],
        ['Live', 'OK'],
      ]}
      query=""
      onQuery={() => {}}
      searchPlaceholder=""
      createLabel="Validate all"
      onCreate={() => toast.error('Schema validation is not available yet — feature pending.')}
      onRefresh={() => void refetch()}
      onExport={() => toast.error('Schema export is not available yet — feature pending.')}
      tableIcon={Code}
      tableTitle="Structured data"
      footer={`${schemas.reduce((s, x) => s + x.pages, 0)} pages with schema`}
    >
      {schemas.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#6B6B6B]">No schema configs yet — product schema inferred from catalog.</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Pages</th>
              <th>Valid</th>
              <th>Errors</th>
              <th>Last check</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {schemas.map((s) => (
              <Fragment key={s.id}>
                <tr className={cn(expandedId === s.id && 'bg-white/50')}>
                  <td>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      className="flex items-center gap-1 font-semibold hover:text-[#5E7CFF]"
                    >
                      {s.type}
                      <ChevronDown className={cn('h-3 w-3 transition', expandedId === s.id && 'rotate-180')} />
                    </button>
                  </td>
                  <td>{s.pages}</td>
                  <td className="font-bold text-emerald-700">{s.valid}</td>
                  <td className={cn('font-bold', s.errors > 0 && 'text-amber-700')}>{s.errors}</td>
                  <td className="muted text-xs">{formatRelativeTime(s.lastCheck)}</td>
                  <td>
                    <RowActionsMenu recordName={s.type} moduleHref="/dashboard/schema-manager" recordId={s.id} />
                  </td>
                </tr>
                {expandedId === s.id && s.errors > 0 ? (
                  <tr className="bg-white/40">
                    <td colSpan={6} className="!py-3 text-xs font-semibold text-amber-800">
                      {s.errors} page(s) below SEO score threshold for {s.type}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}

export function SitemapManagerPanelLive() {
  const { data, isError, refetch } = useSeoOverview()
  const sitemaps = data?.sitemaps ?? []

  if (isError) return <ApiOfflineBanner message="SEO API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Sitemaps', sitemaps.length, 'default'],
        ['Total URLs', sitemaps.reduce((s, x) => s + x.urls, 0), 'gold'],
        ['Submitted', sitemaps.filter((s) => s.submitted.includes('Google')).length, 'success'],
        ['Pending', sitemaps.filter((s) => s.status !== 'good').length, 'warning'],
      ]}
      pipeline={sitemaps.map((s) => [s.name.replace('.xml', ''), s.urls] as [string, number])}
      query=""
      onQuery={() => {}}
      searchPlaceholder=""
      createLabel="Regenerate all"
      onCreate={() => toast.error('This action is not available yet — feature pending.')}
      onRefresh={() => void refetch()}
      onExport={() => toast.error('This action is not available yet — feature pending.')}
      tableIcon={Map}
      tableTitle="XML sitemaps"
      footer="Counts from live catalog"
    >
      <table className="admin-module-table">
        <thead>
          <tr>
            <th>Sitemap</th>
            <th>URLs</th>
            <th>Last generated</th>
            <th>Submitted to</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sitemaps.map((s) => (
            <tr key={s.id}>
              <td className="font-mono text-xs font-black">{s.name}</td>
              <td className="font-bold">{s.urls}</td>
              <td className="text-xs">{formatRelativeTime(s.lastGen)}</td>
              <td className="text-xs">{s.submitted}</td>
              <td>
                <span className={SEO_STATUS[asSeoStatus(s.status)]}>{s.status}</span>
              </td>
              <td>
                <AdminButton className="!px-2 !py-1 !text-xs" onClick={() => toast.error('This action is not available yet — feature pending.')}>
                  Ping
                </AdminButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModulePanelShell>
  )
}

export function RedirectManagerPanelLive() {
  const { data, isError, refetch } = useSeoOverview()
  const [query, setQuery] = useState('')
  const redirects = data?.redirects ?? []
  const filtered = useMemo(
    () => redirects.filter((r) => !query || r.from.includes(query) || r.to.includes(query)),
    [query, redirects],
  )

  if (isError) return <ApiOfflineBanner message="SEO API offline." />

  return (
    <ModulePanelShell
      kpis={[
        ['Redirects', redirects.length, 'default'],
        ['301 rules', redirects.filter((r) => r.type === '301').length, 'success'],
        ['Canonical', redirects.length, 'gold'],
        ['API', 'Live', 'default'],
      ]}
      pipeline={[
        ['301', redirects.filter((r) => r.type === '301').length],
        ['Active', redirects.length],
        ['From SEO config', redirects.length],
        ['—', '—'],
        ['Live', 'OK'],
      ]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search from/to URL..."
      createLabel="Add redirect"
      onCreate={() => toast('Add canonical URLs in product SEO settings.', { icon: '↪️' })}
      onRefresh={() => void refetch()}
      onExport={() => toast.error('This action is not available yet — feature pending.')}
      tableIcon={ArrowRightLeft}
      tableTitle={`Redirects · ${filtered.length}`}
      footer={`${redirects.length} canonical rules from seo_config`}
    >
      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[#6B6B6B]">No canonical redirects configured yet.</p>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Type</th>
              <th>Hits</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.from}</td>
                <td className="font-mono text-xs text-[#5E7CFF]">{r.to}</td>
                <td className="font-bold">{r.type}</td>
                <td>{r.hits}</td>
                <td>
                  <span className={SEO_STATUS[asSeoStatus(r.status)]}>{r.status}</span>
                </td>
                <td>
                  <RowActionsMenu recordName={r.from} moduleHref="/dashboard/redirect-manager" recordId={r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
  )
}
