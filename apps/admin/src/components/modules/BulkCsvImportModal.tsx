'use client'

import { useCallback, useMemo, useState } from 'react'
import { AdminButton } from '@/components/ui/AdminButton'
import { csvRowsToObjects, parseCsvText } from '@/lib/admin/csv-parse'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import {
  bulkPublishProducts,
  bulkUpdatePrices,
  bulkUpdateStock,
  fetchProducts,
  type ApiProduct,
} from '@/lib/api/products'

export type BulkImportMode = 'stock' | 'price' | 'publish'

type PreviewRow = {
  line: number
  key: string
  value: string
  status: 'ok' | 'reject'
  reason?: string
  payload?: Record<string, unknown>
}

interface BulkCsvImportModalProps {
  open: boolean
  onClose: () => void
  initialMode?: BulkImportMode
}

function truthy(v: string) {
  const n = v.trim().toLowerCase()
  return n === '1' || n === 'true' || n === 'yes' || n === 'published' || n === 'publish'
}

function buildSkuMaps(products: ApiProduct[]) {
  const skuToVariant = new Map<string, { variantId: string; productId: string }>()
  const skuToProduct = new Map<string, string>()
  for (const p of products) {
    for (const v of p.variants ?? []) {
      const sku = v.sku?.trim()
      if (!sku || !v.id) continue
      skuToVariant.set(sku.toLowerCase(), { variantId: v.id, productId: p.id })
      skuToProduct.set(sku.toLowerCase(), p.id)
    }
    if (p.sku?.trim()) skuToProduct.set(p.sku.trim().toLowerCase(), p.id)
  }
  return { skuToVariant, skuToProduct }
}

export function BulkCsvImportModal({ open, onClose, initialMode = 'stock' }: BulkCsvImportModalProps) {
  const [mode, setMode] = useState<BulkImportMode>(initialMode)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [fileName, setFileName] = useState('')

  const okRows = useMemo(() => preview.filter((r) => r.status === 'ok'), [preview])
  const rejectRows = useMemo(() => preview.filter((r) => r.status === 'reject'), [preview])

  const reset = useCallback(() => {
    setPreview([])
    setFileName('')
  }, [])

  const dryRun = useCallback(
    async (file: File) => {
      setLoading(true)
      reset()
      setFileName(file.name)
      try {
        const text = await file.text()
        const table = parseCsvText(text)
        const objects = csvRowsToObjects(table)
        if (objects.length === 0) {
          toastFail('CSV is empty or has no data rows.')
          return
        }

        const { products } = await fetchProducts({ limit: 500 })
        const { skuToVariant, skuToProduct } = buildSkuMaps(products)
        const rows: PreviewRow[] = []

        objects.forEach((row, index) => {
          const line = index + 2
          const sku = (row.sku ?? row.variant_sku ?? '').trim()
          const variantId = (row.variant_id ?? row.variantid ?? '').trim()
          const productId = (row.product_id ?? row.productid ?? '').trim()

          if (mode === 'stock') {
            const stockRaw = row.stock ?? row.qty ?? row.quantity ?? ''
            const stock = Number(stockRaw)
            if (!variantId && !sku) {
              rows.push({ line, key: '—', value: stockRaw, status: 'reject', reason: 'sku or variant_id required' })
              return
            }
            if (!Number.isFinite(stock) || stock < 0) {
              rows.push({ line, key: sku || variantId, value: stockRaw, status: 'reject', reason: 'invalid stock' })
              return
            }
            const resolved = variantId || skuToVariant.get(sku.toLowerCase())?.variantId
            if (!resolved) {
              rows.push({ line, key: sku || variantId, value: String(stock), status: 'reject', reason: 'SKU not found' })
              return
            }
            rows.push({
              line,
              key: sku || variantId,
              value: String(stock),
              status: 'ok',
              payload: { variantId: resolved, stock },
            })
            return
          }

          if (mode === 'price') {
            const priceRaw = row.price ?? row.base_price ?? ''
            const price = Number(priceRaw)
            const compareRaw = row.compare_at_price ?? row.compare_price ?? ''
            const compareAtPrice = compareRaw ? Number(compareRaw) : undefined
            if (!variantId && !sku && !productId) {
              rows.push({ line, key: '—', value: priceRaw, status: 'reject', reason: 'sku, variant_id or product_id required' })
              return
            }
            if (!Number.isFinite(price) || price < 0) {
              rows.push({ line, key: sku || variantId || productId, value: priceRaw, status: 'reject', reason: 'invalid price' })
              return
            }
            if (compareAtPrice !== undefined && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)) {
              rows.push({ line, key: sku || variantId, value: priceRaw, status: 'reject', reason: 'invalid compare price' })
              return
            }
            rows.push({
              line,
              key: sku || variantId || productId,
              value: String(price),
              status: 'ok',
              payload: {
                ...(variantId ? { variantId } : {}),
                ...(sku ? { sku } : {}),
                ...(productId ? { productId } : {}),
                price,
                ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
              },
            })
            return
          }

          const pubRaw = row.published ?? row.is_published ?? row.publish ?? 'true'
          const isPublished = truthy(pubRaw)
          let pid = productId
          if (!pid && sku) pid = skuToProduct.get(sku.toLowerCase()) ?? ''
          if (!pid) {
            rows.push({ line, key: sku || productId, value: pubRaw, status: 'reject', reason: 'product not found' })
            return
          }
          rows.push({
            line,
            key: sku || pid,
            value: isPublished ? 'publish' : 'unpublish',
            status: 'ok',
            payload: { productId: pid, isPublished },
          })
        })

        setPreview(rows)
        if (rows.every((r) => r.status === 'reject')) {
          toastWarn('Every row was rejected — fix the CSV before applying.')
        }
      } catch (e) {
        toastFail(e instanceof Error ? e.message : 'Could not parse CSV')
      } finally {
        setLoading(false)
      }
    },
    [mode, reset],
  )

  const apply = useCallback(async () => {
    if (okRows.length === 0) {
      toastWarn('No valid rows to apply — run dry-run first.')
      return
    }
    if (rejectRows.length > 0) {
      toastWarn(`${rejectRows.length} row(s) still rejected — only valid rows will write.`)
    }

    setApplying(true)
    try {
      if (mode === 'stock') {
        const updates = okRows.map((r) => r.payload as { variantId: string; stock: number })
        const res = await bulkUpdateStock(updates)
        if (res.updated <= 0) {
          toastFail(`Stock bulk failed — ${res.failed} row(s) rejected by API.`)
          return
        }
        toastOk(`Stock updated for ${res.updated} variant(s).`)
      } else if (mode === 'price') {
        const updates = okRows.map(
          (r) =>
            r.payload as {
              variantId?: string
              sku?: string
              productId?: string
              price: number
              compareAtPrice?: number | null
            },
        )
        const res = await bulkUpdatePrices(updates)
        if (res.updated <= 0) {
          toastFail(`Price bulk failed — ${res.failed} row(s) rejected by API.`)
          return
        }
        toastOk(`Prices updated for ${res.updated} row(s).`)
      } else {
        const publishIds = okRows
          .filter((r) => (r.payload as { isPublished: boolean }).isPublished)
          .map((r) => (r.payload as { productId: string }).productId)
        const unpublishIds = okRows
          .filter((r) => !(r.payload as { isPublished: boolean }).isPublished)
          .map((r) => (r.payload as { productId: string }).productId)
        let updated = 0
        if (publishIds.length > 0) {
          const res = await bulkPublishProducts(publishIds, true)
          updated += res.updated
        }
        if (unpublishIds.length > 0) {
          const res = await bulkPublishProducts(unpublishIds, false)
          updated += res.updated
        }
        if (updated <= 0) {
          toastFail('Publish bulk returned zero updates.')
          return
        }
        toastOk(`Publish state updated for ${updated} product(s).`)
      }
      onClose()
      reset()
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Bulk apply failed')
    } finally {
      setApplying(false)
    }
  }, [mode, okRows, rejectRows, onClose, reset])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-import-title"
      onClick={onClose}
    >
      <div
        className="admin-modal w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal__header flex items-start justify-between gap-3">
          <div>
            <h2 id="bulk-import-title" className="text-base font-black text-[var(--admin-foundation-ink)]">
              Import CSV
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-foundation-ink-muted)]">
              Map columns → dry run → apply (verified API only)
            </p>
          </div>
          <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="admin-modal__body space-y-4 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {(['stock', 'price', 'publish'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? 'admin-btn admin-btn--primary admin-btn--sm' : 'admin-btn admin-btn--ghost admin-btn--sm'}
                onClick={() => {
                  setMode(m)
                  reset()
                }}
              >
                {m === 'stock' ? 'Stock' : m === 'price' ? 'Price' : 'Publish'}
              </button>
            ))}
          </div>

          <p className="text-xs text-[var(--admin-foundation-ink-muted)]">
            {mode === 'stock' && 'Columns: sku (or variant_id) + stock'}
            {mode === 'price' && 'Columns: sku (or variant_id / product_id) + price [+ compare_at_price]'}
            {mode === 'publish' && 'Columns: sku (or product_id) + published (true/false)'}
          </p>

          <input
            type="file"
            accept=".csv,text/csv"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void dryRun(file)
              e.target.value = ''
            }}
          />
          {fileName ? <p className="text-xs font-semibold text-[var(--admin-foundation-ink-secondary)]">{fileName}</p> : null}

          {preview.length > 0 ? (
            <div className="admin-data-table-wrap max-h-64 overflow-auto">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={`${r.line}-${r.key}`}>
                      <td>{r.line}</td>
                      <td>{r.key}</td>
                      <td>{r.value}</td>
                      <td className={r.status === 'ok' ? 'text-green-700' : 'text-amber-700'}>
                        {r.status === 'ok' ? 'OK' : r.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="admin-modal__footer flex justify-end gap-2">
          <AdminButton variant="ghost" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton
            variant="primary"
            loading={applying}
            disabled={loading || okRows.length === 0}
            onClick={() => void apply()}
          >
            Apply {okRows.length > 0 ? `${okRows.length} row(s)` : ''}
          </AdminButton>
        </div>
      </div>
    </div>
  )
}
