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
import {
  BULK_CSV_OPEN_LABEL,
  BULK_CSV_WORKSPACE_LABEL,
  formatCatalogProductsSyncLabel,
  formatCatalogPublishedSub,
} from '@/lib/admin/catalog-import-export-meta'
import { downloadFacebookCatalogCsv } from '@/lib/admin/facebook-catalog-export'
import { fetchAllProductsForCatalog } from '@/lib/admin/product-catalog-sheet'
import { verifyProductArchived } from '@/lib/admin/catalog-mutation-verify'
import { verifyDeleteSuccess, verifyPersisted } from '@/lib/admin/mutation-verify'
import { ApiError } from '@/lib/api/client'
import { useCategoryTree, useProducts, useProductStats, useZeroProductStock, useZeroProductStockByCode } from '@/lib/api/hooks'
import { buildCategoryPicker } from '@/lib/admin/category-picker'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useListQueryState } from '@/lib/hooks/use-list-query-state'
import {
  deleteProduct,
  fetchProduct,
  permanentlyDeleteProduct,
  productActiveVariantCount,
  productStock,
  lookupProductByCode,
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
  return productStock(p)
}

function variantSizeHint(p: ApiProduct): string | null {
  const sizes = [
    ...new Set(
      (p.variants ?? [])
        .filter((v) => v.isActive !== false)
        .map((v) => v.size)
        .filter(Boolean),
    ),
  ]
  return sizes.length ? sizes.join(' · ') : null
}

async function copyCode(label: string, value: string) {
  const text = value.trim()
  if (!text) {
    toastFail(`No ${label.toLowerCase()} to copy.`)
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    toastOk(`${label} copied`)
  } catch {
    toastFail(`Could not copy ${label.toLowerCase()}.`)
  }
}

function CopyableCode({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      title={`Copy ${label}`}
      onClick={(e) => {
        e.stopPropagation()
        void copyCode(label, value)
      }}
      style={{
        display: 'block',
        width: '100%',
        padding: 0,
        border: 0,
        background: 'none',
        color: 'inherit',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {value}
    </button>
  )
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
  const [exportingMeta, setExportingMeta] = useState(false)
  const [zeroStockTarget, setZeroStockTarget] = useState<ApiProduct | null>(null)
  const [zeroingStock, setZeroingStock] = useState(false)
  const [codeModalOpen, setCodeModalOpen] = useState(false)
  const zeroStockMutation = useZeroProductStock()

  const handleExportMetaCsv = async () => {
    if (exportingMeta) return
    setExportingMeta(true)
    try {
      const all = await fetchAllProductsForCatalog()
      if (!all.length) {
        toastFail('No products found to export.')
        return
      }
      downloadFacebookCatalogCsv(all)
      toastOk(`Exported ${all.length} products to Facebook / Meta Catalog CSV.`)
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Could not export Facebook Catalog CSV.')
    } finally {
      setExportingMeta(false)
    }
  }

  const runZeroStock = async (p: ApiProduct) => {
    setZeroingStock(true)
    try {
      const res = await zeroStockMutation.mutateAsync({
        idOrCode: p.id,
        reason: 'Physical shop stock out (1-click zero stock)',
      })
      toastOk(`⚡ “${res.productName}” এর স্টক সফলভাবে ০ করা হয়েছে (Out of stock)`)
      setZeroStockTarget(null)
      void products.refetch()
      void stats.refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not zero stock')
    } finally {
      setZeroingStock(false)
    }
  }

  const handleZeroSelected = async () => {
    if (selected.size === 0) return
    if (!window.confirm(`সিলেক্ট করা ${selected.size} টি প্রোডাক্টের স্টক কি ০ (Out of stock) করবেন?`)) return
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          zeroStockMutation.mutateAsync({
            idOrCode: id,
            reason: 'Physical shop stock out (bulk zero stock)',
          }),
        ),
      )
      toastOk(`সিলেক্ট করা ${selected.size} টি প্রোডাক্টের স্টক ০ করা হয়েছে।`)
      setSelected(new Set())
      void products.refetch()
      void stats.refetch()
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Could not zero selected products')
    }
  }

  const list = useListQueryState({ tab: 'All', sort: 'newest', category: '' })
  const tab = (TABS.find((t) => t === list.filters.tab) ?? 'All') as Tab
  const sort = list.filters.sort as SortKey
  const category = list.filters.category ?? ''
  const setTab = (next: Tab) => list.setFilter('tab', next)

  const { data: categoryTreeData } = useCategoryTree()
  const categories = useMemo(
    () => categoryTreeData?.categories ?? [],
    [categoryTreeData?.categories],
  )
  const categoryPicker = useMemo(
    () => buildCategoryPicker(categories, categoryTreeData?.tree),
    [categories, categoryTreeData?.tree],
  )

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
    ...(category ? { categoryId: category } : {}),
    sort,
    page: list.page,
    limit: PAGE_SIZE,
  })
  const stats = useProductStats({
    ...(list.debouncedSearch.trim() ? { search: list.debouncedSearch.trim() } : {}),
    ...(category ? { categoryId: category } : {}),
  })
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
          products.isFetching ? 'syncing…' : formatCatalogProductsSyncLabel(stats.data?.total ?? 0)
        }
        syncing={products.isFetching}
        onSync={() => void products.refetch()}
        actions={[
          {
            label: exportingMeta ? 'Exporting FB CSV…' : 'Meta Catalog CSV',
            icon: 'icon-download',
            onClick: () => void handleExportMetaCsv(),
          },
          {
            label: BULK_CSV_WORKSPACE_LABEL,
            icon: 'icon-upload',
            onClick: () => router.push('/dashboard/bulk'),
          },
          {
            label: 'Zero Stock by Code',
            icon: 'icon-zap',
            onClick: () => setCodeModalOpen(true),
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
              body="The storefront has nothing to sell until the first product is published. Use Bulk & CSV to import a sheet, or add one product manually with a photo, price and stock."
              cta={BULK_CSV_OPEN_LABEL}
              onCta={() => router.push('/dashboard/bulk')}
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
              label="Total products"
              value={(stats.data?.total ?? 0).toLocaleString()}
              sub={formatCatalogPublishedSub(counts['Active'] ?? 0)}
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
                <button type="button" className="dc-toolbar__tool" onClick={handleZeroSelected}>
                  <DcIcon name="icon-zap" size={13} /> Zero stock
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
              <label className="dc-toolbar__search" style={{ flex: '0 1 280px', maxWidth: 280 }}>
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
                aria-label="Filter by category"
                value={category}
                onChange={(e) => list.setFilter('category', e.target.value)}
                style={{ maxWidth: 220 }}
              >
                <option value="">All categories</option>
                {categoryPicker.departments.length > 0 ? (
                  categoryPicker.departments.map((dept) => {
                    const subs = categoryPicker
                      .subcategoriesForDepartment(dept.id)
                      .filter((s) => s.id !== dept.id)
                    if (!subs.length) {
                      return (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      )
                    }
                    return (
                      <optgroup key={dept.id} label={dept.name}>
                        <option value={dept.id}>All {dept.name}</option>
                        {subs.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  })
                ) : (
                  <>
                    <option value="men">Men</option>
                    <option value="women">Women</option>
                    <option value="kids">Kids</option>
                    <option value="footwear">Footwear</option>
                    <option value="accessories">Accessories</option>
                  </>
                )}
                <option value="uncategorized">Uncategorised</option>
              </select>

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
                  const variants = productActiveVariantCount(p)
                  const sizeHint = variantSizeHint(p)
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
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                                {p.category?.name ?? 'Uncategorised'}
                              </span>
                              <span style={{ color: 'var(--line-strong)' }}>·</span>
                              <span
                                title="Visitor views"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  font: `400 11px/1 ${FONT}`,
                                  color: 'var(--ink-2)',
                                  background: 'var(--surface-2)',
                                  padding: '1.5px 5px',
                                  borderRadius: 4,
                                }}
                              >
                                <span>👁️</span>
                                <span>{p.viewCount ?? 0}</span>
                              </span>
                              <span
                                title="Added to bag"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  font: `400 11px/1 ${FONT}`,
                                  color: 'var(--ink-2)',
                                  background: 'var(--surface-2)',
                                  padding: '1.5px 5px',
                                  borderRadius: 4,
                                }}
                              >
                                <span>🛍️</span>
                                <span>{p.bagCount ?? 0}</span>
                              </span>
                              {(p.viewCount ?? 0) > 0 && (p.bagCount ?? 0) > 0 ? (
                                <span
                                  title="Add-to-bag rate"
                                  style={{
                                    font: `500 10.5px/1 ${FONT}`,
                                    color: 'var(--ok)',
                                  }}
                                >
                                  ({Math.min(100, Math.round(((p.bagCount ?? 0) / (p.viewCount ?? 1)) * 100))}%)
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td
                        style={{ padding: '10px 14px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-2)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.productCode ? (
                          <span style={{ display: 'grid', gap: 2 }}>
                            <span style={{ color: 'var(--ink)' }}>
                              <CopyableCode label="Product Code" value={p.productCode} />
                            </span>
                            {p.sku ? (
                              <span style={{ font: `400 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                                <CopyableCode label="SKU" value={p.sku} />
                              </span>
                            ) : null}
                          </span>
                        ) : p.sku ? (
                          <CopyableCode label="SKU" value={p.sku} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        style={{
                          padding: '10px 14px',
                          font: `500 12.5px/1 ${FONT}`,
                          color: 'var(--ink-2)',
                        }}
                      >
                        <span style={{ display: 'grid', gap: 2 }}>
                          <span>{variants}</span>
                          {sizeHint ? (
                            <span style={{ font: `400 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                              {sizeHint}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
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
                          {stock > 0 ? (
                            <button
                              type="button"
                              title="দোকানে স্টক শেষ? ১-ক্লিকে ওয়েবসাইট স্টক ০ করুন"
                              aria-label={`Set stock to 0 for ${p.name}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setZeroStockTarget(p)
                              }}
                              className="dc-hover-line"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                height: 20,
                                padding: '0 5px',
                                borderRadius: 4,
                                border: '1px solid var(--line-strong)',
                                background: 'var(--surface-2)',
                                color: 'var(--ink-2)',
                                font: `600 10px/1 ${FONT}`,
                                cursor: 'pointer',
                              }}
                            >
                              <span>⚡</span>
                              <span>0</span>
                            </button>
                          ) : null}
                        </div>
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
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {stock > 0 ? (
                            <button
                              type="button"
                              title="দোকানে স্টক শেষ? স্টক ০ করুন (Out of stock)"
                              aria-label={`Zero out stock for ${p.name}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setZeroStockTarget(p)
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
                                color: 'var(--warn, var(--ink-2))',
                                cursor: 'pointer',
                              }}
                            >
                              <DcIcon name="icon-zap" size={13} />
                            </button>
                          ) : null}
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
                        </div>
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

      {zeroStockTarget ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Zero product stock"
          onClick={() => (zeroingStock ? undefined : setZeroStockTarget(null))}
        >
          <div
            className="admin-modal w-full max-w-md"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal__header">
              <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>
                দোকানে স্টক কি শেষ? (Out of stock)
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--ink-3)' }}>
                ওয়েবসাইট থেকে ১-ক্লিকে স্টক ০ করে দেওয়া হবে।
              </p>
            </div>
            <div className="admin-modal__body space-y-3">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                }}
              >
                {productThumbUrl(zeroStockTarget) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productThumbUrl(zeroStockTarget)!}
                    alt=""
                    style={{ width: 36, height: 44, borderRadius: 6, objectFit: 'cover' }}
                  />
                ) : null}
                <div style={{ display: 'grid', gap: 2 }}>
                  <span style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    {zeroStockTarget.name}
                  </span>
                  <span style={{ font: `400 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                    Code: {zeroStockTarget.productCode ?? '—'} · Current: {stockOf(zeroStockTarget)} units
                  </span>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
                কনফার্ম করলে এই প্রোডাক্টের সব ভ্যারিয়েন্টের ওয়েবসাইট স্টক সাথে সাথে <strong style={{ color: 'var(--bad)' }}>০ (Zero)</strong> হয়ে যাবে এবং কাস্টমাররা এটি <em>Out of stock</em> দেখতে পাবে।
              </p>
            </div>
            <div className="admin-modal__footer flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={zeroingStock}
                onClick={() => setZeroStockTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={zeroingStock}
                style={{
                  border: '1px solid var(--bad-bd)',
                  background: 'var(--bad-soft)',
                  color: 'var(--bad)',
                }}
                onClick={() => void runZeroStock(zeroStockTarget)}
              >
                {zeroingStock ? 'স্টক ০ হচ্ছে…' : '⚡ হ্যাঁ, স্টক ০ করুন'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ZeroStockByCodeModal
        open={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        onSuccess={() => {
          void products.refetch()
          void stats.refetch()
        }}
      />
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

function ZeroStockByCodeModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [matched, setMatched] = useState<ApiProduct | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const zeroStockMutation = useZeroProductStockByCode()

  useEffect(() => {
    if (open) {
      setCode('')
      setMatched(null)
      setErrorMsg('')
      setLoading(false)
      setSearching(false)
    }
  }, [open])

  const handleLookup = async (lookupCode: string) => {
    const raw = lookupCode.trim()
    if (!raw) {
      setMatched(null)
      setErrorMsg('')
      return
    }
    setSearching(true)
    setErrorMsg('')
    try {
      const res = await lookupProductByCode(raw)
      setMatched(res)
    } catch (err) {
      setMatched(null)
      setErrorMsg(err instanceof Error ? err.message : 'No product found with this code')
    } finally {
      setSearching(false)
    }
  }

  const handleApplyZero = async () => {
    const raw = code.trim()
    if (!raw) {
      setErrorMsg('প্রোডাক্ট কোড লিখুন')
      return
    }
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await zeroStockMutation.mutateAsync({
        code: raw,
        reason: 'Physical shop stock out (code lookup zero stock)',
      })
      toastOk(`⚡ “${res.productName}” (${res.productCode}) এর স্টক সফলভাবে ০ করা হয়েছে!`)
      onSuccess()
      onClose()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not zero stock')
      toastFail(err instanceof Error ? err.message : 'Could not zero stock')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => (loading ? undefined : onClose())}
    >
      <div
        className="admin-modal w-full max-w-md"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>
              দোকানের স্টক শেষ? (Product Code দিয়ে ০ করুন)
            </h2>
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--ink-3)' }}>
            দোকানের প্রোডাক্ট কোড (যেমন: 895765) বা SKU লিখে এন্টার চাপলে মুহূর্তেই ওয়েবসাইট স্টক ০ হয়ে যাবে।
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleApplyZero()
          }}
          className="admin-modal__body space-y-3"
        >
          <div>
            <label
              htmlFor="zero-stock-code-input"
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--ink-2)' }}
            >
              Product Code বা বারকোড
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                id="zero-stock-code-input"
                autoFocus
                type="text"
                value={code}
                onChange={(e) => {
                  const val = e.target.value
                  setCode(val)
                  if (val.trim().length >= 4) {
                    void handleLookup(val)
                  } else {
                    setMatched(null)
                    setErrorMsg('')
                  }
                }}
                placeholder="যেমন: 895765 বা SKU"
                className="dc-toolbar__select"
                style={{
                  flex: 1,
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid var(--line-strong)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  font: `500 13px/1 ${MONO}`,
                }}
              />
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={searching || !code.trim()}
                onClick={() => void handleLookup(code)}
                style={{ height: 38 }}
              >
                {searching ? 'খোঁজা হচ্ছে…' : 'চেক করুন'}
              </button>
            </div>
          </div>

          {searching ? (
            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
              প্রোডাক্ট খোঁজা হচ্ছে…
            </p>
          ) : null}

          {errorMsg ? (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 7,
                background: 'var(--bad-soft, rgba(239, 68, 68, 0.1))',
                border: '1px solid var(--bad-bd, rgba(239, 68, 68, 0.3))',
                color: 'var(--bad)',
                fontSize: 12,
              }}
            >
              {errorMsg}
            </div>
          ) : null}

          {matched ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--surface-2)',
                border: '1px solid var(--line-strong)',
              }}
            >
              {productThumbUrl(matched) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={productThumbUrl(matched)!}
                  alt=""
                  style={{ width: 42, height: 50, borderRadius: 6, objectFit: 'cover' }}
                />
              ) : null}
              <div style={{ display: 'grid', gap: 3, flex: 1 }}>
                <span style={{ font: `600 13px/1.25 ${FONT}`, color: 'var(--ink)' }}>
                  {matched.name}
                </span>
                <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                  {matched.category?.name ?? 'Uncategorised'} · Code:{' '}
                  <strong style={{ color: 'var(--ink)' }}>{matched.productCode ?? '—'}</strong>
                </span>
                <span
                  style={{
                    font: `600 12px/1 ${MONO}`,
                    color: stockOf(matched) > 0 ? 'var(--ok)' : 'var(--bad)',
                  }}
                >
                  বর্তমান স্টক: {stockOf(matched)} units
                </span>
              </div>
            </div>
          ) : null}

          <div className="admin-modal__footer flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={loading}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn"
              disabled={loading || !code.trim()}
              style={{
                border: '1px solid var(--bad-bd)',
                background: 'var(--bad-soft)',
                color: 'var(--bad)',
              }}
            >
              {loading ? 'স্টক ০ হচ্ছে…' : '⚡ স্টক ০ করুন (Out of stock)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
