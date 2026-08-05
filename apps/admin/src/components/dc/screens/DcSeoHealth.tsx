'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import { useAuditProductSeo, useFixMissingProductSeo, useSeoOverview } from '@/lib/api/hooks'
import type { SeoOverview } from '@/lib/api/admin-hub'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

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

type ProductAudit = SeoOverview['productAudits'][number]

function scoreTone(score: number): DcTone {
  if (score >= 80) return 'ok'
  if (score >= 60) return 'warn'
  return 'bad'
}

function primaryIssue(row: ProductAudit) {
  if (!row.hasMetaTitle) return 'Missing meta title'
  if (!row.hasMetaDescription) return 'Missing meta description'
  if (row.score < 60) return 'Critical SEO score'
  if (row.score < 80) return 'SEO score needs work'
  return 'Ready for search'
}

export function DcSeoHealth() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="seo" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcSeoHealthBody />
    </DcScreenProvider>
  )
}

function DcSeoHealthBody() {
  const seo = useSeoOverview()
  const auditProduct = useAuditProductSeo()
  const fixMissing = useFixMissingProductSeo()
  const { api } = useAdminConnection(25_000)
  const [query, setQuery] = useState('')
  const [auditingId, setAuditingId] = useState<string | null>(null)

  const data = seo.data
  const audits = data.productAudits
  const needsMeta = audits.filter((row) => !row.hasMetaTitle || !row.hasMetaDescription).length
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return audits
    return audits.filter((row) =>
      `${row.name} ${row.slug} ${primaryIssue(row)}`.toLowerCase().includes(needle),
    )
  }, [audits, query])
  const pageStatus = dcPageStatus([seo], api.pulse)

  const refresh = () => {
    void seo.refetch()
  }

  const runAudit = async (row: ProductAudit) => {
    setAuditingId(row.id)
    try {
      const result = await auditProduct.mutateAsync(row.id)
      toastOk(`${row.name}: SEO audit ${result.score}/100`)
      await seo.refetch()
    } catch (error) {
      toastFail(error instanceof Error ? error.message : 'Product SEO audit failed')
    } finally {
      setAuditingId(null)
    }
  }

  const runFixMissing = async () => {
    if (needsMeta === 0) return
    try {
      const result = await fixMissing.mutateAsync()
      toastOk(
        result.updated > 0
          ? `${result.updated} product meta fixed · score ${result.avgScoreAfter}/100`
          : 'Server confirmed no missing product meta',
      )
      await seo.refetch()
    } catch (error) {
      toastFail(error instanceof Error ? error.message : 'Could not fix missing product meta')
    }
  }

  const skeleton: DcBlock[] = [
    { t: 'hero' } as DcBlock,
    { t: 'table', w: 'main' } as DcBlock,
    { t: 'list', w: 'side' } as DcBlock,
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Intelligence"
        title="SEO Health"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          seo.isFetching
            ? 'reading catalog…'
            : `${audits.length} product${audits.length === 1 ? '' : 's'} checked`
        }
        syncing={seo.isFetching}
        onSync={refresh}
        actions={
          needsMeta > 0 && !seo.isOffline
            ? [
                {
                  label: fixMissing.isPending ? 'Fixing…' : `Fix missing meta · ${needsMeta}`,
                  icon: 'icon-sparkles',
                  variant: 'primary',
                  onClick: () => void runFixMissing(),
                },
              ]
            : []
        }
      />

      {seo.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : seo.isOffline ? (
        <DcErrorState
          error="GET /admin/hub/seo/overview → API offline"
          hint="Catalog SEO data was not changed. Restore API connection, then retry."
          onRetry={refresh}
        />
      ) : (
        <>
          <ScoreOverview data={data} needsMeta={needsMeta} />
          {!data.searchConsole.connected ? (
            <section
              style={{
                ...card,
                marginTop: 12,
                padding: '12px 14px',
                borderColor: 'var(--warn-bd)',
                background: 'var(--warn-soft)',
                color: 'var(--warn)',
                font: `500 11.5px/1.45 ${FONT}`,
              }}
            >
              <strong>Search Console disconnected.</strong> {data.searchConsole.message} Daily targets use
              catalog metadata and onsite searches only; no product is changed automatically.
            </section>
          ) : null}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 16,
              minWidth: 0,
            }}
          >
            <IssueTable
              rows={filtered}
              total={audits.length}
              query={query}
              auditingId={auditingId}
              onQuery={setQuery}
              onAudit={runAudit}
            />
            <TechnicalChecks data={data} />
          </div>
        </>
      )}
    </>
  )
}

function ScoreOverview({ data, needsMeta }: { data: SeoOverview; needsMeta: number }) {
  const score = data.summary.avgScore
  const tone = toneStyle(scoreTone(score))
  const indexReady = data.indexPages.filter((row) => row.status === 'good').length
  const schemaErrors = data.schemas.reduce((sum, row) => sum + row.errors, 0)

  return (
    <section
      style={{
        ...card,
        padding: 16,
        display: 'flex',
        alignItems: 'stretch',
        flexWrap: 'wrap',
        gap: 14,
      }}
    >
      <div
        style={{
          flex: '1 1 300px',
          minHeight: 120,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '5px 4px',
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 99,
            background: `conic-gradient(${tone.fg} ${Math.max(0, Math.min(100, score))}%, var(--surface-3) 0)`,
          }}
        >
          <span
            style={{
              width: 72,
              height: 72,
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--line)',
              borderRadius: 99,
              background: 'var(--surface)',
              font: `700 22px/1 ${FONT}`,
              color: tone.fg,
            }}
          >
            {score}
          </span>
        </div>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={capsLabel}>SEO score</span>
          <strong style={{ font: `700 20px/1.1 ${FONT}`, color: 'var(--ink)' }}>
            {score >= 80 ? 'Search ready' : score >= 60 ? 'Needs focused work' : 'Critical fixes needed'}
          </strong>
          <span style={{ font: `400 11.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
            Live product metadata, schema, sitemap, and index readiness.
          </span>
        </span>
      </div>
      <div
        style={{
          flex: '2 1 570px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
          gap: 10,
        }}
      >
        <Metric label="Products checked" value={String(data.summary.products)} sub="published catalog" tone="info" />
        <Metric label="Index ready" value={`${indexReady}/${data.indexPages.length}`} sub="metadata complete" tone="ok" />
        <Metric label="Missing meta" value={String(needsMeta)} sub="server-fixable" tone={needsMeta ? 'warn' : 'ok'} />
        <Metric label="Schema errors" value={String(schemaErrors)} sub="structured data" tone={schemaErrors ? 'bad' : 'ok'} />
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: DcTone
}) {
  const colors = toneStyle(tone)
  return (
    <div
      style={{
        padding: '13px 14px',
        border: '1px solid var(--line)',
        borderRadius: 11,
        background: 'var(--surface-2)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 7,
      }}
    >
      <span style={capsLabel}>{label}</span>
      <strong style={{ font: `700 22px/1 ${FONT}`, color: 'var(--ink)' }}>{value}</strong>
      <span style={{ font: `400 10.5px/1.2 ${FONT}`, color: colors.fg }}>{sub}</span>
    </div>
  )
}

function IssueTable({
  rows,
  total,
  query,
  auditingId,
  onQuery,
  onAudit,
}: {
  rows: ProductAudit[]
  total: number
  query: string
  auditingId: string | null
  onQuery: (value: string) => void
  onAudit: (row: ProductAudit) => Promise<void>
}) {
  return (
    <section style={{ ...card, flex: '2 1 650px', minWidth: 0, overflow: 'hidden' }}>
      <div
        style={{
          minHeight: 50,
          padding: '9px 13px 9px 15px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span style={{ flex: 1, minWidth: 150, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
          Page issues
          <span style={{ marginLeft: 8, font: `500 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>{total}</span>
        </span>
        <label
          style={{
            width: 'min(250px, 100%)',
            height: 32,
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid var(--line)',
            borderRadius: 8,
            background: 'var(--surface-2)',
          }}
        >
          <DcIcon name="icon-search" size={13} color="var(--ink-3)" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search page or issue…"
            type="search"
            name="dc-seo-filter"
            className="dc-nav-filter"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            style={{
              width: '100%',
              border: 0,
              outline: 0,
              background: 'transparent',
              color: 'var(--ink)',
              font: `400 11.5px/1 ${FONT}`,
            }}
          />
        </label>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '42px 18px', textAlign: 'center', font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
          {total === 0 ? 'No published products available for SEO audit.' : 'No pages match this search.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Page', 'Meta title', 'Meta description', 'Issue', 'Score', ''].map((label) => (
                  <th key={label} style={{ padding: '9px 13px', textAlign: 'left', ...capsLabel }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 30).map((row) => {
                const tone = scoreTone(row.score)
                return (
                  <tr key={row.id}>
                    <td style={cellStyle}>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <strong style={{ font: `600 11.5px/1.2 ${FONT}`, color: 'var(--ink)' }}>{row.name}</strong>
                        <span style={{ font: `400 10px/1.2 ${MONO}`, color: 'var(--ink-3)' }}>/products/{row.slug}</span>
                      </span>
                    </td>
                    <td style={cellStyle}><StatusDot ok={row.hasMetaTitle} /></td>
                    <td style={cellStyle}><StatusDot ok={row.hasMetaDescription} /></td>
                    <td style={cellStyle}>
                      <span style={{ font: `500 11px/1.3 ${FONT}`, color: 'var(--ink-2)' }}>{primaryIssue(row)}</span>
                    </td>
                    <td style={cellStyle}><Badge label={`${row.score}/100`} tone={tone} /></td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      <button
                        type="button"
                        disabled={auditingId !== null}
                        onClick={() => void onAudit(row)}
                        style={smallButton(auditingId === row.id)}
                      >
                        {auditingId === row.id ? 'Auditing…' : 'Audit'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const cellStyle = {
  padding: '11px 13px',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'middle' as const,
}

function TechnicalChecks({ data }: { data: SeoOverview }) {
  const schemaPages = data.schemas.reduce((sum, row) => sum + row.pages, 0)
  const schemaErrors = data.schemas.reduce((sum, row) => sum + row.errors, 0)
  const checks = [
    {
      icon: 'icon-file-code',
      label: 'sitemap.xml',
      sub: `${data.sitemaps.reduce((sum, row) => sum + row.urls, 0)} URLs across ${data.sitemaps.length} sitemap`,
      value: data.sitemaps.length ? 'READY' : 'EMPTY',
      ok: data.sitemaps.length > 0,
    },
    {
      icon: 'icon-braces',
      label: 'Product schema',
      sub: `${schemaPages} pages · ${schemaErrors} errors`,
      value: schemaErrors ? 'FIX' : 'OK',
      ok: schemaErrors === 0,
    },
    {
      icon: 'icon-globe',
      label: 'Metadata readiness',
      sub: `${data.indexPages.length} catalog URLs checked locally`,
      value: data.indexPages.length ? 'READY' : 'EMPTY',
      ok: data.indexPages.length > 0,
    },
    {
      icon: 'icon-arrow-right-left',
      label: 'Redirect coverage',
      sub: `${data.redirects.length} redirect rules`,
      value: data.redirects.length ? 'ACTIVE' : 'NONE',
      ok: data.redirects.length > 0,
    },
    {
      icon: 'icon-search',
      label: 'Search signals',
      sub: `${data.keywords.length} storefront queries tracked`,
      value: data.keywords.length ? 'LIVE' : 'WAITING',
      ok: data.keywords.length > 0,
    },
    {
      icon: 'icon-globe',
      label: 'Google ranking',
      sub: data.searchConsole.message,
      value: data.searchConsole.connected ? 'CONNECTED' : 'DISCONNECTED',
      ok: data.searchConsole.connected,
    },
  ]

  return (
    <section style={{ ...card, flex: '1 1 290px', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ minHeight: 50, padding: '0 14px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
        <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>Technical checks</span>
      </div>
      <div style={{ padding: '4px 14px' }}>
        {checks.map((check, index) => {
          const colors = toneStyle(check.ok ? 'ok' : 'warn')
          return (
            <div
              key={check.label}
              style={{
                minHeight: 67,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderBottom: index === checks.length - 1 ? 0 : '1px solid var(--line)',
              }}
            >
              <span
                style={{
                  width: 29,
                  height: 29,
                  display: 'grid',
                  placeItems: 'center',
                  border: `1px solid ${colors.bd}`,
                  borderRadius: 8,
                  background: colors.bg,
                  color: colors.fg,
                }}
              >
                <DcIcon name={check.icon} size={14} />
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ font: `600 11.5px/1.2 ${FONT}`, color: 'var(--ink)' }}>{check.label}</strong>
                <span style={{ font: `400 10.5px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>{check.sub}</span>
              </span>
              <span style={{ font: `600 9.5px/1 ${MONO}`, color: colors.fg }}>{check.value}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `500 10.5px/1 ${FONT}`, color: ok ? 'var(--ok)' : 'var(--bad)' }}>
      <DcIcon name={ok ? 'icon-circle-check' : 'icon-circle-x'} size={13} />
      {ok ? 'Ready' : 'Missing'}
    </span>
  )
}

function Badge({ label, tone }: { label: string; tone: DcTone }) {
  const colors = toneStyle(tone)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        border: `1px solid ${colors.bd}`,
        borderRadius: 6,
        background: colors.bg,
        color: colors.fg,
        font: `600 10px/1 ${MONO}`,
      }}
    >
      {label}
    </span>
  )
}

function smallButton(busy: boolean) {
  return {
    height: 30,
    padding: '0 10px',
    border: '1px solid var(--line-2)',
    borderRadius: 8,
    background: 'var(--surface-2)',
    color: 'var(--ink-2)',
    cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.7 : 1,
    font: `600 10.5px/1 ${FONT}`,
  } as const
}
