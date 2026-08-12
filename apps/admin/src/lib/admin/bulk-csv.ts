import { csvRowsToObjects, parseCsvText } from '@/lib/admin/csv-parse'
import { fetchAllProductsForCatalog } from '@/lib/admin/product-catalog-sheet'
import type { ApiProduct } from '@/lib/api/products'

export type BulkImportMode = 'stock' | 'price' | 'publish'

export interface BulkPreviewRow {
  line: number
  key: string
  /** What the row would set. */
  value: string
  /** What the catalogue holds right now, so the operator sees the delta. */
  current?: string
  /** Product name behind the SKU — a bare SKU is not enough to approve a write. */
  label?: string
  status: 'ok' | 'reject'
  reason?: string
  payload?: Record<string, unknown>
}

export interface BulkDryRunResult {
  rows: BulkPreviewRow[]
  /** Rows the CSV contained, before validation. */
  parsed: number
}

const HEADERS: Record<BulkImportMode, string[]> = {
  stock: ['sku', 'stock'],
  price: ['sku', 'price', 'compare_at_price'],
  publish: ['sku', 'published'],
}

const SAMPLE: Record<BulkImportMode, string[]> = {
  stock: ['SPL-EXAMPLE', '12'],
  price: ['SPL-EXAMPLE', '1990', '2490'],
  publish: ['SPL-EXAMPLE', 'true'],
}

/** Header row + one filled example, so the file is never ambiguous. */
export function templateFor(mode: BulkImportMode): string[][] {
  return [HEADERS[mode], SAMPLE[mode]]
}

export function templateName(mode: BulkImportMode, format: 'csv' | 'xlsx' = 'csv'): string {
  const base = `splaro-bulk-${mode}-template`
  return format === 'xlsx' ? `${base}.xlsx` : `${base}.csv`
}

function truthy(v: string): boolean {
  const n = v.trim().toLowerCase()
  return n === '1' || n === 'true' || n === 'yes' || n === 'published' || n === 'publish'
}

interface VariantRef {
  variantId: string
  productId: string
  /** Present so the preview can show the value the row would overwrite. */
  stock?: number | undefined
  price?: number | undefined
  name: string
}

function buildSkuMaps(products: ApiProduct[]) {
  const skuToVariant = new Map<string, VariantRef>()
  const skuToProduct = new Map<string, string>()
  const productMeta = new Map<string, { name: string; isPublished?: boolean | undefined }>()

  for (const p of products) {
    productMeta.set(p.id, { name: p.name, isPublished: p.isPublished })
    for (const v of p.variants ?? []) {
      const sku = v.sku?.trim()
      if (!sku || !v.id) continue
      skuToVariant.set(sku.toLowerCase(), {
        variantId: v.id,
        productId: p.id,
        stock: typeof v.stock === 'number' ? v.stock : undefined,
        price: v.price === undefined || v.price === null ? undefined : Number(v.price),
        name: p.name,
      })
      skuToProduct.set(sku.toLowerCase(), p.id)
    }
    if (p.sku?.trim()) skuToProduct.set(p.sku.trim().toLowerCase(), p.id)
  }
  return { skuToVariant, skuToProduct, productMeta }
}

/**
 * Validates bulk field-update rows against the live catalogue without writing.
 */
export function dryRunBulkObjects(
  mode: BulkImportMode,
  objects: Record<string, string>[],
  products: ApiProduct[],
): BulkDryRunResult {
  if (objects.length === 0) {
    return { rows: [], parsed: 0 }
  }

  const { skuToVariant, skuToProduct, productMeta } = buildSkuMaps(products)
  const rows: BulkPreviewRow[] = []

  objects.forEach((row, index) => {
    // +2: line 1 is the header, and spreadsheets are 1-indexed.
    const line = index + 2
    const sku = (row.sku ?? row.variant_sku ?? '').trim()
    const variantId = (row.variant_id ?? row.variantid ?? '').trim()
    const productId = (row.product_id ?? row.productid ?? '').trim()

    if (mode === 'stock') {
      const stockRaw = row.stock ?? row.qty ?? row.quantity ?? ''
      const stock = Number(stockRaw)
      if (!variantId && !sku) {
        rows.push({
          line,
          key: '—',
          value: stockRaw,
          status: 'reject',
          reason: 'sku or variant_id required',
        })
        return
      }
      if (!Number.isFinite(stock) || stock < 0) {
        rows.push({
          line,
          key: sku || variantId,
          value: stockRaw,
          status: 'reject',
          reason: 'invalid stock',
        })
        return
      }
      const ref = skuToVariant.get(sku.toLowerCase())
      const resolved = variantId || ref?.variantId
      if (!resolved) {
        rows.push({
          line,
          key: sku || variantId,
          value: String(stock),
          status: 'reject',
          reason: 'SKU not found',
        })
        return
      }
      rows.push({
        line,
        key: sku || variantId,
        value: String(stock),
        ...(ref?.stock === undefined ? {} : { current: String(ref.stock) }),
        ...(ref?.name ? { label: ref.name } : {}),
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
        rows.push({
          line,
          key: '—',
          value: priceRaw,
          status: 'reject',
          reason: 'sku, variant_id or product_id required',
        })
        return
      }
      if (!Number.isFinite(price) || price < 0) {
        rows.push({
          line,
          key: sku || variantId || productId,
          value: priceRaw,
          status: 'reject',
          reason: 'invalid price',
        })
        return
      }
      if (compareAtPrice !== undefined && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)) {
        rows.push({
          line,
          key: sku || variantId,
          value: priceRaw,
          status: 'reject',
          reason: 'invalid compare price',
        })
        return
      }
      const priceRef = sku ? skuToVariant.get(sku.toLowerCase()) : undefined
      const resolvedVariantId = variantId || priceRef?.variantId
      const resolvedProductId =
        productId ||
        priceRef?.productId ||
        (sku ? skuToProduct.get(sku.toLowerCase()) : undefined)

      // SKU-only rows must resolve in the live catalogue — do not mark unknown SKUs ok.
      if (sku && !variantId && !productId && !priceRef) {
        rows.push({
          line,
          key: sku,
          value: String(price),
          status: 'reject',
          reason: 'SKU not found',
        })
        return
      }
      if (!resolvedVariantId && !resolvedProductId && !sku) {
        rows.push({
          line,
          key: variantId || productId || '—',
          value: String(price),
          status: 'reject',
          reason: 'SKU not found',
        })
        return
      }

      rows.push({
        line,
        key: sku || variantId || productId,
        value: String(price),
        ...(priceRef?.price === undefined ? {} : { current: String(priceRef.price) }),
        ...(priceRef?.name ? { label: priceRef.name } : {}),
        status: 'ok',
        payload: {
          ...(resolvedVariantId ? { variantId: resolvedVariantId } : {}),
          ...(sku ? { sku } : {}),
          ...(resolvedProductId ? { productId: resolvedProductId } : {}),
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
      rows.push({
        line,
        key: sku || productId,
        value: pubRaw,
        status: 'reject',
        reason: 'product not found',
      })
      return
    }
    const meta = productMeta.get(pid)
    rows.push({
      line,
      key: sku || pid,
      value: isPublished ? 'published' : 'hidden',
      ...(meta?.isPublished === undefined
        ? {}
        : { current: meta.isPublished ? 'published' : 'hidden' }),
      ...(meta?.name ? { label: meta.name } : {}),
      status: 'ok',
      payload: { productId: pid, isPublished },
    })
  })

  return { rows, parsed: objects.length }
}

/**
 * Validates a bulk CSV against the live catalogue without writing anything.
 */
async function fetchAllProductsForDryRun(): Promise<ApiProduct[]> {
  return fetchAllProductsForCatalog()
}

export async function dryRunBulkCsv(
  mode: BulkImportMode,
  text: string,
): Promise<BulkDryRunResult> {
  const objects = csvRowsToObjects(parseCsvText(text))
  if (objects.length === 0) {
    return { rows: [], parsed: 0 }
  }
  return dryRunBulkObjects(mode, objects, await fetchAllProductsForDryRun())
}

export async function dryRunBulkFromObjects(
  mode: BulkImportMode,
  objects: Record<string, string>[],
): Promise<BulkDryRunResult> {
  if (objects.length === 0) return { rows: [], parsed: 0 }
  return dryRunBulkObjects(mode, objects, await fetchAllProductsForDryRun())
}
