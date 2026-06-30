'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { AlertCircle, CheckCircle, Search, XCircle } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { cn } from '@/lib/utils/cn'
import { useSeoOverview } from '@/lib/api/hooks'

export function SeoHealthPanel() {
  const { data, isError, isLoading, refetch } = useSeoOverview()
  const [tab, setTab] = useState<'products' | 'technical' | 'analytics'>('products')

  const audits = data?.productAudits ?? []
  const summary = data?.summary
  const avgScore = summary?.avgScore ?? 0
  const keywords = data?.keywords ?? []

  if (isError) return <ApiOfflineBanner message="SEO health API offline — start pnpm dev:api." />

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="admin-glass admin-kpi">
          <p className="text-[10px] font-black uppercase text-[#6B6B6B]">Avg SEO Score</p>
          <p className="mt-1 text-3xl font-black text-emerald-600">{isLoading ? '…' : avgScore}</p>
        </div>
        <div className="admin-glass admin-kpi">
          <p className="text-[10px] font-black uppercase text-[#6B6B6B]">Critical errors</p>
          <p className="mt-1 text-3xl font-black text-red-500">{isLoading ? '…' : (summary?.criticalErrors ?? 0)}</p>
        </div>
        <div className="admin-glass admin-kpi">
          <p className="text-[10px] font-black uppercase text-[#6B6B6B]">Warnings</p>
          <p className="mt-1 text-3xl font-black text-amber-600">{isLoading ? '…' : (summary?.warnings ?? 0)}</p>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-[18px] border border-black/5 bg-white/45 p-1">
        {(['products', 'technical', 'analytics'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              'rounded-[14px] px-4 py-2 text-xs font-bold capitalize',
              tab === item ? 'bg-[#5E7CFF]/20 text-[#111111]' : 'text-[#6B6B6B]',
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'products' ? (
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-[#6B6B6B]">Loading product audits…</p>
          ) : audits.length === 0 ? (
            <p className="text-sm text-[#6B6B6B]">No published products to audit yet.</p>
          ) : (
            audits.slice(0, 20).map((audit) => (
              <div key={audit.id} className="rounded-[20px] border border-black/5 bg-white/55 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-[#111111]">{audit.name}</p>
                  <span
                    className={cn(
                      'text-sm font-black',
                      audit.score >= 80 ? 'text-emerald-600' : audit.score >= 60 ? 'text-amber-600' : 'text-red-500',
                    )}
                  >
                    {audit.score}/100
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-black/5">
                  <div
                    className={cn(
                      'h-2 rounded-full',
                      audit.score >= 80 ? 'bg-emerald-500' : audit.score >= 60 ? 'bg-amber-500' : 'bg-red-500',
                    )}
                    style={{ width: `${audit.score}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] font-semibold text-[#6B6B6B]">
                  Meta title: {audit.hasMetaTitle ? '✓' : '✗'} · Meta description: {audit.hasMetaDescription ? '✓' : '✗'}
                </p>
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
              className="flex items-center justify-between rounded-[16px] border border-black/5 bg-white/55 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#5E7CFF]" />
                <span className="text-sm font-semibold text-[#111111]">{label}</span>
              </div>
              <span className="text-xs font-bold text-[#6B6B6B]">{status}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'analytics' ? (
        <div className="rounded-[22px] border border-black/5 bg-white/55 p-5">
          <div className="admin-search mb-4">
            <Search className="h-4 w-4" />
            <input
              placeholder="Search keyword rankings..."
              className="flex-1 bg-transparent text-sm font-semibold outline-none"
              readOnly
            />
          </div>
          {keywords.length > 0 ? (
            <p className="text-sm font-semibold text-[#6B6B6B]">
              Top keyword: {keywords[0]?.keyword} · {keywords[0]?.volume} searches
            </p>
          ) : (
            <p className="text-sm font-semibold text-[#6B6B6B]">No search keywords recorded yet.</p>
          )}
        </div>
      ) : null}

      <AdminButton
        variant="gold"
        onClick={() => {
          void refetch()
          toast.success('SEO audit refreshed from catalog.')
        }}
      >
        Refresh SEO audit
      </AdminButton>
    </div>
  )
}
