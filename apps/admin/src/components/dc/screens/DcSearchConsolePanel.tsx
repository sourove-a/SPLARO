'use client'

import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import { ApiError } from '@/lib/api/client'
import { fetchGoogleOAuthUrl } from '@/lib/api/google-workspace'
import {
  useGscInsights,
  useGscInspect,
  useGscPages,
  useGscPerformance,
  useGscQueries,
  useGscRefresh,
  useGscSitemaps,
  useGscStatus,
} from '@/lib/api/hooks'
import type { GscRange, GscStatus } from '@/lib/api/search-console'

export type SeoGscTab = 'console' | 'sitemaps' | 'indexing'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.085em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const RANGES: GscRange[] = ['7d', '28d', '90d']
const DEFAULT_INSPECT_URL = 'https://splaro.co/'
const SKELETON: DcBlock[] = [{ t: 'kpis' } as DcBlock, { t: 'table', w: 'main' } as DcBlock]

export function DcSearchConsolePanel({ tab }: { tab: SeoGscTab }) {
  const [range, setRange] = useState<GscRange>('28d')
  const status = useGscStatus(true)
  const connected = Boolean(status.data?.connected)

  if (status.isLoading) return <DcLoadingState blocks={SKELETON} />
  if (status.isError) {
    return (
      <DcErrorState
        error={status.error instanceof Error ? status.error.message : 'GET /admin/google/search-console/status failed'}
        hint="Search Console numbers were not invented. Restore API or reconnect Google Workspace."
        onRetry={() => void status.refetch()}
      />
    )
  }

  const gsc = status.data
  if (!gsc || !connected) {
    return <DisconnectedStrip status={gsc ?? null} onRefetch={() => void status.refetch()} />
  }

  if (tab === 'sitemaps') return <SitemapsPanel status={gsc} />
  if (tab === 'indexing') return <IndexingPanel status={gsc} />
  return <PerformancePanel status={gsc} range={range} onRange={setRange} />
}

function PerformancePanel({
  status,
  range,
  onRange,
}: {
  status: GscStatus
  range: GscRange
  onRange: (range: GscRange) => void
}) {
  const performance = useGscPerformance(range, true)
  const queries = useGscQueries(range, 'clicks', true)
  const pages = useGscPages(range, 'clicks', true)
  const insights = useGscInsights(range, true)
  const refresh = useGscRefresh()
  const errored = [performance, queries, pages, insights].find((q) => q.isError)

  const runRefresh = async () => {
    try {
      await refresh.mutateAsync()
      toastOk('Search Console cache refreshed')
    } catch (error) {
      toastFail(errorMessage(error, 'Could not refresh Search Console'))
    }
  }

  if (performance.isLoading && !performance.data) return <DcLoadingState blocks={SKELETON} />
  if (errored) {
    return (
      <DcErrorState
        error={errorMessage(errored.error, 'Search Console request failed')}
        hint="Google ranking data was not faked. Retry after quota/reconnect, or wait for GSC lag (~2 days)."
        onRetry={() => {
          void performance.refetch()
          void queries.refetch()
          void pages.refetch()
          void insights.refetch()
        }}
      />
    )
  }

  const totals = performance.data?.totals
  const delta = performance.data?.delta
  const emptyRange = Boolean(totals && totals.clicks === 0 && totals.impressions === 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ConnectionStrip status={status} onRefresh={() => void runRefresh()} refreshing={refresh.isPending} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {RANGES.map((id) => (
          <button key={id} type="button" onClick={() => onRange(id)} style={pill(id === range)}>
            {id}
          </button>
        ))}
        <span style={{ font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
          {performance.data
            ? `${performance.data.startDate} → ${performance.data.endDate} · Asia/Dhaka · GSC ~2-day lag`
            : 'Search Console traffic counts, not BDT.'}
        </span>
      </div>
      {totals ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
            gap: 10,
          }}
        >
          <Kpi label="Clicks" value={fmtInt(totals.clicks)} sub={fmtDelta(delta?.clicks, 'int')} tone="ok" />
          <Kpi label="Impressions" value={fmtInt(totals.impressions)} sub={fmtDelta(delta?.impressions, 'int')} tone="info" />
          <Kpi label="CTR" value={fmtPct(totals.ctr)} sub={fmtDelta(delta?.ctr, 'pct')} tone="warn" />
          <Kpi label="Avg position" value={fmtPos(totals.position)} sub={fmtDelta(delta?.position, 'pos')} tone="mute" />
        </div>
      ) : null}
      {emptyRange ? (
        <section style={{ ...card, padding: '14px 16px', font: `500 12px/1.45 ${FONT}`, color: 'var(--ink-2)' }}>
          No Search Console rows for this window. Google often lags ~2 days; an empty range is not invented traffic.
        </section>
      ) : (
        <TrendCard rows={performance.data?.trend ?? []} />
      )}
      <InsightChips items={insights.data?.insights ?? []} loading={insights.isFetching && !insights.data} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <MetricTable
          title="Top queries"
          empty="No queries in this range."
          rows={(queries.data?.rows ?? []).map((row) => [row.key, fmtInt(row.clicks), fmtInt(row.impressions), fmtPct(row.ctr), fmtPos(row.position)])}
          columns={['Query', 'Clicks', 'Impressions', 'CTR', 'Pos']}
        />
        <MetricTable
          title="Top pages"
          empty="No pages in this range."
          rows={(pages.data?.rows ?? []).map((row) => [
            row.name ? `${row.name}\n${row.page}` : row.page,
            fmtInt(row.clicks),
            fmtInt(row.impressions),
            fmtPct(row.ctr),
            fmtPos(row.position),
          ])}
          columns={['Page', 'Clicks', 'Impressions', 'CTR', 'Pos']}
        />
      </div>
    </div>
  )
}

function SitemapsPanel({ status }: { status: GscStatus }) {
  const sitemaps = useGscSitemaps(true)
  if (sitemaps.isLoading) return <DcLoadingState blocks={SKELETON} />
  if (sitemaps.isError) {
    return (
      <DcErrorState
        error={errorMessage(sitemaps.error, 'Search Console sitemaps failed')}
        hint="Storefront sitemap.xml was not changed. Retry after reconnect/quota."
        onRetry={() => void sitemaps.refetch()}
      />
    )
  }
  const data = sitemaps.data
  const googleByPath = new Map((data?.google ?? []).map((row) => [(row.path ?? '').replace(/\/+$/, ''), row]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ConnectionStrip status={status} />
      <section style={{ ...card, overflow: 'hidden' }}>
        <div style={{ minHeight: 50, padding: '0 14px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
          <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>Storefront sitemaps</span>
        </div>
        <div style={{ padding: '4px 14px' }}>
          {(data?.known ?? []).map((url, index) => {
            const google = googleByPath.get(url.replace(/\/+$/, '')) ?? data?.google.find((row) => (row.path ?? '').includes(url.split('/').pop() ?? ''))
            const ok = Boolean(google) && (google?.errors ?? 0) === 0
            const tone = toneStyle(ok ? 'ok' : 'warn')
            return (
              <div
                key={url}
                style={{
                  minHeight: 72,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderBottom: index === (data?.known.length ?? 0) - 1 ? 0 : '1px solid var(--line)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong style={{ font: `600 12px/1.2 ${FONT}`, color: 'var(--ink)' }}>{url}</strong>
                  <span style={{ font: `400 11px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
                    {google
                      ? `Last downloaded ${fmtWhen(google.lastDownloaded)} · warnings ${google.warnings} · errors ${google.errors}`
                      : 'Not seen in Search Console yet'}
                  </span>
                </span>
                <span style={{ font: `600 9.5px/1 ${MONO}`, color: tone.fg }}>{ok ? 'IN GSC' : 'MISSING'}</span>
              </div>
            )
          })}
        </div>
      </section>
      <section style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-2)', maxWidth: 640 }}>
          {data?.submitMessage ??
            'Sitemap submit is not available on the read-only Search Console scope. Submit once in Google Search Console, or reconnect later with write access.'}
        </span>
        <button type="button" disabled style={{ ...smallButton(false), opacity: 0.55, cursor: 'not-allowed' }}>
          Submit sitemap (V2)
        </button>
      </section>
    </div>
  )
}

function IndexingPanel({ status }: { status: GscStatus }) {
  const inspect = useGscInspect()
  const [url, setUrl] = useState(DEFAULT_INSPECT_URL)
  const result = inspect.data

  const runInspect = async () => {
    const next = url.trim()
    if (!isAllowedInspectUrl(next)) {
      toastFail('Only https://splaro.co URLs can be inspected.')
      return
    }
    try {
      await inspect.mutateAsync(next)
      toastOk('URL inspection returned from Google')
    } catch (error) {
      toastFail(errorMessage(error, 'URL inspection failed'))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ConnectionStrip status={status} />
      <section style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={capsLabel}>URL Inspection</span>
        <strong style={{ font: `700 16px/1.2 ${FONT}`, color: 'var(--ink)' }}>Ask Google how it sees a SPLARO URL</strong>
        <span style={{ font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          Read-only coverage, last crawl, canonicals, and robots. This is not the Indexing API and cannot force index.
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={DEFAULT_INSPECT_URL}
            name="gsc-inspect-url"
            autoComplete="off"
            style={{
              flex: '1 1 360px',
              height: 38,
              padding: '0 12px',
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `400 12.5px/1 ${MONO}`,
            }}
          />
          <button type="button" disabled={inspect.isPending} onClick={() => void runInspect()} style={smallButton(inspect.isPending)}>
            {inspect.isPending ? 'Inspecting…' : 'Inspect URL'}
          </button>
        </div>
      </section>
      {result ? (
        <section style={{ ...card, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <InspectField label="Coverage" value={result.coverageState} />
          <InspectField label="Indexing state" value={result.indexingState} />
          <InspectField label="Last crawl" value={fmtWhen(result.lastCrawlTime)} />
          <InspectField label="Crawled as" value={result.crawledAs} />
          <InspectField label="Google canonical" value={result.googleCanonical} />
          <InspectField label="User canonical" value={result.userCanonical} />
          <InspectField label="robots.txt" value={result.robotsTxtState} />
          <InspectField label="Page fetch" value={result.pageFetchState} />
        </section>
      ) : null}
    </div>
  )
}

function ConnectionStrip({
  status,
  onRefresh,
  refreshing,
}: {
  status: GscStatus
  onRefresh?: () => void
  refreshing?: boolean
}) {
  const tone = toneStyle(status.connected ? 'ok' : status.needsReconnect ? 'warn' : 'bad')
  return (
    <section
      style={{
        ...card,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        borderColor: tone.bd,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 99, background: tone.fg }} />
      <span style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong style={{ font: `600 12.5px/1.2 ${FONT}`, color: 'var(--ink)' }}>
          {status.connected ? `Search Console · ${status.property}` : status.needsReconnect ? 'Reconnect required' : 'Search Console disconnected'}
        </strong>
        <span style={{ font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
          {[status.googleEmail, status.permission, status.lastSuccessAt ? `last success ${fmtWhen(status.lastSuccessAt)}` : null]
            .filter(Boolean)
            .join(' · ') || status.message}
        </span>
      </span>
      {onRefresh ? (
        <button type="button" disabled={refreshing} onClick={onRefresh} style={smallButton(Boolean(refreshing))}>
          {refreshing ? 'Refreshing…' : 'Refresh cache'}
        </button>
      ) : null}
    </section>
  )
}

function DisconnectedStrip({ status, onRefetch }: { status: GscStatus | null; onRefetch: () => void }) {
  const [busy, setBusy] = useState(false)
  const needsReconnect = Boolean(status?.needsReconnect)
  const connect = async () => {
    setBusy(true)
    try {
      const data = await fetchGoogleOAuthUrl()
      if (!data?.url) {
        toastFail('No Google OAuth URL returned')
        return
      }
      window.location.href = data.url
    } catch (error) {
      toastFail(errorMessage(error, 'Could not start Google Workspace connect'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={capsLabel}>{needsReconnect ? 'Needs reconnect' : 'Not connected'}</span>
      <strong style={{ font: `700 18px/1.2 ${FONT}`, color: 'var(--ink)' }}>
        {needsReconnect ? 'Grant read-only Search Console access' : 'Connect Google Workspace for Search Console'}
      </strong>
      <span style={{ font: `400 12.5px/1.5 ${FONT}`, color: 'var(--ink-2)', maxWidth: 640 }}>
        {status?.message ??
          'Google ranking and crawl data stay empty until Workspace OAuth includes webmasters.readonly and a splaro.co property.'}
        {' '}
        Rankings are never invented. SEO daily brief still uses onsite search until this connects.
        Reuses the existing Google Workspace client — no second OAuth app. Hint account: splaro.bd@gmail.com.
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy} onClick={() => void connect()} style={{ ...smallButton(busy), background: 'var(--ink)', color: 'var(--surface)', borderColor: 'var(--ink)' }}>
          {busy ? 'Opening Google…' : needsReconnect ? 'Reconnect Google Workspace' : 'Connect Google Workspace'}
        </button>
        <button type="button" onClick={onRefetch} style={smallButton(false)}>
          Recheck status
        </button>
      </div>
    </section>
  )
}

function TrendCard({ rows }: { rows: Array<{ date: string; clicks: number; impressions: number }> }) {
  const data = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        label: row.date.slice(5),
      })),
    [rows],
  )
  if (data.length === 0) return null
  return (
    <section style={{ ...card, padding: '12px 12px 8px', minHeight: 240 }}>
      <div style={{ padding: '4px 8px 10px', ...capsLabel }}>Daily trend</div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--ink-3)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--ink-3)' }} width={42} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, font: `400 12px/1.4 ${FONT}` }}
            />
            <Area type="monotone" dataKey="impressions" name="Impressions" stroke="var(--ink-3)" fill="var(--surface-3)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="clicks" name="Clicks" stroke="var(--ink)" fill="var(--ok-soft)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function InsightChips({ items, loading }: { items: Array<{ kind: string; label: string; detail: string }>; loading: boolean }) {
  if (loading && items.length === 0) return null
  if (items.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map((item) => (
        <span
          key={`${item.kind}-${item.detail}`}
          title={item.detail}
          style={{
            maxWidth: 360,
            padding: '8px 10px',
            border: '1px solid var(--line)',
            borderRadius: 10,
            background: 'var(--surface-2)',
            font: `500 11px/1.35 ${FONT}`,
            color: 'var(--ink-2)',
          }}
        >
          {item.label}: {item.detail}
        </span>
      ))}
    </div>
  )
}

function MetricTable({
  title,
  columns,
  rows,
  empty,
}: {
  title: string
  columns: string[]
  rows: string[][]
  empty: string
}) {
  return (
    <section style={{ ...card, flex: '1 1 420px', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ minHeight: 48, padding: '0 14px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
        <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>{title}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '36px 16px', textAlign: 'center', font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>{empty}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {columns.map((label) => (
                  <th key={label} style={{ padding: '9px 12px', textAlign: 'left', ...capsLabel }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--line)',
                        font: cellIndex === 0 ? `500 11.5px/1.35 ${FONT}` : `500 11px/1.3 ${MONO}`,
                        color: 'var(--ink)',
                        whiteSpace: cellIndex === 0 ? 'pre-wrap' : 'nowrap',
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: DcTone }) {
  const colors = toneStyle(tone)
  return (
    <div style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={capsLabel}>{label}</span>
      <strong style={{ font: `700 22px/1 ${FONT}`, color: 'var(--ink)' }}>{value}</strong>
      <span style={{ font: `400 10.5px/1.2 ${FONT}`, color: colors.fg }}>{sub}</span>
    </div>
  )
}

function InspectField({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface-2)' }}>
      <div style={capsLabel}>{label}</div>
      <div style={{ marginTop: 6, font: `500 12px/1.35 ${FONT}`, color: 'var(--ink)', wordBreak: 'break-all' }}>{value || '—'}</div>
    </div>
  )
}

function pill(on: boolean) {
  return {
    border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
    borderRadius: 999,
    padding: '6px 12px',
    background: on ? 'var(--ink)' : 'transparent',
    color: on ? 'var(--surface)' : 'var(--ink-2)',
    font: `600 11.5px/1 ${FONT}`,
    cursor: 'pointer',
  } as const
}

function smallButton(busy: boolean) {
  return {
    height: 34,
    padding: '0 12px',
    border: '1px solid var(--line-2)',
    borderRadius: 8,
    background: 'var(--surface-2)',
    color: 'var(--ink-2)',
    cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.7 : 1,
    font: `600 11px/1 ${FONT}`,
  } as const
}

function isAllowedInspectUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim())
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    return host === 'splaro.co' || host === 'www.splaro.co'
  } catch {
    return false
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function fmtInt(value: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function fmtPct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function fmtPos(value: number) {
  return value > 0 ? value.toFixed(1) : '—'
}

function fmtDelta(value: number | undefined, kind: 'int' | 'pct' | 'pos') {
  if (value == null || !Number.isFinite(value) || value === 0) return 'vs previous · 0'
  const sign = value > 0 ? '+' : ''
  const shown =
    kind === 'pct' ? `${sign}${(value * 100).toFixed(1)}pp` : kind === 'pos' ? `${sign}${value.toFixed(1)}` : `${sign}${fmtInt(value)}`
  return `vs previous · ${shown}`
}

function fmtWhen(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' })
}
