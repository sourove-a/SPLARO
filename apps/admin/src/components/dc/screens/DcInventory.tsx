'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import { useInventoryAlerts, useProducts } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { AdminButton } from '@/components/ui/AdminButton'
import type { ApiProduct } from '@/lib/api/products'
import { downloadCsv } from '@/lib/admin/admin-actions'
import { toastOk, toastWarn } from '@/lib/admin/feedback'
import { buildStickerRows, printVariantStickers } from '@/lib/admin/variant-stickers'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 11px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const th = {
  textAlign: 'left' as const,
  padding: '9px 15px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

function stockOf(p: ApiProduct): number {
  return (p.variants ?? []).reduce((sum, v) => sum + (v.stockQuantity ?? v.stock ?? 0), 0)
}

function reservedOf(p: ApiProduct): number {
  return (p.variants ?? []).reduce((sum, v) => sum + (v.reservedStock ?? 0), 0)
}

export function DcInventory() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="inventory" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <Suspense fallback={<DcLoadingState blocks={[{ t: 'kpis' } as DcBlock]} />}>
        <DcInventoryBody />
      </Suspense>
    </DcScreenProvider>
  )
}

function DcInventoryBody() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lowStockRef = useRef<HTMLDivElement>(null)
  const [skuFocus, setSkuFocus] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const stock = searchParams.get('stock')?.toLowerCase()
    if (stock === 'low') {
      lowStockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const sku = searchParams.get('sku')?.trim()
    if (sku) setSkuFocus(sku)
  }, [searchParams])

  /*
   * Search runs on the server so a Product Code, barcode or variant SKU finds
   * its item anywhere in the catalogue. Filtering here only ever searched the
   * page already loaded, and matched name/SKU/category — never the number
   * printed on the item someone is holding.
   */
  const debouncedQuery = useDebouncedValue(query.trim(), 300)
  const products = useProducts({
    ...(debouncedQuery ? { search: debouncedQuery } : {}),
    limit: 100,
  })
  const alerts = useInventoryAlerts()
  const { api } = useAdminConnection(25_000)

  const all = useMemo(() => products.data?.products ?? [], [products.data])

  const units = all.reduce((sum, p) => sum + stockOf(p), 0)
  const reserved = all.reduce((sum, p) => sum + reservedOf(p), 0)
  const retailValue = all.reduce((sum, p) => sum + stockOf(p) * Number(p.basePrice || 0), 0)

  const low = useMemo(
    () =>
      all
        .filter((p) => {
          const s = stockOf(p)
          return s > 0 && s <= (p.lowStockThreshold ?? 5)
        })
        .sort((a, b) => stockOf(a) - stockOf(b)),
    [all],
  )
  const out = useMemo(() => all.filter((p) => stockOf(p) === 0), [all])
  const publishedOut = useMemo(() => out.filter((p) => p.isPublished), [out])

  const focusedProduct = useMemo(() => {
    if (!skuFocus) return null
    const key = skuFocus.toLowerCase()
    return (
      all.find((p) => p.id === skuFocus || (p.sku ?? '').toLowerCase() === key) ?? null
    )
  }, [all, skuFocus])

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OK' | 'LOW' | 'OUT'>('ALL')

  const stockStatus = (p: ApiProduct): { label: string; tone: DcTone } => {
    const onHand = stockOf(p)
    const threshold = p.lowStockThreshold ?? 5
    if (onHand <= 0) return { label: 'Out', tone: 'bad' }
    if (onHand <= threshold) return { label: 'Low', tone: 'warn' }
    return { label: 'OK', tone: 'ok' }
  }

  const tableRows = useMemo(() => {
    // The server has already applied the search; only the stock-status chips
    // are resolved here, because "low" is per-product against its own reorder
    // point and is not a filter the list endpoint offers.
    let filtered = all
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((p) => {
        const s = stockStatus(p).label.toUpperCase()
        return s === statusFilter
      })
    }
    return [...filtered].sort((a, b) => stockOf(a) - stockOf(b) || a.name.localeCompare(b.name))
  }, [all, statusFilter])

  const pageStatus = dcPageStatus([products, alerts], api.pulse)

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'decide', title: '', items: [] } as DcBlock,
    { t: 'table', title: '', cols: [], rows: [] } as DcBlock,
  ]

  const exportCsv = () => {
    if (all.length === 0) {
      toastWarn('No inventory records to export')
      return
    }
    const headers = [
      'Product Name',
      'SKU',
      'Category',
      'On Hand',
      'Reserved',
      'Reorder At',
      'List Price (BDT)',
      'Total Value (BDT)',
      'Status',
    ]
    const csvRows = [
      headers,
      ...all.map((p) => {
        const onHand = stockOf(p)
        const price = Number(p.basePrice || 0)
        return [
          p.name,
          p.sku ?? '—',
          p.category?.name ?? 'Uncategorised',
          String(onHand),
          String(reservedOf(p)),
          String(p.lowStockThreshold ?? 5),
          String(price),
          String(onHand * price),
          stockStatus(p).label,
        ]
      }),
    ]
    downloadCsv(`splaro-inventory-${new Date().toISOString().slice(0, 10)}.csv`, csvRows)
    toastOk(`Exported ${all.length} inventory records`)
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Catalog"
        title="Inventory"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          products.isFetching
            ? 'syncing…'
            : focusedProduct
              ? `SKU · ${focusedProduct.sku ?? focusedProduct.id}`
              : searchParams.get('stock') === 'low'
                ? `${low.length} low-stock SKU${low.length === 1 ? '' : 's'}`
                : `${all.length} SKUs · ${units.toLocaleString('en-IN')} units`
        }
        syncing={products.isFetching}
        onSync={() => {
          void products.refetch()
          void alerts.refetch()
        }}
        actions={[
          {
            label: 'Stock movements',
            icon: 'icon-arrow-up-down',
            onClick: () => router.push('/dashboard/wms/stock-movements'),
          },
          {
            label: 'Restock PO',
            icon: 'icon-plus',
            onClick: () => router.push('/dashboard/procurement/purchase-orders'),
          },
          {
            label: 'Print stickers',
            icon: 'icon-printer',
            onClick: () => {
              if (tableRows.length === 0) {
                toastWarn('Nothing to print — no SKUs match this view.')
                return
              }
              printVariantStickers(buildStickerRows(tableRows))
            },
          },
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
          },
        ]}
      />

      {products.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : products.error ? (
        <DcErrorState
          error={`GET /admin/products → ${products.error instanceof Error ? products.error.message : '500 Internal Server Error'}`}
          hint="Stock levels are unaffected — only this view failed to load."
          onRetry={() => void products.refetch()}
        />
      ) : all.length === 0 ? (
        <DcEmptyState
          icon="icon-archive"
          title="Nothing in the catalog yet"
          body="Stock is counted per variant. Add a product with at least one variant and its levels appear here."
          cta="Add product"
          onCta={() => router.push('/dashboard/products/new')}
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {focusedProduct ? (
            <div
              style={{
                ...card,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                Showing inventory for {focusedProduct.name}
              </span>
              <span style={{ font: `400 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                SKU {focusedProduct.sku ?? focusedProduct.id} · {stockOf(focusedProduct)} on hand
              </span>
              <div style={{ flex: 1 }} />
              <AdminButton
                variant="primary"
                onClick={() => router.push(`/dashboard/products/${focusedProduct.id}/edit`)}
              >
                Open product
              </AdminButton>
            </div>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi
              label="Units on hand"
              value={units.toLocaleString('en-IN')}
              sub={`across ${all.length} SKU${all.length === 1 ? '' : 's'}`}
            />
            <Kpi
              label="Reserved"
              value={reserved.toLocaleString('en-IN')}
              sub="held against open orders"
              color={reserved > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
            <Kpi label="Retail value" value={formatTaka(retailValue)} sub="at current list price" />
            <Kpi
              label="Out of stock"
              value={String(out.length)}
              sub={`${publishedOut.length} still published`}
              color={publishedOut.length > 0 ? 'var(--bad)' : 'var(--ink)'}
            />
          </div>

          {publishedOut.length > 0 ? (
            <div style={{ ...card, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '13px 16px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 9,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  Published with nothing to sell
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 60,
                    font: `400 11.5px/1.4 ${FONT}`,
                    color: 'var(--ink-3)',
                  }}
                >
                  these pages still take add-to-carts — every visit is a lost sale
                </span>
              </div>
              <div
                style={{
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(330px, 100%), 1fr))',
                  gap: 10,
                }}
              >
                {publishedOut.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    style={{
                      ...card,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      borderColor: 'var(--bad-bd, var(--line))',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ font: `600 13px/1.2 ${FONT}`, color: 'var(--ink)', flex: 1 }}>
                        {p.name}
                      </span>
                      <span
                        style={{
                          padding: '3px 7px',
                          borderRadius: 6,
                          font: `600 10.5px/1 ${FONT}`,
                          background: 'var(--bad-soft, var(--surface-2))',
                          color: 'var(--bad)',
                        }}
                      >
                        Out of stock · still live
                      </span>
                    </div>
                    <span style={{ font: `500 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                      {p.sku ?? p.id} · {formatTaka(Number(p.basePrice || 0))}
                    </span>
                    <p style={{ font: `400 12px/1.4 ${FONT}`, color: 'var(--ink-2)' }}>
                      Restock or unpublish — leaving it live keeps the page indexed but unbuyable.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/products/${p.id}/edit`)}
                      style={{
                        alignSelf: 'flex-start',
                        height: 32,
                        padding: '0 12px',
                        borderRadius: 8,
                        border: 0,
                        background: 'var(--violet-solid)',
                        color: 'var(--on-violet)',
                        font: `600 12px/1 ${FONT}`,
                        cursor: 'pointer',
                      }}
                    >
                      Open product
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ ...card, padding: '6px 16px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 8px' }}>
              <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                Stock alerts
              </span>
              {low.length > 0 || (alerts.data?.outOfStock ?? 0) > 0 ? (
                <button
                  type="button"
                  onClick={() => lowStockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink-2)',
                    font: `600 11px/1 ${FONT}`,
                    cursor: 'pointer',
                  }}
                >
                  Jump to low stock
                </button>
              ) : null}
            </div>
            <AlertRow
              icon="icon-circle-x"
              tone="bad"
              title="Out of stock"
              sub="zero available across all variants"
              value={alerts.data ? String(alerts.data.outOfStock) : '—'}
            />
            <AlertRow
              icon="icon-triangle-alert"
              tone="warn"
              title="Low stock"
              sub="at or below the reorder point"
              value={alerts.data ? String(alerts.data.lowStock) : '—'}
            />
          </div>

          {low.length > 0 ? (
          <div ref={lowStockRef} style={{ ...card, overflow: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 15px',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                Below reorder point
              </span>
              <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {low.length} SKU{low.length === 1 ? '' : 's'} · each against its own threshold
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Product</th>
                  <th style={th}>SKU</th>
                  <th style={{ ...th, textAlign: 'right' }}>On hand</th>
                  <th style={{ ...th, textAlign: 'right' }}>Reserved</th>
                  <th style={{ ...th, textAlign: 'right' }}>Reorder at</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cover</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {low.map((p) => {
                  const onHand = stockOf(p)
                  const threshold = p.lowStockThreshold ?? 5
                  const pct = Math.min(100, Math.round((onHand / Math.max(threshold, 1)) * 100))
                  const tone = toneStyle(onHand <= threshold / 2 ? 'bad' : 'warn')
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/dashboard/products/${p.id}/edit`)}
                      className="dc-hover-surface"
                      style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '10px 15px' }}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ font: `500 13px/1.25 ${FONT}`, color: 'var(--ink)' }}>
                            {p.name}
                          </span>
                          <span style={{ font: `400 11.5px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>
                            {p.category?.name ?? 'Uncategorised'}
                          </span>
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '10px 15px',
                          font: `500 12px/1 ${MONO}`,
                          color: 'var(--ink-2)',
                        }}
                      >
                        {p.sku ?? '—'}
                      </td>
                      <td
                        style={{
                          padding: '10px 15px',
                          textAlign: 'right',
                          font: `600 13px/1 ${MONO}`,
                          color: tone.fg,
                        }}
                      >
                        {onHand}
                      </td>
                      <td
                        style={{
                          padding: '10px 15px',
                          textAlign: 'right',
                          font: `600 13px/1 ${MONO}`,
                          color: 'var(--ink-2)',
                        }}
                      >
                        {reservedOf(p)}
                      </td>
                      <td
                        style={{
                          padding: '10px 15px',
                          textAlign: 'right',
                          font: `600 13px/1 ${MONO}`,
                          color: 'var(--ink-2)',
                        }}
                      >
                        {threshold}
                      </td>
                      <td style={{ padding: '10px 15px' }}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            justifyContent: 'flex-end',
                          }}
                        >
                          <span
                            style={{
                              display: 'block',
                              width: 54,
                              height: 5,
                              borderRadius: 99,
                              background: 'var(--surface-3)',
                              overflow: 'hidden',
                            }}
                          >
                            <span
                              style={{
                                display: 'block',
                                height: 5,
                                borderRadius: 99,
                                width: `${pct}%`,
                                background: tone.fg,
                              }}
                            />
                          </span>
                          <span
                            style={{
                              font: `600 11.5px/1 ${MONO}`,
                              color: tone.fg,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {pct}%
                          </span>
                        </span>
                      </td>
                      <td>
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
                          {onHand <= threshold / 2 ? 'Critical' : 'Low'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
          ) : null}

          <div className="dc-mobile-route-panel" aria-label="Inventory">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 0 4px',
              }}
            >
              <label
                style={{
                  flex: 1,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 10px',
                  border: '1px solid var(--line)',
                  borderRadius: 9,
                  background: 'var(--surface-2)',
                }}
              >
                <DcIcon name="icon-search" size={13} color="var(--ink-3)" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Product Code, SKU, barcode or name…"
                  className="dc-nav-filter"
                  style={{
                    width: '100%',
                    border: 0,
                    outline: 0,
                    background: 'transparent',
                    color: 'var(--ink)',
                    font: `400 12px/1 ${FONT}`,
                  }}
                />
              </label>
            </div>
            <div className="dc-mobile-list">
              {tableRows.map((p) => {
                const status = stockStatus(p)
                const tone = toneStyle(status.tone)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="dc-mobile-list-card"
                    onClick={() => router.push(`/dashboard/products/${p.id}/edit`)}
                  >
                    <span
                      className="dc-mobile-list-card__icon"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      <DcIcon name="icon-archive" size={15} />
                    </span>
                    <span className="dc-mobile-list-card__copy">
                      <span className="dc-mobile-list-card__title">{p.name}</span>
                      <span className="dc-mobile-list-card__sub">
                        {p.sku ?? '—'} · {status.label}
                        {reservedOf(p) > 0 ? ` · ${reservedOf(p)} reserved` : ''}
                      </span>
                    </span>
                    <span className="dc-mobile-list-card__value">{stockOf(p)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="dc-desktop-route-panel">
            <div style={{ ...card, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 15px',
                  borderBottom: '1px solid var(--line)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200, flexWrap: 'wrap' }}>
                  <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)', marginRight: 6 }}>
                    All SKUs
                    <span style={{ marginLeft: 6, font: `500 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                      {tableRows.length}
                    </span>
                  </span>
                  {(['ALL', 'OK', 'LOW', 'OUT'] as const).map((st) => {
                    const active = statusFilter === st
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        style={{
                          padding: '4px 9px',
                          borderRadius: 7,
                          border: `1px solid ${active ? 'var(--violet-bd)' : 'var(--line)'}`,
                          background: active ? 'var(--violet-soft)' : 'var(--surface-2)',
                          color: active ? 'var(--violet)' : 'var(--ink-2)',
                          font: `600 11px/1 ${FONT}`,
                          cursor: 'pointer',
                        }}
                      >
                        {st === 'ALL' ? 'ALL' : st === 'OK' ? 'IN STOCK' : st === 'LOW' ? 'LOW STOCK' : 'OUT OF STOCK'}
                      </button>
                    )
                  })}
                </div>
                <label
                  style={{
                    width: 'min(260px, 100%)',
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 10px',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    background: 'var(--surface-2)',
                  }}
                >
                  <DcIcon name="icon-search" size={13} color="var(--ink-3)" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Product Code, SKU, barcode or name…"
                    className="dc-nav-filter"
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
              {tableRows.length === 0 ? (
                <div
                  style={{
                    padding: '32px 20px',
                    textAlign: 'center',
                    font: `400 12.5px/1.55 ${FONT}`,
                    color: 'var(--ink-3)',
                  }}
                >
                  No SKUs match this search.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>Product</th>
                        <th style={th}>SKU</th>
                        <th style={{ ...th, textAlign: 'right' }}>On hand</th>
                        <th style={{ ...th, textAlign: 'right' }}>Reserved</th>
                        <th style={{ ...th, textAlign: 'right' }}>Reorder at</th>
                        <th style={th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((p) => {
                        const onHand = stockOf(p)
                        const threshold = p.lowStockThreshold ?? 5
                        const status = stockStatus(p)
                        const tone = toneStyle(status.tone)
                        return (
                          <tr
                            key={p.id}
                            onClick={() => router.push(`/dashboard/products/${p.id}/edit`)}
                            className="dc-hover-surface"
                            style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                          >
                            <td style={{ padding: '10px 15px' }}>
                              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ font: `500 13px/1.25 ${FONT}`, color: 'var(--ink)' }}>
                                  {p.name}
                                </span>
                                <span style={{ font: `400 11.5px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>
                                  {p.category?.name ?? 'Uncategorised'}
                                </span>
                              </span>
                            </td>
                            <td style={{ padding: '10px 15px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                              {p.sku ?? '—'}
                            </td>
                            <td
                              style={{
                                padding: '10px 15px',
                                textAlign: 'right',
                                font: `600 13px/1 ${MONO}`,
                                color: tone.fg,
                              }}
                            >
                              {onHand}
                            </td>
                            <td
                              style={{
                                padding: '10px 15px',
                                textAlign: 'right',
                                font: `600 13px/1 ${MONO}`,
                                color: 'var(--ink-2)',
                              }}
                            >
                              {reservedOf(p)}
                            </td>
                            <td
                              style={{
                                padding: '10px 15px',
                                textAlign: 'right',
                                font: `600 13px/1 ${MONO}`,
                                color: 'var(--ink-2)',
                              }}
                            >
                              {threshold}
                            </td>
                            <td style={{ padding: '10px 15px' }}>
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
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function AlertRow({
  icon,
  tone,
  title,
  sub,
  value,
}: {
  icon: string
  tone: DcTone
  title: string
  sub: string
  value: string
}) {
  const t = toneStyle(tone)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '10px 0',
        borderTop: '1px solid var(--line)',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 28,
          height: 28,
          flex: 'none',
          borderRadius: 8,
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          color: t.fg,
        }}
      >
        <DcIcon name={icon} size={13} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ font: `500 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{title}</span>
        <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
      </span>
      <span style={{ flex: 'none', font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
        {value}
      </span>
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
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={capsLabel}>{label}</span>
      <span
        style={{ font: `700 25px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
