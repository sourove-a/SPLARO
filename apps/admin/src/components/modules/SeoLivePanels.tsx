'use client'

import { Fragment, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Search, Globe, Code, Map, ArrowRightLeft, AlertTriangle, ChevronDown } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { ModulePanelShell } from '@/components/modules/ModulePanelShell'
import { ApiOfflineHint } from '@/components/modules/PlatformUi'
import { cn } from '@/lib/utils/cn'
import { useSeoOverview, useRedirects, useCreateRedirect, useUpdateRedirect, useDeleteRedirect, usePermission } from '@/lib/api/hooks'
import { PERMISSION_DENIED_TITLE } from '@/lib/auth/permissions'
import { formatRelativeTime } from '@/lib/api/orders'
import { GSC_REQUIRED_TITLE } from '@/lib/admin/feedback'
import { getLiveSitemapUrl } from '@/lib/api/seo'

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
  const { data, isOffline, isLoading, refetch } = useSeoOverview()
  const [query, setQuery] = useState('')
  const keywords = useMemo(() => data?.keywords ?? [], [data])
  const filtered = useMemo(
    () => keywords.filter((k) => !query || k.keyword.includes(query.toLowerCase())),
    [query, keywords],
  )
  const top10 = keywords.filter((k) => k.position > 0 && k.position <= 10).length

  return (
    <>
      {isOffline ? <ApiOfflineHint message="API offline — keyword data empty until pnpm dev:api runs." /> : null}
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
      exportDisabled
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
    </>
  )
}

export function IndexMonitorPanelLive() {
  const { data, isOffline, refetch } = useSeoOverview()
  const [query, setQuery] = useState('')
  const pages = useMemo(() => data?.indexPages ?? [], [data])
  const filtered = useMemo(() => pages.filter((p) => !query || p.url.includes(query)), [query, pages])
  // Real index status needs a Search Console connection — until then the
  // KPIs report meta completeness, which comes from the live catalog.
  const metaComplete = pages.filter((p) => p.status === 'good').length
  const needsMeta = pages.filter((p) => p.status === 'warning').length
  const errors = pages.filter((p) => p.status === 'error').length

  return (
    <>
      {isOffline ? <ApiOfflineHint message="API offline — index monitor data unavailable." /> : null}
    <ModulePanelShell
      kpis={[
        ['Meta complete', metaComplete, 'success'],
        ['Needs meta', needsMeta, 'warning'],
        ['Issues', errors, 'gold'],
        ['Monitored', pages.length, 'default'],
      ]}
      pipeline={[
        ['Meta OK', metaComplete],
        ['Needs meta', needsMeta],
        ['Products', pages.filter((p) => p.url.startsWith('/products')).length],
        ['Collections', pages.filter((p) => p.url.startsWith('/collections')).length],
        ['API', 'Live'],
      ]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search URL..."
      createLabel="Request indexing (GSC)"
      createDisabled
      onCreate={() => {}}
      onRefresh={() => void refetch()}
      exportDisabled
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
                <td className="muted text-xs">
                  {p.google === 'unknown' ? '— connect Search Console' : (
                    <span className={SEO_STATUS[p.google === 'indexed' ? 'good' : p.google === 'pending' ? 'warning' : 'error']}>
                      {p.google}
                    </span>
                  )}
                </td>
                <td className="muted text-xs">{p.bing === 'unknown' ? '—' : p.bing}</td>
                <td className="muted text-xs">{p.lastCrawl ? formatRelativeTime(p.lastCrawl) : '—'}</td>
                <td>
                  <span className={SEO_STATUS[asSeoStatus(p.status)]}>{p.status}</span>
                </td>
                <td>
                  <AdminButton size="sm" disabled title={GSC_REQUIRED_TITLE}>
                    Re-crawl
                  </AdminButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
    </>
  )
}

export function SchemaManagerPanelLive() {
  const { data, isOffline, refetch } = useSeoOverview()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const schemas = data?.schemas ?? []

  return (
    <>
      {isOffline ? <ApiOfflineHint message="API offline — schema data unavailable." /> : null}
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
      createDisabled
      onCreate={() => {}}
      onRefresh={() => void refetch()}
      exportDisabled
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
    </>
  )
}

export function SitemapManagerPanelLive() {
  const { data, isOffline, refetch } = useSeoOverview()
  const sitemaps = data?.sitemaps ?? []
  const liveSitemapUrl = getLiveSitemapUrl()

  return (
    <>
      {isOffline ? <ApiOfflineHint message="API offline — sitemap data unavailable." /> : null}
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
      createLabel="Open live XML"
      onCreate={() => window.open(liveSitemapUrl, '_blank', 'noopener,noreferrer')}
      onRefresh={() => void refetch()}
      exportDisabled
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
              <td className="font-mono text-xs font-black">
                <a
                  href={liveSitemapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#5E7CFF] hover:underline"
                >
                  {s.name}
                </a>
              </td>
              <td className="font-bold">{s.urls}</td>
              <td className="text-xs">{formatRelativeTime(s.lastGen)}</td>
              <td className="text-xs">{s.submitted}</td>
              <td>
                <span className={SEO_STATUS[asSeoStatus(s.status)]}>{s.status}</span>
              </td>
              <td>
                <AdminButton size="sm" disabled title={GSC_REQUIRED_TITLE}>
                  Ping GSC
                </AdminButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModulePanelShell>
    </>
  )
}

export function RedirectManagerPanelLive() {
  const { data: seoData, isOffline: seoOffline, refetch: refetchSeo } = useSeoOverview()
  const { data: managed = [], isLoading, isOffline: redirectsOffline, refetch: refetchRedirects } = useRedirects()
  const createRedirect = useCreateRedirect()
  const updateRedirect = useUpdateRedirect()
  const deleteRedirect = useDeleteRedirect()
  const canDeleteRedirects = usePermission('products', 'delete')
  const canCreateRedirects = usePermission('products', 'create')
  const canEditRedirects = usePermission('products', 'edit')
  const [query, setQuery] = useState('')

  const canonicalRedirects = useMemo(
    () => (seoData?.redirects ?? []).filter((r) => r.source === 'canonical'),
    [seoData?.redirects],
  )

  const ruleRows = useMemo(
    () =>
      managed.map((r) => ({
        id: r.id,
        from: r.fromPath,
        to: r.toPath,
        type: r.type,
        hits: r.hits,
        status: r.isActive ? 'good' : 'warning',
        source: 'rule' as const,
        note: r.note,
        isActive: r.isActive,
      })),
    [managed],
  )

  const allRows = useMemo(() => [...ruleRows, ...canonicalRedirects], [ruleRows, canonicalRedirects])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return allRows.filter((r) => !q || r.from.toLowerCase().includes(q) || r.to.toLowerCase().includes(q))
  }, [query, allRows])

  const activeRules = ruleRows.filter((r) => r.status === 'good').length
  const isOffline = seoOffline || redirectsOffline

  const refetchAll = () => {
    void refetchSeo()
    void refetchRedirects()
  }

  const handleCreate = () => {
    const fromPath = window.prompt('From path (old URL)', '/old-page')
    if (!fromPath?.trim()) return
    const toPath = window.prompt('To path (new URL)', '/shop')
    if (!toPath?.trim()) return
    const type = window.prompt('Redirect type (301 or 302)', '301')?.trim() || '301'
    createRedirect.mutate(
      { fromPath: fromPath.trim(), toPath: toPath.trim(), type, isActive: true },
      {
        onSuccess: () => toast.success('Redirect rule added'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const handleEdit = (row: (typeof allRows)[0]) => {
    if (row.source === 'canonical') {
      toast('Canonical redirects come from product SEO settings.', { icon: 'ℹ️' })
      return
    }
    const fromPath = window.prompt('From path', row.from)
    if (fromPath === null) return
    const toPath = window.prompt('To path', row.to)
    if (toPath === null) return
    const type = window.prompt('Type (301 or 302)', row.type)
    if (type === null) return
    updateRedirect.mutate(
      { id: row.id, fromPath: fromPath.trim(), toPath: toPath.trim(), type: type.trim() },
      {
        onSuccess: () => toast.success('Redirect updated'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const handleToggle = (row: (typeof allRows)[0]) => {
    if (row.source === 'canonical') return
    const next = row.status !== 'good'
    updateRedirect.mutate(
      { id: row.id, isActive: next },
      {
        onSuccess: () => toast.success(next ? 'Redirect is live' : 'Redirect disabled'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const handleDelete = (row: (typeof allRows)[0]) => {
    if (row.source === 'canonical') {
      toast('Remove canonical URL from product SEO settings.', { icon: 'ℹ️' })
      return
    }
    if (!window.confirm(`Delete redirect ${row.from} → ${row.to}?`)) return
    deleteRedirect.mutate(row.id, {
      onSuccess: () => toast.success('Redirect deleted'),
      onError: (e) => toast.error(e.message),
    })
  }

  const rowActions = (row: (typeof allRows)[0]) => {
    if (row.source === 'canonical') {
      return [
        { label: 'Open SEO health', onClick: () => { window.location.href = '/dashboard/seo-health' } },
        { label: 'Copy from URL', onClick: () => void navigator.clipboard.writeText(row.from).then(() => toast.success('Copied')) },
      ]
    }
    return [
      ...(canEditRedirects
        ? [
            { label: 'Edit redirect', onClick: () => handleEdit(row) },
            {
              label: row.status === 'good' ? 'Disable redirect' : 'Enable redirect',
              onClick: () => handleToggle(row),
            },
          ]
        : []),
      ...(canDeleteRedirects
        ? [{ label: 'Delete redirect', tone: 'danger' as const, onClick: () => handleDelete(row) }]
        : []),
    ]
  }

  return (
    <>
      {isOffline ? <ApiOfflineHint message="API offline — redirect rules unavailable until pnpm dev:api runs." /> : null}
    <ModulePanelShell
      kpis={[
        ['Redirects', isLoading ? '…' : allRows.length, 'default'],
        ['301 rules', allRows.filter((r) => r.type === '301').length, 'success'],
        ['Active', activeRules, 'gold'],
        ['API', 'Live', 'default'],
      ]}
      pipeline={[
        ['301', allRows.filter((r) => r.type === '301').length],
        ['302', allRows.filter((r) => r.type === '302').length],
        ['Managed', ruleRows.length],
        ['Canonical', canonicalRedirects.length],
        ['Live', 'OK'],
      ]}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search from/to URL..."
      createLabel="Add redirect"
      onCreate={handleCreate}
      createDisabled={!canCreateRedirects}
      disabledActionTitle={PERMISSION_DENIED_TITLE}
      onRefresh={refetchAll}
      onExport={() => {
        if (filtered.length === 0) {
          toast.error('No redirects to export')
          return
        }
        import('@/lib/api/redirects').then(({ exportRedirectsCsv }) => {
          exportRedirectsCsv(filtered)
          toast.success('Redirect list exported')
        })
      }}
      tableIcon={ArrowRightLeft}
      tableTitle={`Redirects · ${filtered.length}`}
      footer={`${ruleRows.length} managed rules · ${canonicalRedirects.length} from product SEO canonical URLs`}
    >
      {filtered.length === 0 ? (
        <div className="px-4 py-6">
          <p className="text-sm text-[#6B6B6B]">No redirect rules yet.</p>
          <p className="mt-2 text-xs text-[#6B6B6B]">
            Add a 301 when you rename a URL or fix a 404. Example: <span className="font-mono">/products</span> → <span className="font-mono">/shop</span>
          </p>
        </div>
      ) : (
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Type</th>
              <th>Hits</th>
              <th>Source</th>
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
                <td className="text-xs font-semibold">{r.source === 'canonical' ? 'SEO canonical' : 'Managed'}</td>
                <td>
                  <span className={SEO_STATUS[asSeoStatus(r.status)]}>{r.status === 'good' ? 'active' : 'disabled'}</span>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    {r.source === 'rule' ? (
                      <AdminButton size="sm" onClick={() => handleEdit(r)}>
                        Edit
                      </AdminButton>
                    ) : null}
                    <RowActionsMenu
                      recordName={r.from}
                      moduleHref="/dashboard/redirect-manager"
                      recordId={r.id}
                      actions={rowActions(r)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModulePanelShell>
    </>
  )
}
