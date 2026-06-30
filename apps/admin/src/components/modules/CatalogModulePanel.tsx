'use client'

import { Fragment, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { refreshWithToast } from '@/lib/admin/feedback'
import { AlertTriangle, Archive, Award, ChevronDown, Download, Layers, Package, Plus, Printer, RefreshCw, Search, Tags } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { useBrands, useCollections, useCreateBrand, useCreateCollection, useProducts, useDeleteProduct, useUpdateCollection, useUpdateBrand } from '@/lib/api/hooks'
import { productStatus, productStock, type ApiProduct } from '@/lib/api/products'
import { formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { LiveCategoriesPanel } from '@/components/modules/LiveCategoriesPanel'
import { LiveProductCodesPanel } from '@/components/modules/LiveProductCodesPanel'
import { ProductEditPanel } from '@/components/modules/ProductEditPanel'
import { useAdminNavigate } from '@/lib/navigation/client-nav'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'

// ─── Design tokens (theme-aware via CSS variables) ────────────────────────────
const STATUS_MAP: Record<string, { bg: string; text: string; border: string }> = {
  active:   { bg: 'rgba(22,163,74,0.12)',  text: '#86d4a8', border: 'rgba(134,212,168,0.28)' },
  draft:    { bg: 'rgba(255,255,255,0.08)', text: 'var(--admin-text-secondary)', border: 'rgba(255,255,255,0.12)' },
  archived: { bg: 'rgba(255,255,255,0.06)', text: 'var(--admin-text-muted)', border: 'rgba(255,255,255,0.1)' },
  low:      { bg: 'rgba(255,255,255,0.08)', text: 'var(--admin-text-secondary)', border: 'rgba(255,255,255,0.12)' },
  warning:  { bg: 'rgba(239,68,68,0.12)',  text: '#f0a8a8', border: 'rgba(239,68,68,0.28)' },
}

function StatusPill({ value }: { value: string }) {
  const fallback = { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' }
  const s = STATUS_MAP[value.toLowerCase()] ?? fallback
  return (
    <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
}

function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const accentColor =
    accent === 'gold' ? 'var(--admin-accent)' :
    accent === 'success' ? '#86d4a8' :
    accent === 'warning' ? 'var(--admin-text-secondary)' :
    '#a5b4fc'
  const accentBg =
    accent === 'gold' ? 'var(--admin-accent-muted)' :
    accent === 'success' ? 'rgba(134,212,168,0.12)' :
    accent === 'warning' ? 'rgba(255,255,255,0.08)' :
    'rgba(99,102,241,0.12)'
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${accentColor} 60%, transparent), transparent)` }} />
      <div style={{ width: 28, height: 28, borderRadius: 8, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />
      </div>
      <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--admin-text-primary)', lineHeight: 1, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 0 }}>{label}</p>
    </div>
  )
}

function PanelHeader({ icon: Icon, title, kpis, children }: { icon: React.ElementType; title: string; kpis: [string, string | number, string?][]; children?: React.ReactNode }) {
  return (
    <div className="admin-panel-glass" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div className="admin-catalog-icon-ring" style={{ width: 40, height: 40, borderRadius: 12 }}>
          <Icon style={{ width: 18, height: 18 }} strokeWidth={2} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{title}</h3>
        {children}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 10 }}>
        {kpis.map(([label, value, accent]) => (
          <KpiCard key={label} label={label} value={value} {...(accent !== undefined ? { accent } : {})} />
        ))}
      </div>
    </div>
  )
}

function Toolbar({
  query, onQuery, placeholder,
  createLabel, onCreate,
  onRefresh, onExport,
  tabs, activeTab, onTab,
  extra,
}: {
  query: string; onQuery: (v: string) => void; placeholder?: string
  createLabel?: string; onCreate?: () => void
  onRefresh?: () => void; onExport?: () => void
  tabs?: { key: string; label: string; count: number }[]
  activeTab?: string; onTab?: (k: string) => void
  extra?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 380 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--admin-text-muted)', pointerEvents: 'none' }} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder ?? 'Search…'}
            className="admin-catalog-input"
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onCreate && (
            <button type="button" onClick={onCreate} className="admin-catalog-action admin-catalog-action--primary">
              <Plus style={{ width: 13, height: 13 }} />
              {createLabel}
            </button>
          )}
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="admin-catalog-action">
              <RefreshCw style={{ width: 12, height: 12 }} />
            </button>
          )}
          {onExport && (
            <button type="button" onClick={onExport} className="admin-catalog-action">
              <Download style={{ width: 12, height: 12 }} />
            </button>
          )}
        </div>
        {extra}
      </div>
      {/* Tabs */}
      {tabs && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab?.(t.key)}
              className={cn('admin-catalog-tab', activeTab === t.key && 'admin-catalog-tab--active')}
            >
              {t.label} · {t.count}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GlassTable({ title, footer, icon: Icon, children }: { title: string; footer?: string; icon?: React.ElementType; children: React.ReactNode }) {
  const I = Icon ?? Package
  return (
    <div className="admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--admin-table-row-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="admin-catalog-icon-ring" style={{ width: 28, height: 28, borderRadius: 8 }}>
          <I style={{ width: 13, height: 13 }} />
        </div>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>{title}</p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        {children}
      </div>
      {footer && (
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--admin-table-row-border)', fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)' }}>
          {footer}
        </div>
      )}
    </div>
  )
}

const TH = 'admin-catalog-th'
const TD = 'admin-catalog-td'

function ErrorBanner({ msg }: { msg: string }) {
  return <div className="admin-panel-glass-subtle" style={{ padding: '12px 16px', borderLeft: '3px solid #ef4444', color: '#f0a8a8', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{msg}</div>
}

// ─── Products ──────────────────────────────────────────────────────────────────
type ProductStatus = 'active' | 'draft' | 'archived'

function mapApiProduct(p: ApiProduct) {
  const stock = productStock(p)
  return { id: p.sku ?? p.id.slice(0, 8).toUpperCase(), linkId: p.id, name: p.name, category: p.category?.name ?? 'Uncategorized', brand: p.category?.name ?? '—', variants: p._count?.variants ?? p.variants?.length ?? 0, stock, price: Number(p.basePrice), status: productStatus(p) }
}

function ProductsPanel() {
  const { navigate } = useAdminNavigate()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data: apiData, isError, isLoading, refetch } = useProducts({ limit: 50 })
  const deleteProduct = useDeleteProduct()
  const catalog = useMemo(() => (apiData?.products ? apiData.products.map(mapApiProduct) : []), [apiData])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return catalog.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      const matchS = statusFilter === 'all' || p.status === statusFilter
      return matchQ && matchS
    })
  }, [query, statusFilter, catalog])

  const handleArchive = (linkId: string, name: string) => {
    if (!window.confirm(`Archive "${name}"? It will be hidden from the storefront.`)) return
    deleteProduct.mutate(linkId, {
      onSuccess: () => toast.success(`${name} archived.`),
      onError: () => toast.error('Could not archive product.'),
    })
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {isError && <ErrorBanner msg="API offline — start SPLARO API on port 4000 and run `pnpm db:seed`." />}
      <PanelHeader icon={Package} title="Products" kpis={[
        ['Total', catalog.length],
        ['Active', catalog.filter((p) => p.status === 'active').length, 'success'],
        ['Low stock', catalog.filter((p) => p.stock > 0 && p.stock <= 5).length, 'warning'],
        ['Catalog value', formatBDT(catalog.reduce((s, p) => s + p.price * Math.max(p.stock, 1), 0)), 'gold'],
      ]} />

      {catalog.some((p) => p.stock <= 5 && p.stock > 0) && (
        <div className="admin-panel-glass-subtle" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, borderLeft: '3px solid rgba(255,255,255,0.2)' }}>
          <AlertTriangle style={{ width: 14, height: 14, color: 'var(--admin-text-secondary)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--admin-text-secondary)' }}>
            {catalog.filter((p) => p.stock <= 5 && p.stock > 0).length} product(s) need restock
          </span>
        </div>
      )}

      <Toolbar
        query={query} onQuery={setQuery} placeholder="Search SKU, name, category…"
        createLabel="Add product" onCreate={() => navigate('/dashboard/products/new')}
        onRefresh={() => void refreshWithToast(refetch, 'Catalog synced')}
        onExport={() => toast.error('This action is not available yet — feature pending.')}
        tabs={[
          { key: 'all', label: 'All', count: catalog.length },
          { key: 'active', label: 'Active', count: catalog.filter((p) => p.status === 'active').length },
          { key: 'draft', label: 'Draft', count: catalog.filter((p) => p.status === 'draft').length },
          { key: 'archived', label: 'Archived', count: catalog.filter((p) => p.status === 'archived').length },
        ]}
        activeTab={statusFilter}
        onTab={(k) => setStatusFilter(k as ProductStatus | 'all')}
      />

      <GlassTable icon={Package} title={`Products · ${filtered.length} results`} footer={isLoading ? 'Loading products…' : `Showing ${filtered.length} of ${catalog.length} products`}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['SKU', 'Product', 'Category', 'Brand', 'Variants', 'Stock', 'Price', 'Status', ''].map((h) => (
                <th key={h} className={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <Fragment key={p.linkId}>
                <tr className={expandedId === p.linkId ? 'bg-[var(--admin-surface-hover)]' : undefined}>
                  <td className={TD}>
                    <button type="button" onClick={() => setExpandedId(expandedId === p.linkId ? null : p.linkId)} className="admin-catalog-link">
                      {p.id}
                      <ChevronDown style={{ width: 12, height: 12, transition: 'transform 0.2s', transform: expandedId === p.linkId ? 'rotate(180deg)' : 'none' }} />
                    </button>
                  </td>
                  <td className={TD} style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>{p.name}</td>
                  <td className={TD} style={{ fontSize: 12 }}>{p.category}</td>
                  <td className={TD} style={{ fontSize: 12 }}>{p.brand}</td>
                  <td className={TD} style={{ fontSize: 12 }}>{p.variants}</td>
                  <td className={TD} style={{ fontWeight: 800, color: p.stock === 0 ? '#f0a8a8' : p.stock <= 5 ? 'var(--admin-text-secondary)' : 'var(--admin-text-primary)' }}>{p.stock}</td>
                  <td className={TD} style={{ fontWeight: 800 }}>{formatBDT(p.price)}</td>
                  <td className={TD}><StatusPill value={p.status} /></td>
                  <td className={TD}><RowActionsMenu recordName={p.name} moduleHref="/dashboard/products" recordId={p.linkId} /></td>
                </tr>
                {expandedId === p.linkId && (
                  <tr>
                    <td colSpan={9} className={TD} style={{ background: 'var(--admin-surface-hover)', padding: '12px 20px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <a href={`/dashboard/products/${p.linkId}/edit`} className="admin-catalog-action admin-catalog-action--primary">Edit product</a>
                        <a href={`/dashboard/inventory?sku=${p.id}`} className="admin-catalog-action">View inventory</a>
                        <AdminButton className="!text-xs" onClick={() => toast.error('This action is not available yet — feature pending.')}>
                          <Printer className="h-3.5 w-3.5" /> Print label
                        </AdminButton>
                        <AdminButton className="!text-xs !text-red-700" loading={deleteProduct.isPending} onClick={() => handleArchive(p.linkId, p.name)}>
                          Archive
                        </AdminButton>
                      </div>
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

// ─── Collections ───────────────────────────────────────────────────────────────
function CollectionsPanel() {
  const [query, setQuery] = useState('')
  const { data, isError, isLoading, refetch } = useCollections()
  const createCollection = useCreateCollection()
  const updateCollection = useUpdateCollection()
  const rows = data?.collections ?? []
  const filtered = useMemo(() => { const q = query.toLowerCase(); return rows.filter((c) => !q || c.name.toLowerCase().includes(q)) }, [query, rows])

  const published = rows.filter((c) => c.isActive).length
  const linked = rows.reduce((s, c) => s + (c._count?.products ?? 0), 0)

  const handleCreate = () => {
    const name = window.prompt('Collection name')
    if (!name?.trim()) return
    createCollection.mutate({ name: name.trim() }, { onSuccess: () => toast.success('Collection created'), onError: (e) => toast.error(e.message) })
  }

  const toggleVisibility = (id: string, name: string, isActive: boolean) => {
    updateCollection.mutate({ id, isActive: !isActive }, { onSuccess: () => toast.success(`${name} ${isActive ? 'hidden' : 'published'}.`), onError: () => toast.error('Could not update collection.') })
  }

  if (isError) return <ErrorBanner msg="API offline — start API on port 4000, then run `pnpm db:push`." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <PanelHeader icon={Layers} title="Collections" kpis={[
        ['Collections', isLoading ? '…' : rows.length],
        ['Published', isLoading ? '…' : published, 'success'],
        ['Draft', isLoading ? '…' : rows.length - published, 'warning'],
        ['Products linked', isLoading ? '…' : linked, 'gold'],
      ]} />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search collection name…" createLabel="New collection" onCreate={handleCreate} onRefresh={() => void refreshWithToast(refetch, 'Collections refreshed')} />
      <GlassTable icon={Layers} title={`Collections · ${filtered.length} results`} footer={`Showing ${filtered.length} of ${rows.length} — live from database`}>
        {filtered.length === 0 && !isLoading ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No collections yet. Click &apos;New collection&apos; to add one.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Collection', 'Products', 'Slug', 'Visibility', 'Updated', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className={TD} style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>{c.name}</td>
                  <td className={TD}>{c._count?.products ?? 0}</td>
                  <td className={TD} style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--admin-text-secondary)' }}>/{c.slug}</td>
                  <td className={TD}><StatusPill value={c.isActive ? 'published' : 'draft'} /></td>
                  <td className={TD} style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>—</td>
                  <td className={TD}>
                    <AdminButton className="!text-xs" onClick={() => toggleVisibility(c.id, c.name, c.isActive)}>
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
function InventoryPanel() {
  const [query, setQuery] = useState('')
  const { data, isError, isLoading, refetch } = useProducts({ limit: 100 })
  const rows = useMemo(() => (data?.products ?? []).map((p) => {
    const stock = productStock(p)
    const reserved = p.variants?.reduce((s, v) => s + (v.reservedStock ?? 0), 0) ?? 0
    return { id: p.sku ?? p.id.slice(0, 8).toUpperCase(), linkId: p.id, name: p.name, onHand: stock, reserved, reorder: 10, status: stock === 0 ? 'low' : stock < 10 ? 'low' : 'active' }
  }), [data])

  const filtered = useMemo(() => { const q = query.toLowerCase(); return rows.filter((i) => !q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)) }, [query, rows])
  const low = rows.filter((i) => i.status === 'low').length
  const out = rows.filter((i) => i.onHand === 0).length

  if (isError) return <ErrorBanner msg="API offline — inventory reads from live product stock on port 4000." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <PanelHeader icon={Archive} title="Inventory" kpis={[
        ['SKUs tracked', isLoading ? '…' : rows.length],
        ['Low stock', isLoading ? '…' : low, 'warning'],
        ['Out of stock', isLoading ? '…' : out, 'gold'],
        ['Units on hand', isLoading ? '…' : rows.reduce((s, i) => s + i.onHand, 0), 'success'],
      ]} />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search SKU or product…" createLabel="Add product" onCreate={() => window.location.assign('/dashboard/products/new')} onRefresh={() => void refreshWithToast(refetch, 'Inventory refreshed')} />
      <GlassTable icon={Archive} title={`Inventory · ${filtered.length} results`} footer={`Live stock from ${rows.length} products`}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['SKU', 'Product', 'Warehouse', 'On hand', 'Reserved', 'Reorder at', 'Available', 'Status', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.linkId}>
                <td className={TD} style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: 'var(--admin-text-secondary)' }}>{i.id}</td>
                <td className={TD} style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>{i.name}</td>
                <td className={TD} style={{ fontSize: 12 }}>Main</td>
                <td className={TD} style={{ fontWeight: 800, color: i.onHand === 0 ? '#f0a8a8' : i.onHand < 10 ? 'var(--admin-text-secondary)' : 'var(--admin-text-primary)' }}>{i.onHand}</td>
                <td className={TD} style={{ color: 'var(--admin-text-muted)', fontSize: 12 }}>{i.reserved}</td>
                <td className={TD} style={{ fontSize: 12 }}>{i.reorder}</td>
                <td className={TD} style={{ fontWeight: 800 }}>{i.onHand - i.reserved}</td>
                <td className={TD}><StatusPill value={i.status === 'low' ? 'low stock' : i.status} /></td>
                <td className={TD}><RowActionsMenu recordName={i.name} moduleHref="/dashboard/products" recordId={i.linkId} /></td>
              </tr>
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
  const rows = data?.brands ?? []
  const filtered = useMemo(() => { const q = query.toLowerCase(); return rows.filter((b) => !q || b.name.toLowerCase().includes(q) || (b.vendorLabel ?? '').toLowerCase().includes(q)) }, [query, rows])

  const active = rows.filter((b) => b.isActive).length
  const vendors = new Set(rows.map((b) => b.vendorLabel ?? '—')).size
  const products = rows.reduce((s, b) => s + (b.productCount ?? 0), 0)

  const handleCreate = () => {
    const name = window.prompt('Brand name')
    if (!name?.trim()) return
    const vendorLabel = window.prompt('Vendor label (e.g. In-house)', 'In-house') ?? 'In-house'
    createBrand.mutate({ name: name.trim(), vendorLabel }, { onSuccess: () => toast.success('Brand created'), onError: (e) => toast.error(e.message) })
  }

  const toggleActive = (id: string, name: string, isActive: boolean) => {
    updateBrand.mutate({ id, isActive: !isActive }, { onSuccess: () => toast.success(`${name} ${isActive ? 'deactivated' : 'activated'}.`), onError: () => toast.error('Could not update brand.') })
  }

  if (isError) return <ErrorBanner msg="API offline — start API on port 4000, then run `pnpm db:push`." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <PanelHeader icon={Award} title="Brands" kpis={[
        ['Brands', isLoading ? '…' : rows.length],
        ['Active', isLoading ? '…' : active, 'success'],
        ['Vendors', isLoading ? '…' : vendors, 'gold'],
        ['Products', isLoading ? '…' : products],
      ]} />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search brand or vendor…" createLabel="Add brand" onCreate={handleCreate} onRefresh={() => void refreshWithToast(refetch, 'Brands refreshed')} />
      <GlassTable icon={Award} title={`Brands · ${filtered.length} results`} footer="Live brands from database — no demo rows">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Slug', 'Brand', 'Products', 'Vendor', 'Country', 'Status', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id}>
                <td className={TD} style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--admin-text-secondary)' }}>{b.slug}</td>
                <td className={TD} style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>{b.name}</td>
                <td className={TD}>{b.productCount ?? 0}</td>
                <td className={TD} style={{ fontSize: 12 }}>{b.vendorLabel ?? '—'}</td>
                <td className={TD} style={{ fontSize: 12 }}>{b.country}</td>
                <td className={TD}><StatusPill value={b.isActive ? 'active' : 'draft'} /></td>
                <td className={TD}><AdminButton className="!text-xs" onClick={() => toggleActive(b.id, b.name, b.isActive)}>{b.isActive ? 'Deactivate' : 'Activate'}</AdminButton></td>
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

  if (isError) return <ErrorBanner msg="API offline — attributes are derived from live product variants." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <PanelHeader icon={Tags} title="Attributes" kpis={[
        ['Attributes', attributes.length],
        ['Option values', attributes.reduce((s, a) => s + a.values, 0), 'gold'],
        ['Products', isLoading ? '…' : data?.products?.length ?? 0, 'success'],
        ['Draft', attributes.filter((a) => a.status === 'draft').length, 'warning'],
      ]} />
      <Toolbar
        query={query} onQuery={setQuery} placeholder="Search attribute name…"
        createLabel="Add attribute"
        onCreate={() => toast('Custom attribute API coming soon — sizes/colors come from product variants.', { icon: 'ℹ️' })}
        onRefresh={() => void refetch()}
        onExport={() => toast.error('This action is not available yet — feature pending.')}
      />
      <GlassTable icon={Tags} title={`Attributes · ${filtered.length} results`} footer="Derived from live product data — not demo rows">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['ID', 'Attribute', 'Type', 'Values', 'Used in', 'Status', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td className={TD} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--admin-text-muted)' }}>{a.id}</td>
                <td className={TD} style={{ fontWeight: 700, color: 'var(--admin-text-primary)' }}>{a.name}</td>
                <td className={TD} style={{ fontSize: 12 }}>{a.type}</td>
                <td className={TD}>{a.values}</td>
                <td className={TD} style={{ fontSize: 12 }}>{a.products} products</td>
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
