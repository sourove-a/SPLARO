'use client'

import { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Eye,
  EyeOff,
  LayoutGrid,
  Menu,
  Package,
  RotateCcw,
  ShoppingBag,
  Store,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import type { CatalogChannel } from '@splaro/types'
import { DEFAULT_CATALOG_CHANNELS } from '@splaro/types'
import { useCatalogChannelStats } from '@/lib/api/hooks'
import type { CatalogChannelStats } from '@/lib/api/settings'
import { cn } from '@/lib/utils/cn'

interface CatalogVisibilityPanelProps {
  channels: CatalogChannel[]
  savedChannels?: CatalogChannel[]
  storefrontUrl?: string
  onChange: (channels: CatalogChannel[]) => void
  onSave: () => void
  saving?: boolean
}

const PLACEMENTS = [
  { id: 'nav', label: 'Header menu', icon: Menu },
  { id: 'shop', label: 'Shop filters', icon: ShoppingBag },
  { id: 'collections', label: 'Collections page', icon: LayoutGrid },
  { id: 'home', label: 'Homepage tiles', icon: Store },
] as const

function channelsEqual(a: CatalogChannel[], b: CatalogChannel[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function getStatsForChannel(
  slug: string,
  stats: CatalogChannelStats[] | undefined,
): CatalogChannelStats | undefined {
  return stats?.find((entry) => entry.slug === slug)
}

export function CatalogVisibilityPanel({
  channels,
  savedChannels,
  storefrontUrl,
  onChange,
  onSave,
  saving = false,
}: CatalogVisibilityPanelProps) {
  const rows = channels.length ? channels : DEFAULT_CATALOG_CHANNELS
  const baseline = savedChannels?.length ? savedChannels : rows
  const dirty = !channelsEqual(rows, baseline)
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useCatalogChannelStats(true)

  const publishedCount = rows.filter((channel) => channel.published).length
  const hiddenCount = rows.length - publishedCount
  const emptyPublished = rows.filter((channel) => {
    if (!channel.published) return false
    const stats = getStatsForChannel(channel.slug, statsData?.channels)
    return stats ? stats.inStockProducts === 0 : false
  })

  const storefrontBase = storefrontUrl?.replace(/\/$/, '') ?? ''

  const suggestions = useMemo(() => {
    return rows
      .filter((channel) => {
        const stats = getStatsForChannel(channel.slug, statsData?.channels)
        return channel.published && stats && stats.inStockProducts === 0
      })
      .map((channel) => channel.label)
  }, [rows, statsData?.channels])

  const togglePublished = (slug: string) => {
    onChange(
      rows.map((channel) =>
        channel.slug === slug ? { ...channel, published: !channel.published } : channel,
      ),
    )
  }

  const hideEmptyCollections = () => {
    onChange(
      rows.map((channel) => {
        const stats = getStatsForChannel(channel.slug, statsData?.channels)
        if (!stats || stats.inStockProducts > 0) return channel
        return { ...channel, published: false }
      }),
    )
  }

  const publishAll = () => {
    onChange(rows.map((channel) => ({ ...channel, published: true })))
  }

  const resetChanges = () => {
    onChange(baseline.map((channel) => ({ ...channel })))
  }

  return (
    <div className="space-y-4">
      <section className="admin-module-card admin-module-card--accent">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="admin-module-card__title">Catalog visibility</p>
            <p className="admin-module-card__subtitle mt-1 max-w-2xl">
              WordPress-style publish control. Hide Men when stock is empty — it disappears from menu,
              shop tabs, collections, and direct URLs. Publish again when you are ready.
            </p>
          </div>
          {dirty ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-900">
              Unsaved changes
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-[14px] border border-black/6 bg-white/70 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
              Published
            </p>
            <p className="mt-1 text-xl font-black text-emerald-800">{publishedCount}</p>
          </div>
          <div className="rounded-[14px] border border-black/6 bg-white/70 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
              Hidden
            </p>
            <p className="mt-1 text-xl font-black text-amber-900">{hiddenCount}</p>
          </div>
          <div className="rounded-[14px] border border-black/6 bg-white/70 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
              Live but empty
            </p>
            <p className="mt-1 text-xl font-black text-rose-700">{emptyPublished.length}</p>
          </div>
        </div>

        {suggestions.length > 0 ? (
          <div className="mt-4 flex items-start gap-2 rounded-[14px] border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-xs font-semibold text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>{suggestions.join(', ')}</strong> published কিন্তু stock নেই। Customer empty shop দেখতে পারে —
              Hide collection চাপুন বা নিচের bulk action ব্যবহার করুন।
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <AdminButton variant="ghost" className="!text-xs" onClick={() => void refetchStats()}>
            <Boxes className="h-3.5 w-3.5" />
            Refresh stock
          </AdminButton>
          <AdminButton variant="ghost" className="!text-xs" onClick={hideEmptyCollections}>
            <EyeOff className="h-3.5 w-3.5" />
            Hide empty collections
          </AdminButton>
          <AdminButton variant="ghost" className="!text-xs" onClick={publishAll}>
            <Eye className="h-3.5 w-3.5" />
            Publish all
          </AdminButton>
          {dirty ? (
            <AdminButton variant="ghost" className="!text-xs" onClick={resetChanges}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </AdminButton>
          ) : null}
          <AdminButton variant="gold" loading={saving} onClick={onSave}>
            Save catalog visibility
          </AdminButton>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((channel) => {
          const stats = getStatsForChannel(channel.slug, statsData?.channels)
          const isEmptyLive = channel.published && stats && stats.inStockProducts === 0
          const previewHref = storefrontBase ? `${storefrontBase}${channel.href}` : channel.href

          return (
            <article
              key={channel.slug}
              className={cn(
                'admin-module-card transition-all',
                !channel.published && 'opacity-85',
                isEmptyLive && 'ring-1 ring-amber-200/90',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-[var(--admin-text-primary)]">{channel.label}</p>
                  <p className="mt-1 font-mono text-[10px] text-[var(--admin-text-secondary)]">
                    {channel.href}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]',
                    channel.published
                      ? isEmptyLive
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-100 text-emerald-800'
                      : 'bg-black/8 text-[var(--admin-text-secondary)]',
                  )}
                >
                  {channel.published ? (isEmptyLive ? 'Live · no stock' : 'Published') : 'Hidden'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-[12px] border border-black/6 bg-black/[0.02] px-2.5 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
                    Products
                  </p>
                  <p className="mt-0.5 text-sm font-black">
                    {statsLoading ? '…' : (stats?.publishedProducts ?? '—')}
                  </p>
                </div>
                <div className="rounded-[12px] border border-black/6 bg-black/[0.02] px-2.5 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
                    In stock
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 text-sm font-black',
                      stats && stats.inStockProducts === 0 ? 'text-rose-700' : 'text-emerald-800',
                    )}
                  >
                    {statsLoading ? '…' : (stats?.inStockProducts ?? '—')}
                  </p>
                </div>
                <div className="rounded-[12px] border border-black/6 bg-black/[0.02] px-2.5 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
                    Units
                  </p>
                  <p className="mt-0.5 text-sm font-black">
                    {statsLoading ? '…' : (stats?.totalStockUnits ?? '—')}
                  </p>
                </div>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold leading-relaxed text-[var(--admin-text-secondary)]">
                <Package className="h-3.5 w-3.5 shrink-0" />
                {channel.published
                  ? isEmptyLive
                    ? 'Published but no sellable stock — consider hiding until restock.'
                    : 'Live on storefront — customers can browse this collection.'
                  : 'Hidden from storefront — menu, shop, collections, and collection URL are off.'}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {PLACEMENTS.map((placement) => (
                  <span
                    key={placement.id}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold',
                      channel.published
                        ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-900'
                        : 'border-black/8 bg-black/[0.03] text-[var(--admin-text-secondary)] line-through',
                    )}
                  >
                    <placement.icon className="h-3 w-3" />
                    {placement.label}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <AdminButton
                  className="!text-xs"
                  variant={channel.published ? 'ghost' : 'gold'}
                  onClick={() => togglePublished(channel.slug)}
                >
                  {channel.published ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      Hide collection
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      Publish collection
                    </>
                  )}
                </AdminButton>
                {channel.published && storefrontBase ? (
                  <a
                    href={previewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] font-bold text-[var(--admin-text-primary)] transition hover:border-black/20"
                  >
                    View live
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>

      {dirty ? (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-amber-200/80 bg-amber-50/95 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          <p className="text-xs font-bold text-amber-950">Catalog visibility changes not saved yet.</p>
          <div className="flex gap-2">
            <AdminButton variant="ghost" className="!text-xs" onClick={resetChanges}>
              Discard
            </AdminButton>
            <AdminButton variant="gold" loading={saving} onClick={onSave}>
              Save now
            </AdminButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}
