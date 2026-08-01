'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import { useProducts } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { deleteProduct, permanentlyDeleteProduct, type ApiProduct } from '@/lib/api/products'
import { resolveMediaUrl } from '@/lib/media-url'

const TABS = ['All', 'Active', 'Draft', 'Out of stock'] as const
type Tab = (typeof TABS)[number]

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const th = {
  textAlign: 'left' as const,
  padding: '9px 14px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

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

function DcProductsBody() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('All')
  const [query, setQuery] = useState('')
  const [removeTarget, setRemoveTarget] = useState<ApiProduct | null>(null)
  const [removing, setRemoving] = useState(false)

  const products = useProducts({ limit: 200 })
  const { api } = useAdminConnection(25_000)
  const pageStatus = dcPageStatus([products], api.pulse)
  const all = useMemo(() => products.data?.products ?? [], [products.data])

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: all.length, Active: 0, Draft: 0, 'Out of stock': 0 }
    for (const p of all) c[tabOf(p)] = (c[tabOf(p)] ?? 0) + 1
    return c
  }, [all])

  const lowStock = useMemo(
    () => all.filter((p) => { const s = stockOf(p); return s > 0 && s <= (p.lowStockThreshold ?? 5) }).length,
    [all],
  )
  const publishedOutOfStock = useMemo(
    () => all.filter((p) => p.isPublished && stockOf(p) === 0).length,
    [all],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((p) => {
      if (tab !== 'All' && tabOf(p) !== tab) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
      )
    })
  }, [all, tab, query])

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
        await deleteProduct(target.id)
        toastOk(`"${target.name}" archived — off the storefront, still in the books.`)
      } else {
        await permanentlyDeleteProduct(target.id)
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
        syncLabel={products.isFetching ? 'syncing…' : `${all.length} SKUs`}
        syncing={products.isFetching}
        onSync={() => void products.refetch()}
        actions={[
          {
            label: 'Upload CSV',
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
      ) : all.length === 0 ? (
        <DcEmptyState
          icon="icon-package"
          title="No products yet"
          body="The storefront has nothing to sell until the first product is published. Add one product with a photo, price and stock to open the shop."
          cta="Add product"
          onCta={() => router.push('/dashboard/products/new')}
        />
      ) : (
        <>
          <MobileProductsList
            products={rows}
            tab={tab}
            counts={counts}
            query={query}
            onQuery={setQuery}
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
            <Kpi label="Total SKUs" value={String(all.length)} sub={`${counts['Active'] ?? 0} live on store`} />
            <Kpi
              label="Drafts"
              value={String(counts['Draft'] ?? 0)}
              sub="hidden from the storefront"
            />
            <Kpi
              label="Low stock"
              value={String(lowStock)}
              sub="at or below reorder point"
              color={lowStock > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
            <Kpi
              label="Out of stock"
              value={String(counts['Out of stock'] ?? 0)}
              sub={`${publishedOutOfStock} still published`}
              color={publishedOutOfStock > 0 ? 'var(--bad)' : 'var(--ink)'}
            />
          </div>

          <div style={{ ...card, overflow: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                borderBottom: '1px solid var(--line)',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 34,
                  padding: '0 11px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  minWidth: 240,
                }}
              >
                <DcIcon name="icon-search" size={14} color="var(--ink-3)" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search product or SKU…"
                  aria-label="Search products"
                  style={{
                    flex: 1,
                    border: 0,
                    background: 'transparent',
                    outline: 'none',
                    color: 'var(--ink)',
                    font: `400 13px/1 ${FONT}`,
                  }}
                />
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {rows.length} of {all.length}
              </span>
              <button
                type="button"
                onClick={() => router.push('/dashboard/bulk')}
                className="dc-hover-ink"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 30,
                  padding: '0 11px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  font: `600 12px/1 ${FONT}`,
                }}
              >
                <DcIcon name="icon-list-checks" size={13} />
                <span>Bulk edit</span>
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Product</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Variants</th>
                  <th style={th}>Stock</th>
                  <th style={{ ...th, textAlign: 'right' }}>Price</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>
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
                      className="dc-hover-surface"
                      style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                    >
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
                        {p.sku ?? '—'}
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
              </table>
            </div>
          </div>
          </div>
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
                    {status} · {p.sku ?? 'no SKU'} · {stock === 0 ? 'out' : `${stock} units`}
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
      style={{
        ...card,
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
