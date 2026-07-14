'use client'

import { useState } from 'react'
import { refreshWithToast, toastFail, toastOk } from '@/lib/admin/feedback'
import { AlertCircle, CheckCircle, Search, Sparkles, XCircle } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { ApiOfflineHint } from '@/components/modules/PlatformUi'
import { cn } from '@/lib/utils/cn'
import { useAuditProductSeo, useFixMissingProductSeo, useSeoOverview } from '@/lib/api/hooks'

function MetaStatus({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        ok
          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
          : 'bg-red-500/12 text-red-700 dark:text-red-300',
      )}
    >
      {ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  )
}

export function SeoHealthPanel() {
  const { data, isOffline, isLoading, refetch } = useSeoOverview()
  const auditProduct = useAuditProductSeo()
  const fixMissingMeta = useFixMissingProductSeo()
  const [tab, setTab] = useState<'products' | 'technical' | 'analytics'>('products')
  const [auditingId, setAuditingId] = useState<string | null>(null)

  const audits = data?.productAudits ?? []
  const summary = data?.summary
  const avgScore = summary?.avgScore ?? 0
  const keywords = data?.keywords ?? []
  const needsMeta = audits.filter((audit) => !audit.hasMetaTitle || !audit.hasMetaDescription).length

  const runProductAudit = async (productId: string, name: string) => {
    if (isOffline) return
    setAuditingId(productId)
    try {
      const result = await auditProduct.mutateAsync(productId)
      toastOk(`${name}: SEO score ${result.score}/100`)
      void refetch()
    } catch (error) {
      toastFail(error instanceof Error ? error.message : 'Product audit failed')
    } finally {
      setAuditingId(null)
    }
  }

  const runFixMissingMeta = async () => {
    if (isOffline || needsMeta === 0) return
    try {
      const result = await fixMissingMeta.mutateAsync()
      if (result.updated === 0) {
        toastOk('All published products already have meta title and description.')
      } else {
        toastOk(
          `SEO fixed for ${result.updated} product${result.updated === 1 ? '' : 's'} — avg score now ${result.avgScoreAfter}/100.`,
        )
      }
      void refetch()
    } catch (error) {
      toastFail(error instanceof Error ? error.message : 'Could not fill missing product meta')
    }
  }

  return (
    <div className="space-y-5">
      {isOffline ? <ApiOfflineHint message="API offline — SEO data unavailable until pnpm dev:api is running." /> : null}

      {needsMeta > 0 && !isOffline ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-amber-500/25 bg-amber-500/8 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-bold text-[var(--admin-text)]">
                {needsMeta} product{needsMeta === 1 ? '' : 's'} missing meta title or description
              </p>
              <p className="mt-0.5 text-xs font-medium text-[var(--admin-text-secondary)]">
                Auto-fill from product names and descriptions, then re-audit each item.
              </p>
            </div>
          </div>
          <AdminButton
            variant="gold"
            disabled={fixMissingMeta.isPending}
            onClick={() => void runFixMissingMeta()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {fixMissingMeta.isPending ? 'Fixing…' : `Fix missing meta (${needsMeta})`}
          </AdminButton>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <div className="admin-glass admin-kpi">
          <p className="admin-kpi__label">Avg SEO Score</p>
          <p
            className={cn(
              'admin-kpi__value mt-1 text-3xl',
              avgScore >= 80 ? 'text-emerald-600' : avgScore >= 60 ? 'text-amber-600' : 'text-red-500',
            )}
          >
            {isLoading ? '…' : avgScore}
          </p>
        </div>
        <div className="admin-glass admin-kpi">
          <p className="admin-kpi__label">Critical errors</p>
          <p className="admin-kpi__value mt-1 text-3xl text-red-500">{isLoading ? '…' : (summary?.criticalErrors ?? 0)}</p>
        </div>
        <div className="admin-glass admin-kpi">
          <p className="admin-kpi__label">Warnings</p>
          <p className="admin-kpi__value mt-1 text-3xl text-amber-600">{isLoading ? '…' : (summary?.warnings ?? 0)}</p>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-[18px] border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-surface)] p-1">
        {(['products', 'technical', 'analytics'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              'rounded-[14px] px-4 py-2 text-xs font-bold capitalize transition-colors',
              tab === item
                ? 'bg-[var(--admin-accent-muted)] text-[var(--admin-text)]'
                : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-secondary)]',
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'products' ? (
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-[var(--admin-text-secondary)]">Loading product audits…</p>
          ) : audits.length === 0 ? (
            <p className="text-sm text-[var(--admin-text-secondary)]">No published products to audit yet.</p>
          ) : (
            audits.slice(0, 20).map((audit) => (
              <div key={audit.id} className="admin-module-card !p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-[var(--admin-text)]">{audit.name}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-black',
                        audit.score >= 80 ? 'text-emerald-600' : audit.score >= 60 ? 'text-amber-600' : 'text-red-500',
                      )}
                    >
                      {audit.score}/100
                    </span>
                    <AdminButton
                      size="sm"
                      disabled={isOffline || auditingId === audit.id}
                      onClick={() => void runProductAudit(audit.id, audit.name)}
                    >
                      {auditingId === audit.id ? 'Auditing…' : 'Audit'}
                    </AdminButton>
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--admin-accent-muted)]">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all',
                      audit.score >= 80 ? 'bg-emerald-500' : audit.score >= 60 ? 'bg-amber-500' : 'bg-red-500',
                    )}
                    style={{ width: `${audit.score}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <MetaStatus label="Meta title" ok={audit.hasMetaTitle} />
                  <MetaStatus label="Meta description" ok={audit.hasMetaDescription} />
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === 'technical' ? (
        <div className="space-y-2">
          {(
            [
              ['Sitemap', (data?.sitemaps.length ?? 0) > 0 ? 'Valid' : 'Empty', CheckCircle],
              ['Product schema', summary && summary.criticalErrors === 0 ? 'Valid' : `${summary?.criticalErrors ?? 0} issues`, summary && summary.criticalErrors === 0 ? CheckCircle : AlertCircle],
              ['Index coverage', `${data?.indexPages.length ?? 0} URLs`, CheckCircle],
              ['Redirects', `${data?.redirects.length ?? 0} rules`, data?.redirects.length ? CheckCircle : XCircle],
            ] as const
          ).map(([label, status, Icon]) => (
            <div
              key={label}
              className="admin-module-card flex items-center justify-between !py-3"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[var(--admin-accent)]" />
                <span className="text-sm font-semibold text-[var(--admin-text)]">{label}</span>
              </div>
              <span className="text-xs font-bold text-[var(--admin-text-secondary)]">{status}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'analytics' ? (
        <div className="admin-module-card">
          <div className="admin-search mb-4">
            <Search className="h-4 w-4 text-[var(--admin-text-muted)]" />
            <input
              placeholder="Search keyword rankings..."
              className="flex-1 bg-transparent text-sm font-semibold text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-text-muted)]"
              readOnly
            />
          </div>
          {keywords.length > 0 ? (
            <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">
              Top keyword: {keywords[0]?.keyword} · {keywords[0]?.volume} searches
            </p>
          ) : (
            <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">No search keywords recorded yet.</p>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {needsMeta > 0 ? (
          <AdminButton
            variant="gold"
            disabled={isOffline || fixMissingMeta.isPending}
            onClick={() => void runFixMissingMeta()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {fixMissingMeta.isPending ? 'Fixing SEO…' : `Fix missing meta (${needsMeta})`}
          </AdminButton>
        ) : null}
        <AdminButton
          variant="ghost"
          onClick={() => {
            void refreshWithToast(() => refetch(), 'SEO audit refreshed from catalog.')
          }}
        >
          Refresh SEO audit
        </AdminButton>
      </div>
    </div>
  )
}
