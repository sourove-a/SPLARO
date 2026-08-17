'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { DcHomepageCatalogPanel } from '@/components/dc/screens/DcHomepageCatalogPanel'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcCard } from '@/components/dc/primitives/DcCard'
import { DcPager } from '@/components/dc/primitives/DcPager'
import { DcTable } from '@/components/dc/primitives/DcTable'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import { verifyProductArchived } from '@/lib/admin/catalog-mutation-verify'
import { verifyDeleteSuccess, verifyPersisted } from '@/lib/admin/mutation-verify'
import { ApiError } from '@/lib/api/client'
import { useProducts, useProductStats } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useListQueryState } from '@/lib/hooks/use-list-query-state'
import {
  deleteProduct,
  fetchProduct,
  permanentlyDeleteProduct,
  type ApiProduct,
  type ProductListStatus,
} from '@/lib/api/products'
import { resolveMediaUrl } from '@/lib/media-url'
import { buildStickerRows, printVariantStickers } from '@/lib/admin/variant-stickers'

const TABS = ['All', 'Active', 'Draft', 'Out of stock'] as const
type Tab = (typeof TABS)[number]

/** Tab → the API's own status filter, so a tab narrows the whole catalogue. */
const TAB_STATUS: Record<Tab, ProductListStatus | undefined> = {
  All: undefined,
  Active: 'published',
  Draft: 'draft',
  'Out of stock': 'out-of-stock',
}

/** Rows per request. The API refuses anything above 100. */
const PAGE_SIZE = 25

const SORTS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['name-asc', 'Name A–Z'],
  ['name-desc', 'Name Z–A'],
  ['price-desc', 'Price high to low'],
  ['price-asc', 'Price low to high'],
] as const
type SortKey = (typeof SORTS)[number][0]

function stockOf(p: ApiProduct): number {
  if (!p.variants?.length) return 0
  return p.variants.reduce((sum, v) => sum + (v.stockQuantity ?? v.stock ?? 0), 0)
}

function productThumbUrl(p: ApiProduct): string | null {
  const imgs = p.images ?? []
  const preferred = imgs.find((i) => i.isDefault) ?? imgs[0]
  const raw = preferred?.url ?? p.variants?.find((v) => v.image)?.image ?? null
  return raw ? resolveMediaUrl(raw) : null
}

function tabOf(p: ApiProduct): Exclude<Tab, 'All'> {
  if (stockOf(p) === 0) return 'Out of stock'
  return p.isPublished ? 'Active' : 'Draft'
}

const TAB_TONE: Record<Exclude<Tab, 'All'>, DcTone> = {
  Active: 'ok',
  Draft: 'mute',
  'Out of stock': 'bad',
}

export function DcProducts() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="products" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcProductsBody />
    </DcScreenProvider>
  )
}

function isHomepageTilesLocation() {
  if (typeof window === 'undefined') return false
  if (window.location.hash === '#homepage-tiles') return true
  const tab = new URLSearchParams(window.location.search).get('tab')
  return tab === 'homepage-tiles' || tab === 'homepage'
}

function DcProductsBody() {
  const router = useRouter()
  const [view, setView] = useState<'list' | 'homepage'>('list')
  const [removeTarget, setRemoveTarget] = useState<ApiProduct | null>(null)
  const [removing, setRemoving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const list = useListQueryState({ tab: 'All', sort: 'newest' })
  const tab = (TABS.find((t) => t === list.filters.tab) ?? 'All') as Tab
  const sort = list.filters.sort as SortKey
  const setTab = (next: Tab) => list.setFilter('tab', next)

  useEffect(() => {
    const sync = () => setView(isHomepageTilesLocation() ? 'homepage' : 'list')
    sync()
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  const openList = () => {
    setView('list')
    window.history.replaceState(null, '', '/dashboard/products')
  }
  const openHomepage = () => {
    setView('homepage')
    window.history.replaceState(null, '', '/dashboard/products?tab=homepage-tiles#homepage-tiles')
  }

  /*
   * Server-driven. `limit: 200` used to be silently clamped to the API's ceiling
   * of 100, and every tab count, KPI tile and search then described that first
   * hundred rather than the catalogue. Search moves server-side too, which is a
   * straight upgrade: the API already matches name, SKU, variant SKU, Product
   * Code and barcode, where the client only had name, SKU and Product Code.
   */
  const status = TAB_STATUS[tab]
  const products = useProducts({
    ...(status ? { status } : {}),
    ...(list.debouncedSearch.trim() ? { search: list.debouncedSearch.trim() } : {}),
    sort,
    page: list.page,
    limit: PAGE_SIZE,
  })
  const stats = useProductStats(
    list.debouncedSearch.trim() ? { search: list.debouncedSearch.trim() } : {},
  )
  const { api } = useAdminConnection(25_000)
  const pageStatus = dcPageStatus([products], api.pulse)
  const rows = useMemo(() => products.data?.products ?? [], [products.data])
  const total = products.data?.total ?? 0

  const counts = useMemo<Record<string, number>>(
    () => ({
      All: stats.data?.total ?? 0,
      Active: stats.data?.published ?? 0,
      Draft: stats.data?.draft ?? 0,
      'Out of stock': stats.data?.outOfStock ?? 0,
    }),
    [stats.data],
  )
  const lowStock = stats.data?.lowStock ?? 0

  // A selection only means anything for rows still on screen.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const visible = new Set(rows.map((p) => p.id))
      const next = new Set([...prev].filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [rows])

  const printSelectedStickers = () => {
    const chosen = rows.filter((p) => selected.has(p.id))
    if (chosen.length === 0) return
    if (printVariantStickers(buildStickerRows(chosen))) setSelected(new Set())
  }

  const skeleton: DcBlock[] = [
    { t: 'kpis', items: [] },
    { t: 'table', title: '', cols: [], rows: [] },
  ]

  const runRemove = async (mode: 'archive' | 'permanent') => {
    const target = removeTarget
    if (!target) return
    setRemoving(true)
    try {
      if (mode === 'archive') {
        const saved = await deleteProduct(target.id)
        if (!(await verifyProductArchived(target.id, saved))) return
        toastOk(`"${target.name}" archived — off the storefront, still in the books.`)
      } else {
        const saved = await permanentlyDeleteProduct(target.id)
        if (!verifyDeleteSuccess(saved)) return
        try {
          await fetchProduct(target.id)
          if (!verifyPersisted(false, 'Product delete did not persist on server')) return
        } catch (err) {
          if (!(err instanceof ApiError && err.isNotFound)) {
            toastFail('Could not verify product delete on server')
            return
          }
        }
        toastOk(`"${target.name}" deleted for good.`)
      }
      setRemoveTarget(null)
      void products.refetch()
    } catch (e) {
      // The API refuses a permanent delete once the product has been sold —
      // surface that message rather than a generic failure.
      toastFail(e instanceof Error ? e.message : 'Could not delete this product.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Catalog"
        title="Products"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          products.isFetching ? 'syncing…' : `${(stats.data?.total ?? 0).toLocaleString()} SKUs`
        }
        syncing={products.isFetching}
        onSync={() => void products.refetch()}
        actions={[
          {
            label: 'Import / Export',
            icon: 'icon-upload',
            onClick: () => router.push('/dashboard/bulk'),
          },
          {
            label: 'Add product',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => router.push('/dashboard/products/new'),
          },
        ]}
      />

      {products.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : products.error ? (
        <DcErrorState
          error={`GET /admin/products → ${products.error instanceof Error ? products.error.message : '500 Internal Server Error'}`}
          hint="The shell is fine — only the catalog list failed to load."
          onRetry={() => void products.refetch()}
        />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: 4,
              borderRadius: 12,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              alignSelf: 'flex-start',
            }}
          >
            {(
              [
                ['list', 'Catalog list', 'icon-package'],
                ['homepage', 'Homepage tiles', 'icon-layout-grid'],
              ] as const
            ).map(([id, label, icon]) => {
              const on = view === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => (id === 'homepage' ? openHomepage() : openList())}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    height: 34,
                    padding: '0 12px',
                    borderRadius: 9,
                    border: 0,
                    background: on ? 'var(--surface)' : 'transparent',
                    color: on ? 'var(--ink)' : 'var(--ink-3)',
                    cursor: 'pointer',
                    font: `600 12.5px/1 ${FONT}`,
                    boxShadow: on ? '0 0 0 1px var(--line)' : 'none',
                  }}
                >
                  <DcIcon name={icon} size={14} />
                  {label}
                </button>
              )
            })}
          </div>

          {view === 'homepage' ? <DcHomepageCatalogPanel /> : null}

          {/* An empty catalogue, as opposed to a filter matching nothing —
              which the table below answers with a "clear filters" action. */}
          {view === 'list' && stats.data?.total === 0 && !list.isFiltered ? (
            <DcEmptyState
              icon="icon-package"
              title="No products yet"
              body="The storefront has nothing to sell until the first product is published. Add one product with a photo, price and stock to open the shop."
              cta="Add product"
              onCta={() => router.push('/dashboard/products/new')}
            />
          ) : null}

          {view === 'list' && !(stats.data?.total === 0 && !list.isFiltered) ? (
          <>
          <MobileProductsList
            products={rows}
            tab={tab}
            counts={counts}
            query={list.search}
            onQuery={list.setSearch}
            onTab={setTab}
            onOpen={(id) => router.push(`/dashboard/products/${id}/edit`)}
          />

          <div className="dc-desktop-route-panel">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderBottom: '1px solid var(--line)',
            }}
          >
            {TABS.map((t) => {
              const on = t === tab
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    height: 36,
                    padding: '0 3px',
                    marginRight: 16,
                    border: 0,
                    borderBottom: `2px solid ${on ? 'var(--violet)' : 'transparent'}`,
                    background: 'transparent',
                    cursor: 'pointer',
                    font: `600 13px/1 ${FONT}`,
                    color: on ? 'var(--ink)' : 'var(--ink-3)',
                  }}
                >
                  <span>{t}</span>
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: 99,
                      font: `600 10.5px/1.5 ${FONT}`,
                      background: 'var(--surface-2)',
                      color: 'var(--ink-3)',
                    }}
                  >
                    {counts[t] ?? 0}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi
              label="Total SKUs"
              value={(stats.data?.total ?? 0).toLocaleString()}
              sub={`${(counts['Active'] ?? 0).toLocaleString()} live on store`}
            />
            <Kpi
              label="Drafts"
              value={(counts['Draft'] ?? 0).toLocaleString()}
              sub="hidden from the storefront"
            />
            <Kpi
              label="Low stock"
              value={lowStock.toLocaleString()}
              sub="at or below reorder point"
              color={lowStock > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
            <Kpi
              label="Out of stock"
              value={(counts['Out of stock'] ?? 0).toLocaleString()}
              sub="nothing left to sell"
              color={(counts['Out of stock'] ?? 0) > 0 ? 'var(--bad)' : 'var(--ink)'}
            />
          </div>

          <DcCard clip>
            {selected.size > 0 ? (
              <div className="dc-bulkbar">
                <span className="dc-bulkbar__count">
                  {selected.size} product{selected.size === 1 ? '' : 's'} selected
                </span>
                <button type="button" className="dc-toolbar__tool" onClick={printSelectedStickers}>
                  <DcIcon name="icon-printer" size={13} /> Print stickers
                </button>
                <button
                  type="button"
                  className="dc-toolbar__tool"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </button>
              </div>
            ) : null}
            <div className="dc-card__head dc-toolbar">
              <label className="dc-toolbar__search">
                <DcIcon name="icon-search" size={14} color="var(--ink-3)" />
                <input
                  value={list.search}
                  onChange={(e) => list.setSearch(e.target.value)}
                  placeholder="Name, SKU, Product Code or barcode…"
                  aria-label="Search products"
                />
              </label>

              <select
                className="dc-toolbar__select"
                aria-label="Sort products"
                value={sort}
                onChange={(e) => list.setFilter('sort', e.target.value)}
              >
                {SORTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              {list.isFiltered ? (
                <button type="button" className="dc-toolbar__tool" onClick={list.clear}>
                  Clear filters
                </button>
              ) : null}

              <button
                type="button"
                className="dc-toolbar__tool"
                onClick={() => router.push('/dashboard/bulk')}
              >
                <DcIcon name="icon-list-checks" size={13} /> Bulk edit
              </button>
            </div>

            <DcTable minWidth={900} sticky>
              <thead>
                <tr>
                  <th className="is-check">
                    <input
                      type="checkbox"
                      className="dc-check"
                      aria-label="Select every product on this page"
                      checked={selected.size > 0 && selected.size === rows.length}
                      ref={(el) => {
                        if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length
                      }}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(rows.map((p) => p.id)) : new Set())
                      }
                    />
                  </th>
                  <th>Product</th>
                  <th>Product Code</th>
                  <th className="is-num">Variants</th>
                  <th className="is-num">Stock</th>
                  <th className="is-num">Price</th>
                  <th>Status</th>
                  <th className="is-num">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const stock = stockOf(p)
                  const status = tabOf(p)
                  const tone = toneStyle(TAB_TONE[status])
                  const variants = p._count?.variants ?? p.variants?.length ?? 0
                  const thumb = productThumbUrl(p)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/dashboard/products/${p.id}/edit`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="is-check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="dc-check"
                          aria-label={`Select ${p.name}`}
                          checked={selected.has(p.id)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev)
                              if (next.has(p.id)) next.delete(p.id)
                              else next.add(p.id)
                              return next
                            })
                          }
                        />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          <span
                            style={{
                              display: 'grid',
                              placeItems: 'center',
                              width: 38,
                              height: 46,
                              flex: 'none',
                              borderRadius: 7,
                              border: '1px solid var(--line)',
                              background: thumb
                                ? 'var(--surface-2)'
                                : 'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 5px, var(--surface-3) 5px, var(--surface-3) 10px)',
                              color: 'var(--ink-3)',
                              overflow: 'hidden',
                            }}
                          >
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element -- remote/upload URLs; next/image not wired for admin thumbs
                              <img
                                src={thumb}
                                alt=""
                                width={38}
                                height={46}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <DcIcon name="icon-image" size={13} />
                            )}
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ font: `500 13px/1.25 ${FONT}`, color: 'var(--ink)' }}>
                              {p.name}
                            </span>
                            <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                              {p.category?.name ?? 'Uncategorised'}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                        {p.productCode ? (
                          <span style={{ display: 'grid', gap: 2 }}>
                            <span style={{ color: 'var(--ink)' }}>{p.productCode}</span>
                            {p.sku ? (
                              <span style={{ font: `400 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                                {p.sku}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          (p.sku ?? '—')
                        )}
                      </td>
                      <td
                        style={{
                          padding: '10px 14px',
                          font: `500 12.5px/1 ${FONT}`,
                          color: 'var(--ink-2)',
                        }}
                      >
                        {variants}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            font: `600 12.5px/1 ${MONO}`,
                            color:
                              stock === 0
                                ? 'var(--bad)'
                                : stock <= (p.lowStockThreshold ?? 5)
                                  ? 'var(--warn)'
                                  : 'var(--ink-2)',
                          }}
                        >
                          {stock === 0 ? 'None' : `${stock} units`}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          font: `600 13px/1 ${MONO}`,
                          color: 'var(--ink)',
                        }}
                      >
                        {formatTaka(Number(p.basePrice))}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 8px',
                            borderRadius: 6,
                            font: `600 11px/1 ${FONT}`,
                            border: `1px solid ${tone.bd}`,
                            background: tone.bg,
                            color: tone.fg,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: 99,
                              background: 'currentColor',
                            }}
                          />
                          {status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          title={`Remove ${p.name}`}
                          aria-label={`Remove ${p.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setRemoveTarget(p)
                          }}
                          className="dc-hover-line"
                          style={{
                            display: 'grid',
                            placeItems: 'center',
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            color: 'var(--ink-3)',
                            cursor: 'pointer',
                          }}
                        >
                          <DcIcon name="icon-trash-2" size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </DcTable>

            <DcPager
              page={list.page}
              count={rows.length}
              total={total}
              limit={PAGE_SIZE}
              busy={products.isFetching}
              onPage={list.setPage}
            />
          </DcCard>
          </div>
          </>
          ) : null}
        </>
      )}

      {removeTarget ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Remove product"
          onClick={() => (removing ? undefined : setRemoveTarget(null))}
        >
          <div
            className="admin-modal w-full max-w-md"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal__header">
              <h2 className="text-base font-black" style={{ color: 'var(--ink)' }}>
                Remove “{removeTarget.name}”
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--ink-3)' }}>
                Two different things, so pick deliberately.
              </p>
            </div>
            <div className="admin-modal__body space-y-3">
              <p className="text-xs" style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--ink)' }}>Archive</strong> pulls it off the storefront
                and out of search, but keeps the row so past orders and reports still add up. This is
                the right choice for a product that has ever sold.
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--bad)' }}>Delete permanently</strong> erases the
                product, its variants, images and reviews. It cannot be undone, and the API refuses
                it outright if the product appears on any order.
              </p>
            </div>
            <div className="admin-modal__footer flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={removing}
                onClick={() => setRemoveTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={removing}
                onClick={() => void runRemove('archive')}
              >
                {removing ? 'Working…' : 'Archive'}
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={removing}
                style={{
                  border: '1px solid var(--bad-bd)',
                  background: 'var(--bad-soft)',
                  color: 'var(--bad)',
                }}
                onClick={() => void runRemove('permanent')}
              >
                {removing ? 'Working…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function MobileProductsList({
  products,
  tab,
  counts,
  query,
  onQuery,
  onTab,
  onOpen,
}: {
  products: ApiProduct[]
  tab: Tab
  counts: Record<string, number>
  query: string
  onQuery: (q: string) => void
  onTab: (t: Tab) => void
  onOpen: (id: string) => void
}) {
  return (
    <div className="dc-mobile-route-panel" aria-label="Products">
      <label className="dc-mobile-filter">
        <DcIcon name="icon-search" size={15} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Product or SKU…"
          aria-label="Search products"
        />
      </label>

      <div className="dc-mobile-chips" role="tablist" aria-label="Product status">
        {TABS.map((t) => {
          const on = t === tab
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              className="dc-mobile-chip"
              data-on={on ? 'true' : 'false'}
              onClick={() => onTab(t)}
            >
              {t}
              <span className="dc-mobile-chip__n">{counts[t] ?? 0}</span>
            </button>
          )
        })}
      </div>

      {products.length === 0 ? (
        <div
          style={{
            padding: '42px 18px',
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: 'var(--surface)',
            color: 'var(--ink-3)',
            textAlign: 'center',
            font: `500 12.5px/1.5 ${FONT}`,
          }}
        >
          No products match current filters.
        </div>
      ) : (
        <div className="dc-mobile-list">
          {products.map((p) => {
            const stock = stockOf(p)
            const status = tabOf(p)
            const tone = toneStyle(TAB_TONE[status])
            return (
              <button
                key={p.id}
                type="button"
                className="dc-mobile-list-card"
                onClick={() => onOpen(p.id)}
              >
                <span
                  className="dc-mobile-list-card__icon"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  <DcIcon name="icon-package" size={15} />
                </span>
                <span className="dc-mobile-list-card__copy">
                  <span className="dc-mobile-list-card__title">{p.name}</span>
                  <span className="dc-mobile-list-card__sub">
                    {status} · {p.productCode ?? p.sku ?? 'no code'} · {stock === 0 ? 'out' : `${stock} units`}
                  </span>
                </span>
                <span className="dc-mobile-list-card__value">{formatTaka(Number(p.basePrice))}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color?: string
}) {
  return (
    <div
      className="dc-card"
      style={{
        padding: '13px 15px',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
      }}
    >
      <span
        style={{
          font: `600 11px/1 ${FONT}`,
          letterSpacing: '.09em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: `700 23px/1 ${FONT}`,
          letterSpacing: '-.025em',
          color: color ?? 'var(--ink)',
        }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
