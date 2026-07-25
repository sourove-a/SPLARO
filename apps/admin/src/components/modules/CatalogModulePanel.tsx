'use client'

import { Fragment, useMemo, useState } from 'react'
import { refreshWithToast, toastOk, toastFail } from '@/lib/admin/feedback'
import {
  confirmBrandSaved,
  confirmBrandToggled,
  confirmCollectionSaved,
  confirmCollectionToggled,
  confirmProductArchived,
  confirmVariantSaved,
} from '@/lib/admin/catalog-save'
import { copyProductStorefrontUrl, productStorefrontUrl } from '@/lib/admin/product-storefront-url'
import { downloadCsv, printProductLabel } from '@/lib/admin/admin-actions'
import { AlertTriangle, Archive, Award, ChevronDown, Download, Layers, Package, Plus, Printer, RefreshCw, Search, Tags } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminStatusBadge, type AdminBadgeTone } from '@/components/ui/AdminStatusBadge'
import { AdminTableSkeleton } from '@/components/ui/AdminUiPrimitives'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { useBrands, useCollections, useCreateBrand, useCreateCollection, useProducts, useDeleteProduct, useUpdateCollection, useUpdateBrand, usePublishedProductCount, useInventoryAlerts, useUpdateProductVariant, usePermission } from '@/lib/api/hooks'
import { PERMISSION_DENIED_TITLE } from '@/lib/auth/permissions'
import { productStatus, productStock, type ApiProduct } from '@/lib/api/products'
import { formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { LiveCategoriesPanel } from '@/components/modules/LiveCategoriesPanel'
import { LiveProductCodesPanel } from '@/components/modules/LiveProductCodesPanel'
import { ProductReviewsPanel } from '@/components/modules/ProductReviewsPanel'
import { ProductEditPanel } from '@/components/modules/ProductEditPanel'
import { useAdminNavigate } from '@/lib/navigation/client-nav'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { ModuleLiveStrip } from '@/components/ui/connection/ModuleLiveStrip'

// ─── Design tokens (theme-aware via CSS variables) ────────────────────────────
const STATUS_TONE: Record<string, AdminBadgeTone> = {
  active: 'success',
  published: 'success',
  draft: 'muted',
  archived: 'danger',
  low: 'warning',
  warning: 'danger',
  'out of stock': 'warning',
}

function StatusPill({ value }: { value: string }) {
  const label = value
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
  return <AdminStatusBadge label={label} tone={STATUS_TONE[value.toLowerCase()] ?? 'muted'} />
}

function KpiCard({
  label,
  value,
  accent,
  delta,
  deltaTone,
}: {
  label: string
  value: string | number
  accent?: string
  delta?: string
  deltaTone?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className={cn('admin-kpi-card', accent && `admin-kpi-card--${accent}`)}>
      <p className="admin-kpi-card__label">{label}</p>
      <div className="admin-kpi-card__row">
        <p className="admin-kpi-card__value">{value}</p>
        {delta ? (
          <span className={cn('admin-kpi-card__delta', `admin-kpi-card__delta--${deltaTone ?? 'neutral'}`)}>
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function PanelHeader({
  icon: Icon,
  title,
  kpis,
  children,
  action,
}: {
  icon: React.ElementType
  title: string
  kpis: Array<{
    label: string
    value: string | number
    accent?: string
    delta?: string
    deltaTone?: 'up' | 'down' | 'neutral'
  }>
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="admin-catalog-hero admin-panel-hero">
      <div className="admin-catalog-hero__top">
        <div className="admin-catalog-hero__title-row">
          <div className="admin-catalog-icon-ring admin-catalog-icon-ring--lg">
            <Icon strokeWidth={2} />
          </div>
          <h1 className="admin-catalog-hero__title">{title}</h1>
        </div>
        <div className="admin-catalog-hero__actions">
          {children}
          {action}
        </div>
      </div>
      <div className="admin-kpi-grid admin-kpi-grid--catalog">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>
    </div>
  )
}

function Toolbar({
  query, onQuery, placeholder,
  createLabel, onCreate, createDisabled, createDisabledTitle,
  onRefresh, onExport,
  tabs, activeTab, onTab,
  extra,
}: {
  query: string; onQuery: (v: string) => void; placeholder?: string
  createLabel?: string; onCreate?: () => void; createDisabled?: boolean; createDisabledTitle?: string
  onRefresh?: () => void; onExport?: () => void
  tabs?: { key: string; label: string; count: number }[]
  activeTab?: string; onTab?: (k: string) => void
  extra?: React.ReactNode
}) {
  return (
    <div className="admin-catalog-toolbar">
      <div className="admin-catalog-toolbar__row">
        <div className="admin-catalog-toolbar__search">
          <Search className="admin-catalog-toolbar__search-icon" aria-hidden />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder ?? 'Search…'}
            className="admin-catalog-input"
          />
        </div>
        {extra}
        <div className="admin-catalog-toolbar__actions">
          {onCreate ? (
            <button
              type="button"
              onClick={createDisabled ? undefined : onCreate}
              disabled={createDisabled}
              title={createDisabled ? (createDisabledTitle ?? 'Action unavailable') : undefined}
              className={cn('admin-catalog-action admin-catalog-action--primary', createDisabled && 'cursor-not-allowed opacity-50')}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {createLabel}
            </button>
          ) : null}
          {onRefresh ? (
            <button type="button" onClick={onRefresh} className="admin-catalog-action" aria-label="Refresh">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          {onExport ? (
            <button type="button" onClick={onExport} className="admin-catalog-action" aria-label="Export CSV">
              <Download className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      {tabs ? (
        <div className="admin-catalog-toolbar__tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={() => onTab?.(t.key)}
              className={cn('admin-catalog-tab', activeTab === t.key && 'admin-catalog-tab--active')}
            >
              {t.label}
              <span className="admin-catalog-tab__count">{t.count}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function GlassTable({ title, footer, icon: Icon, children }: { title: string; footer?: string; icon?: React.ElementType; children: React.ReactNode }) {
  const I = Icon ?? Package
  return (
    <div className="admin-panel-glass admin-catalog-table-shell">
      <div className="admin-catalog-table-shell__head">
        <div className="admin-catalog-icon-ring">
          <I aria-hidden />
        </div>
        <p className="admin-catalog-table-shell__title">{title}</p>
      </div>
      <div className="admin-catalog-table-shell__scroll">{children}</div>
      {footer ? <div className="admin-catalog-table-shell__footer">{footer}</div> : null}
    </div>
  )
}

const TH = 'admin-catalog-th'
const TD = 'admin-catalog-td'


// ─── Products ──────────────────────────────────────────────────────────────────
type ProductStatus = 'active' | 'draft' | 'archived'

function productImageUrl(p: ApiProduct): string | null {
  const imgs = p.images ?? []
  const preferred = imgs.find((i) => i.isDefault) ?? imgs[0]
  return preferred?.url ?? p.variants?.find((v) => v.image)?.image ?? null
}

function mapApiProduct(p: ApiProduct) {
  const stock = productStock(p)
  return {
    id: p.sku ?? p.id.slice(0, 8).toUpperCase(),
    linkId: p.id,
    slug: p.slug ?? '',
    name: p.name,
    category: p.category?.name ?? 'Uncategorized',
    brand: p.category?.name ?? '—',
    variants: p._count?.variants ?? p.variants?.length ?? 0,
    stock,
    price: Number(p.basePrice),
    status: productStatus(p),
    imageUrl: productImageUrl(p),
    featured: Boolean(p.isFeatured || p.isBestSeller),
  }
}

function ProductsPanel() {
  const { navigate } = useAdminNavigate()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data: apiData, isError, isLoading, refetch } = useProducts({ limit: 50 })
  const { data: liveCount, isError: liveCountError, isLoading: liveCountLoading } = usePublishedProductCount()
  const deleteProduct = useDeleteProduct()
  const canDeleteProducts = usePermission('products', 'delete')
  const canCreateProducts = usePermission('products', 'create')
  const catalog = useMemo(() => (apiData?.products ? apiData.products.map(mapApiProduct) : []), [apiData])

  const categories = useMemo(() => {
    const set = new Set(catalog.map((p) => p.category).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [catalog])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return catalog.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      const matchS = statusFilter === 'all' || p.status === statusFilter
      const matchC = categoryFilter === 'all' || p.category === categoryFilter
      return matchQ && matchS && matchC
    })
  }, [query, statusFilter, categoryFilter, catalog])

  const activeCount = catalog.filter((p) => p.status === 'active').length
  const draftCount = catalog.filter((p) => p.status === 'draft').length
  const lowStockCount = catalog.filter((p) => p.stock > 0 && p.stock <= 5).length
  const outCount = catalog.filter((p) => p.stock === 0).length
  const totalCount = apiData?.total ?? catalog.length
  const activeShare = totalCount ? Math.round((activeCount / Math.max(catalog.length, 1)) * 100) : 0
  const lowShare = catalog.length ? Math.round((lowStockCount / catalog.length) * 100) : 0

  const handleArchive = async (linkId: string, name: string) => {
    if (!window.confirm(`Archive "${name}"? It will be hidden from the storefront.`)) return
    const ok = await confirmProductArchived(linkId, name, () => deleteProduct.mutateAsync(linkId))
    if (ok) void refetch()
  }

  const exportProducts = () => {
    if (!filtered.length) {
      toastFail('Nothing to export — adjust your filters.')
      return
    }
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`splaro-products-${date}.csv`, [
      ['SKU', 'Product', 'Category', 'Brand', 'Variants', 'Stock', 'Price (BDT)', 'Status'],
      ...filtered.map((p) => [
        p.id,
        p.name,
        p.category,
        p.brand,
        String(p.variants),
        String(p.stock),
        String(p.price),
        p.status,
      ]),
    ])
    toastOk(`Exported ${filtered.length} product${filtered.length === 1 ? '' : 's'}.`)
  }

  const handlePrintLabel = (p: (typeof catalog)[number]) => {
    printProductLabel({
      sku: p.id,
      name: p.name,
      price: formatBDT(p.price),
      category: p.category,
    })
  }

  return (
    <div className="settings-section-enter admin-module-page admin-products-page">
      {isError ? (
        <ApiOfflineBanner message="API offline — start SPLARO API on port 4000 and run `pnpm db:seed`." />
      ) : (
        <div className="admin-products-page__live">
          <ModuleLiveStrip
            onRefresh={() => void refreshWithToast(refetch, 'Catalog synced')}
            items={[
              {
                label: 'Storefront live',
                value: liveCountLoading ? '…' : `${liveCount ?? 0} published`,
                ok: !liveCountError,
              },
              {
                label: 'Admin catalog',
                value: isLoading ? '…' : `${totalCount} total`,
                ok: !isError,
              },
              {
                label: 'Draft',
                value: String(draftCount),
                ok: true,
                informational: true,
              },
            ]}
          />
        </div>
      )}

      <PanelHeader
        icon={Package}
        title="Products"
        action={
          <button
            type="button"
            className={cn('admin-catalog-action admin-catalog-action--primary admin-catalog-action--lg', !canCreateProducts && 'cursor-not-allowed opacity-50')}
            disabled={!canCreateProducts}
            title={!canCreateProducts ? PERMISSION_DENIED_TITLE : undefined}
            onClick={() => {
              if (!canCreateProducts) return
              navigate('/dashboard/products/new')
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add Product
          </button>
        }
        kpis={[
          {
            label: 'Live on site',
            value: liveCountLoading ? '…' : (liveCount ?? 0),
            accent: 'success',
            ...(liveCountLoading ? {} : { delta: `${activeShare}% catalog`, deltaTone: 'up' as const }),
          },
          {
            label: 'Total products',
            value: isLoading ? '…' : totalCount,
            delta: `${catalog.length} loaded`,
            deltaTone: 'neutral',
          },
          {
            label: 'Active',
            value: activeCount,
            accent: 'success',
            delta: `${activeShare}%`,
            deltaTone: 'up',
          },
          {
            label: 'Low stock',
            value: lowStockCount,
            accent: 'warning',
            delta: lowStockCount ? `-${lowShare}%` : '0%',
            deltaTone: lowStockCount ? 'down' : 'neutral',
          },
        ]}
      />

      {(lowStockCount > 0 || outCount > 0) && (
        <div className="admin-catalog-alert" role="status">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            {lowStockCount > 0 ? `${lowStockCount} product(s) need restock` : null}
            {lowStockCount > 0 && outCount > 0 ? ' · ' : null}
            {outCount > 0 ? `${outCount} out of stock` : null}
          </span>
        </div>
      )}

      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Search products…"
        createLabel="Add Product"
        onCreate={() => navigate('/dashboard/products/new')}
        createDisabled={!canCreateProducts}
        createDisabledTitle={PERMISSION_DENIED_TITLE}
        onRefresh={() => void refreshWithToast(refetch, 'Catalog synced')}
        onExport={exportProducts}
        tabs={[
          { key: 'all', label: 'All', count: catalog.length },
          { key: 'active', label: 'Active', count: activeCount },
          { key: 'draft', label: 'Draft', count: draftCount },
          { key: 'archived', label: 'Archived', count: catalog.filter((p) => p.status === 'archived').length },
        ]}
        activeTab={statusFilter}
        onTab={(k) => setStatusFilter(k as ProductStatus | 'all')}
        extra={
          <label className="admin-catalog-filter">
            <span className="admin-catalog-filter__label">Category</span>
            <select
              className="admin-catalog-filter__select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        }
      />

      <GlassTable
        icon={Package}
        title={`Products · ${filtered.length} results`}
        footer={isLoading ? 'Loading products…' : `Showing ${filtered.length} of ${catalog.length} products`}
      >
        {isLoading && catalog.length === 0 ? (
          <AdminTableSkeleton rows={8} />
        ) : filtered.length === 0 ? (
          <div className="admin-empty-state admin-catalog-empty">
            <span className="admin-empty-state__icon"><Package aria-hidden /></span>
            <p className="admin-empty-state__title">No products match</p>
            <p className="admin-empty-state__text">Try another search, status, or category filter.</p>
          </div>
        ) : (
          <table className="admin-catalog-data-table">
            <thead>
              <tr>
                {['Product', 'Price', 'Category', 'Stock', 'SKU', 'Variants', 'Status', ''].map((h) => (
                  <th key={h || 'actions'} className={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <Fragment key={p.linkId}>
                  <tr className={cn('admin-catalog-row', expandedId === p.linkId && 'admin-catalog-row--open')}>
                    <td className={TD}>
                      <button
                        type="button"
                        className="admin-catalog-product"
                        onClick={() => setExpandedId(expandedId === p.linkId ? null : p.linkId)}
                      >
                        <span className="admin-catalog-product__thumb">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt="" width={40} height={40} />
                          ) : (
                            <Package className="h-4 w-4" aria-hidden />
                          )}
                        </span>
                        <span className="admin-catalog-product__meta">
                          <strong>{p.name}</strong>
                          {p.featured ? <span className="admin-catalog-product__badge">Featured</span> : null}
                        </span>
                        <ChevronDown
                          className={cn('admin-catalog-product__chevron', expandedId === p.linkId && 'admin-catalog-product__chevron--open')}
                          aria-hidden
                        />
                      </button>
                    </td>
                    <td className={cn(TD, 'admin-catalog-td--strong')}>{formatBDT(p.price)}</td>
                    <td className={TD}>{p.category}</td>
                    <td className={cn(TD, 'admin-catalog-td--strong', p.stock === 0 && 'admin-catalog-td--danger', p.stock > 0 && p.stock <= 5 && 'admin-catalog-td--warn')}>
                      {p.stock}
                    </td>
                    <td className={cn(TD, 'admin-catalog-td--mono')}>{p.id}</td>
                    <td className={TD}>{p.variants}</td>
                    <td className={TD}>
                      <StatusPill value={p.stock === 0 && p.status === 'active' ? 'out of stock' : p.status} />
                    </td>
                    <td className={TD}>
                      <RowActionsMenu
                        recordName={p.name}
                        moduleHref="/dashboard/products"
                        recordId={p.linkId}
                        actions={[
                          { label: 'Edit product', onClick: () => navigate(`/dashboard/products/${p.linkId}/edit`) },
                          ...(p.slug
                            ? [
                                {
                                  label: 'Copy storefront URL',
                                  onClick: () => {
                                    if (p.status !== 'active') {
                                      toastFail('Publish the product first — draft links do not work on the storefront.')
                                      return
                                    }
                                    void copyProductStorefrontUrl(p.slug).then((ok) =>
                                      ok ? toastOk('Storefront link copied') : toastFail('Could not copy link'),
                                    )
                                  },
                                },
                                {
                                  label: 'View on storefront',
                                  onClick: () => {
                                    if (p.status !== 'active') {
                                      toastFail('Publish the product first.')
                                      return
                                    }
                                    window.open(productStorefrontUrl(p.slug), '_blank', 'noopener,noreferrer')
                                  },
                                },
                              ]
                            : []),
                          {
                            label: 'Archive',
                            tone: 'danger' as const,
                            onClick: () => handleArchive(p.linkId, p.name),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                  {expandedId === p.linkId ? (
                    <tr className="admin-catalog-row-expand">
                      <td colSpan={8} className={TD}>
                        <div className="admin-catalog-row-expand__actions">
                          <a href={`/dashboard/products/${p.linkId}/edit`} className="admin-catalog-action admin-catalog-action--primary">Edit product</a>
                          <a href={`/dashboard/inventory?sku=${encodeURIComponent(p.id)}`} className="admin-catalog-action">View inventory</a>
                          <AdminButton size="sm" onClick={() => handlePrintLabel(p)}>
                            <Printer className="h-3.5 w-3.5" aria-hidden /> Print label
                          </AdminButton>
                          {canDeleteProducts ? (
                            <AdminButton variant="danger" size="sm" loading={deleteProduct.isPending} onClick={() => handleArchive(p.linkId, p.name)}>
                              <Archive className="h-3.5 w-3.5" aria-hidden /> Archive
                            </AdminButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </GlassTable>
    </div>
  )
}

// ─── Collections ───────────────────────────────────────────────────────────────
function CollectionsPanel() {
  const [query, setQuery] = useState('')
  const { data, isError, isLoading, refetch } = useCollections()
  const createCollection = useCreateCollection()
  const updateCollection = useUpdateCollection()
  const rows = useMemo(() => data?.collections ?? [], [data])
  const filtered = useMemo(() => { const q = query.toLowerCase(); return rows.filter((c) => !q || c.name.toLowerCase().includes(q)) }, [query, rows])

  const published = rows.filter((c) => c.isActive).length
  const linked = rows.reduce((s, c) => s + (c._count?.products ?? 0), 0)

  const handleCreate = async () => {
    const name = window.prompt('Collection name')
    if (!name?.trim()) return
    const trimmed = name.trim()
    const ok = await confirmCollectionSaved(
      { name: trimmed, isActive: true },
      () => createCollection.mutateAsync({ name: trimmed }),
    )
    if (ok) void refetch()
  }

  const toggleVisibility = async (id: string, name: string, isActive: boolean) => {
    const next = !isActive
    const ok = await confirmCollectionToggled(
      id,
      next,
      name,
      () => updateCollection.mutateAsync({ id, isActive: next }),
    )
    if (ok) void refetch()
  }

  if (isError) return <ApiOfflineBanner message="API offline — start API on port 4000, then run `pnpm db:push`." />

  return (
    <div className="settings-section-enter admin-module-page">
      <PanelHeader icon={Layers} title="Collections" kpis={[
        { label: 'Collections', value: isLoading ? '…' : rows.length },
        { label: 'Published', value: isLoading ? '…' : published, accent: 'success' },
        { label: 'Draft', value: isLoading ? '…' : rows.length - published, accent: 'warning' },
        { label: 'Products linked', value: isLoading ? '…' : linked, accent: 'gold' },
      ]} />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search collection name…" createLabel="New collection" onCreate={handleCreate} onRefresh={() => void refreshWithToast(refetch, 'Collections refreshed')} />
      <GlassTable icon={Layers} title={`Collections · ${filtered.length} results`} footer={`Showing ${filtered.length} of ${rows.length} — live from database`}>
        {filtered.length === 0 && !isLoading ? (
          <div className="admin-empty-state admin-catalog-empty">
            <p className="admin-empty-state__text">No collections yet. Click &apos;New collection&apos; to add one.</p>
          </div>
        ) : (
          <table className="admin-catalog-data-table">
            <thead><tr>{['Collection', 'Products', 'Slug', 'Visibility', 'Updated', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="admin-catalog-row">
                  <td className={cn(TD, 'admin-catalog-td--strong')}>{c.name}</td>
                  <td className={TD}>{c._count?.products ?? 0}</td>
                  <td className={cn(TD, 'admin-catalog-td--mono')}>/{c.slug}</td>
                  <td className={TD}><StatusPill value={c.isActive ? 'published' : 'draft'} /></td>
                  <td className={cn(TD, 'text-xs text-[var(--admin-text-muted)]')}>—</td>
                  <td className={TD}>
                    <AdminButton size="sm" onClick={() => toggleVisibility(c.id, c.name, c.isActive)}>
                      {c.isActive ? 'Hide' : 'Publish'}
                    </AdminButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassTable>
    </div>
  )
}

// ─── Inventory ─────────────────────────────────────────────────────────────────
const LOW_STOCK_MAX = 5

type StockFilter = 'all' | 'low' | 'out' | 'healthy'

function InventoryVariantAdjust({
  productId,
  variant,
  onSaved,
}: {
  productId: string
  variant: NonNullable<ApiProduct['variants']>[number]
  onSaved: () => void
}) {
  const [stock, setStock] = useState(String(variant.stock ?? 0))
  const updateVariant = useUpdateProductVariant()

  if (!variant.id) return null
  const variantId = variant.id
  const label = [variant.size, variant.colorName ?? variant.color].filter(Boolean).join(' / ') || variant.sku || 'Default'

  const save = async () => {
    const next = Number(stock)
    if (Number.isNaN(next) || next < 0) {
      toastFail('Enter a valid stock number.')
      return
    }
    const ok = await confirmVariantSaved(
      productId,
      variantId,
      { stock: next },
      () => updateVariant.mutateAsync({ productId, variantId, stock: next }),
    )
    if (ok) onSaved()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-[100px] text-xs font-bold">{label}</span>
      <span className="font-mono text-[10px] text-[var(--admin-text-muted)]">{variant.sku ?? '—'}</span>
      <input
        className="admin-input w-[72px] px-2 py-1 text-xs"
        value={stock}
        onChange={(e) => setStock(e.target.value)}
      />
      <AdminButton size="sm" loading={updateVariant.isPending} onClick={save}>
        Save
      </AdminButton>
    </div>
  )
}

function InventoryPanel() {
  const { navigate } = useAdminNavigate()
  const canCreateProducts = usePermission('products', 'create')
  const [query, setQuery] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data, isError, isLoading, refetch, isFetched } = useProducts({ limit: 100 })
  const { data: alerts, isError: alertsError } = useInventoryAlerts()
  const { data: liveCount, isError: liveCountError, isLoading: liveCountLoading } = usePublishedProductCount()

  const rows = useMemo(() => (data?.products ?? []).map((p) => {
    const stock = productStock(p)
    const reserved = p.variants?.reduce((s, v) => s + (v.reservedStock ?? 0), 0) ?? 0
    const status: 'out' | 'low' | 'healthy' =
      stock === 0 ? 'out' : stock <= LOW_STOCK_MAX ? 'low' : 'healthy'
    return {
      id: p.sku ?? p.id.slice(0, 8).toUpperCase(),
      linkId: p.id,
      name: p.name,
      variants: p.variants ?? [],
      onHand: stock,
      reserved,
      available: stock - reserved,
      status,
    }
  }), [data])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((i) => {
      const matchQ = !q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || i.linkId.toLowerCase().includes(q)
      const matchStock =
        stockFilter === 'all' ||
        (stockFilter === 'out' && i.status === 'out') ||
        (stockFilter === 'low' && i.status === 'low') ||
        (stockFilter === 'healthy' && i.status === 'healthy')
      return matchQ && matchStock
    })
  }, [query, stockFilter, rows])

  const low = alerts?.lowStock ?? rows.filter((i) => i.status === 'low').length
  const out = alerts?.outOfStock ?? rows.filter((i) => i.status === 'out').length
  const unitsOnHand = rows.reduce((s, i) => s + i.onHand, 0)

  if (isError) {
    return <ApiOfflineBanner message="API offline — inventory reads from live product stock on port 4000." />
  }

  return (
    <div className="settings-section-enter admin-module-page">
      <div className="mb-3">
        <ModuleLiveStrip
          items={[
            {
              label: 'Product stock API',
              value: isFetched ? `${rows.length} SKUs loaded` : 'Connecting…',
              ok: isFetched && !isError,
              hint: 'GET /admin/products',
            },
            {
              label: 'Inventory alerts',
              value: alertsError ? 'Unreachable' : `${low} low · ${out} out`,
              ok: !alertsError && alerts !== undefined,
              hint: 'GET /admin/dashboard/inventory-alerts',
            },
            {
              label: 'Storefront live',
              value: liveCountLoading ? '…' : `${liveCount ?? 0} published`,
              ok: !liveCountError,
            },
          ]}
        />
      </div>

      <PanelHeader icon={Archive} title="Inventory" kpis={[
        { label: 'SKUs tracked', value: isLoading ? '…' : rows.length },
        { label: 'Low stock', value: isLoading ? '…' : low, accent: 'warning' },
        { label: 'Out of stock', value: isLoading ? '…' : out, accent: 'gold' },
        { label: 'Units on hand', value: isLoading ? '…' : unitsOnHand, accent: 'success' },
      ]} />

      {(low > 0 || out > 0) && (
        <div className="admin-catalog-alert" role="status">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            {out > 0 && `${out} variant(s) out of stock`}
            {out > 0 && low > 0 && ' · '}
            {low > 0 && `${low} variant(s) low stock (≤${LOW_STOCK_MAX})`}
          </span>
        </div>
      )}

      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Search SKU or product…"
        createLabel="Add product"
        onCreate={() => navigate('/dashboard/products/new')}
        createDisabled={!canCreateProducts}
        createDisabledTitle={PERMISSION_DENIED_TITLE}
        onRefresh={() => void refreshWithToast(refetch, 'Inventory refreshed')}
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {([
          ['all', 'All'],
          ['low', 'Low stock'],
          ['out', 'Out of stock'],
          ['healthy', 'In stock'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStockFilter(key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-bold transition',
              stockFilter === key
                ? 'border-[var(--admin-accent)] bg-[var(--admin-accent-muted)] text-[var(--admin-text-primary)]'
                : 'border-black/10 text-[var(--admin-text-muted)] hover:border-black/20 dark:border-white/10',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <GlassTable icon={Archive} title={`Inventory · ${filtered.length} results`} footer={`Live stock from ${rows.length} products · adjustments save to API`}>
        <table className="admin-catalog-data-table">
          <thead><tr>{['SKU', 'Product', 'On hand', 'Reserved', 'Available', 'Status', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((i) => (
              <Fragment key={i.linkId}>
                <tr className={cn('admin-catalog-row', expandedId === i.linkId && 'admin-catalog-row--open')}>
                  <td className={TD}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === i.linkId ? null : i.linkId)}
                      className="admin-catalog-link"
                    >
                      {i.id}
                      <ChevronDown
                        className={cn('admin-catalog-product__chevron', expandedId === i.linkId && 'admin-catalog-product__chevron--open')}
                        aria-hidden
                      />
                    </button>
                  </td>
                  <td className={TD}>
                    <button
                      type="button"
                      className="admin-catalog-link font-bold text-[var(--admin-text-primary)]"
                      onClick={() => navigate(`/dashboard/products/${i.linkId}`)}
                    >
                      {i.name}
                    </button>
                  </td>
                  <td className={cn(TD, 'admin-catalog-td--strong', i.onHand === 0 && 'admin-catalog-td--danger', i.onHand > 0 && i.onHand <= LOW_STOCK_MAX && 'admin-catalog-td--warn')}>
                    {i.onHand}
                  </td>
                  <td className={cn(TD, 'text-xs text-[var(--admin-text-muted)]')}>{i.reserved}</td>
                  <td className={cn(TD, 'admin-catalog-td--strong')}>{i.available}</td>
                  <td className={TD}>
                    <StatusPill value={i.status === 'out' ? 'out of stock' : i.status === 'low' ? 'low stock' : 'healthy'} />
                  </td>
                  <td className={TD}>
                    <RowActionsMenu
                      recordName={i.name}
                      moduleHref="/dashboard/inventory"
                      recordId={i.linkId}
                      actions={[
                        { label: 'Adjust stock', onClick: () => setExpandedId(i.linkId) },
                        { label: 'Edit product', onClick: () => navigate(`/dashboard/products/${i.linkId}/edit`) },
                        { label: 'Open product', onClick: () => navigate(`/dashboard/products/${i.linkId}`) },
                      ]}
                    />
                  </td>
                </tr>
                {expandedId === i.linkId && (
                  <tr className="admin-catalog-row-expand">
                    <td colSpan={7} className={TD}>
                      {i.variants.length === 0 ? (
                        <p className="m-0 text-xs text-[var(--admin-text-muted)]">No variants — add variants on the product edit page.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p className="admin-kpi__label m-0">Variant stock adjustment</p>
                          {i.variants.map((v) => (
                            <InventoryVariantAdjust
                              key={v.id ?? `${i.linkId}-${v.sku}`}
                              productId={i.linkId}
                              variant={v}
                              onSaved={() => void refetch()}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </GlassTable>
    </div>
  )
}

// ─── Brands ────────────────────────────────────────────────────────────────────
function BrandsPanel() {
  const [query, setQuery] = useState('')
  const { data, isError, isLoading, refetch } = useBrands()
  const createBrand = useCreateBrand()
  const updateBrand = useUpdateBrand()
  const rows = useMemo(() => data?.brands ?? [], [data])
  const filtered = useMemo(() => { const q = query.toLowerCase(); return rows.filter((b) => !q || b.name.toLowerCase().includes(q) || (b.vendorLabel ?? '').toLowerCase().includes(q)) }, [query, rows])

  const active = rows.filter((b) => b.isActive).length
  const vendors = new Set(rows.map((b) => b.vendorLabel ?? '—')).size
  const products = rows.reduce((s, b) => s + (b.productCount ?? 0), 0)

  const handleCreate = async () => {
    const name = window.prompt('Brand name')
    if (!name?.trim()) return
    const vendorLabel = window.prompt('Vendor label (e.g. In-house)', 'In-house') ?? 'In-house'
    const trimmed = name.trim()
    const ok = await confirmBrandSaved(
      { name: trimmed },
      () => createBrand.mutateAsync({ name: trimmed, vendorLabel }),
    )
    if (ok) void refetch()
  }

  const toggleActive = async (id: string, name: string, isActive: boolean) => {
    const next = !isActive
    const ok = await confirmBrandToggled(
      id,
      next,
      name,
      () => updateBrand.mutateAsync({ id, isActive: next }),
    )
    if (ok) void refetch()
  }

  if (isError) return <ApiOfflineBanner message="API offline — start API on port 4000, then run `pnpm db:push`." />

  return (
    <div className="settings-section-enter admin-module-page">
      <PanelHeader icon={Award} title="Brands" kpis={[
        { label: 'Brands', value: isLoading ? '…' : rows.length },
        { label: 'Active', value: isLoading ? '…' : active, accent: 'success' },
        { label: 'Vendors', value: isLoading ? '…' : vendors, accent: 'gold' },
        { label: 'Products', value: isLoading ? '…' : products },
      ]} />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search brand or vendor…" createLabel="Add brand" onCreate={handleCreate} onRefresh={() => void refreshWithToast(refetch, 'Brands refreshed')} />
      <GlassTable icon={Award} title={`Brands · ${filtered.length} results`} footer="Live brands from database — no demo rows">
        <table className="admin-catalog-data-table">
          <thead><tr>{['Slug', 'Brand', 'Products', 'Vendor', 'Country', 'Status', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="admin-catalog-row">
                <td className={cn(TD, 'admin-catalog-td--mono')}>{b.slug}</td>
                <td className={cn(TD, 'admin-catalog-td--strong')}>{b.name}</td>
                <td className={TD}>{b.productCount ?? 0}</td>
                <td className={cn(TD, 'text-xs')}>{b.vendorLabel ?? '—'}</td>
                <td className={cn(TD, 'text-xs')}>{b.country}</td>
                <td className={TD}><StatusPill value={b.isActive ? 'active' : 'draft'} /></td>
                <td className={TD}><AdminButton size="sm" onClick={() => toggleActive(b.id, b.name, b.isActive)}>{b.isActive ? 'Deactivate' : 'Activate'}</AdminButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassTable>
    </div>
  )
}

// ─── Attributes ────────────────────────────────────────────────────────────────
function AttributesPanel() {
  const [query, setQuery] = useState('')
  const { data, isError, isLoading, refetch } = useProducts({ limit: 100 })
  const attributes = useMemo(() => {
    const products = data?.products ?? []
    const sizes = new Set<string>()
    const colors = new Set<string>()
    const fabrics = new Set<string>()
    let withFit = 0
    products.forEach((p) => {
      p.variants?.forEach((v) => { if (v.size) sizes.add(v.size); if (v.color || v.colorName) colors.add(v.colorName ?? v.color ?? '') })
      if (p.fabricContent) fabrics.add(p.fabricContent)
      if (p.fitType) withFit++
    })
    return [
      { id: 'size', name: 'Size', type: 'Select', values: sizes.size, products: products.length, status: 'active' as const },
      { id: 'color', name: 'Color', type: 'Swatch', values: colors.size, products: products.length, status: 'active' as const },
      { id: 'fabric', name: 'Fabric', type: 'Select', values: fabrics.size, products: products.filter((p) => p.fabricContent).length, status: fabrics.size ? 'active' as const : 'draft' as const },
      { id: 'fit', name: 'Fit', type: 'Select', values: withFit, products: withFit, status: withFit ? 'active' as const : 'draft' as const },
    ]
  }, [data])

  const filtered = useMemo(() => { const q = query.toLowerCase(); return attributes.filter((a) => !q || a.name.toLowerCase().includes(q)) }, [query, attributes])

  const exportAttributes = () => {
    if (!filtered.length) {
      toastFail('Nothing to export.')
      return
    }
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`splaro-attributes-${date}.csv`, [
      ['ID', 'Attribute', 'Type', 'Values', 'Used in products', 'Status'],
      ...filtered.map((a) => [a.id, a.name, a.type, String(a.values), String(a.products), a.status]),
    ])
    toastOk(`Exported ${filtered.length} attribute${filtered.length === 1 ? '' : 's'}.`)
  }

  if (isError) return <ApiOfflineBanner message="API offline — attributes are derived from live product variants." />

  return (
    <div className="settings-section-enter admin-module-page">
      <PanelHeader icon={Tags} title="Attributes" kpis={[
        { label: 'Attributes', value: attributes.length },
        { label: 'Option values', value: attributes.reduce((s, a) => s + a.values, 0), accent: 'gold' },
        { label: 'Products', value: isLoading ? '…' : data?.products?.length ?? 0, accent: 'success' },
        { label: 'Draft', value: attributes.filter((a) => a.status === 'draft').length, accent: 'warning' },
      ]} />
      <Toolbar
        query={query} onQuery={setQuery} placeholder="Search attribute name…"
        createLabel="Add attribute"
        createDisabled
        onCreate={() => {}}
        onRefresh={() => void refetch()}
        onExport={exportAttributes}
      />
      <GlassTable icon={Tags} title={`Attributes · ${filtered.length} results`} footer="Derived from live product data — not demo rows">
        <table className="admin-catalog-data-table">
          <thead><tr>{['ID', 'Attribute', 'Type', 'Values', 'Used in', 'Status', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="admin-catalog-row">
                <td className={cn(TD, 'admin-catalog-td--mono')}>{a.id}</td>
                <td className={cn(TD, 'admin-catalog-td--strong')}>{a.name}</td>
                <td className={cn(TD, 'text-xs')}>{a.type}</td>
                <td className={TD}>{a.values}</td>
                <td className={cn(TD, 'text-xs')}>{a.products} products</td>
                <td className={TD}><StatusPill value={a.status} /></td>
                <td className={TD}><RowActionsMenu recordName={a.name} moduleHref="/dashboard/attributes" recordId={a.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassTable>
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
const PANELS: Record<string, () => React.ReactNode> = {
  '/dashboard/products':          ProductsPanel,
  '/dashboard/product-reviews':   () => <ProductReviewsPanel />,
  '/dashboard/collections':       CollectionsPanel,
  '/dashboard/categories':        () => <LiveCategoriesPanel />,
  '/dashboard/inventory':         InventoryPanel,
  '/dashboard/brands':            BrandsPanel,
  '/dashboard/attributes':        AttributesPanel,
  '/dashboard/sku-manager':       () => <LiveProductCodesPanel mode="sku" />,
  '/dashboard/qr-manager':        () => <LiveProductCodesPanel mode="qr" />,
  '/dashboard/barcode-manager':   () => <LiveProductCodesPanel mode="barcode" />,
}

export function CatalogModulePanel(props: ModuleContextProps) {
  const { moduleHref, subPath } = props
  if (moduleHref === '/dashboard/products' && subPath?.[0] && subPath[0] !== 'new') {
    const recordId = subPath[subPath.length - 1] === 'edit' ? subPath[subPath.length - 2] : subPath[0]
    if (recordId) return <ProductEditPanel productId={recordId} moduleHref={moduleHref} />
  }
  const Panel = PANELS[moduleHref]
  return renderModuleSubPanel(Panel, props)
}
