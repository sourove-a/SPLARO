import type { ApiProduct } from '@/lib/api/products'
import { fetchProducts } from '@/lib/api/products'
import type { BulkPreviewRow } from '@/lib/admin/bulk-csv'

export const CATALOG_HEADERS = [
  'name',
  'name_bn',
  'product_sku',
  'slug',
  'category',
  'collection',
  'description',
  'description_bn',
  'short_description',
  'base_price',
  'compare_at_price',
  'cost_price',
  'published',
  'featured',
  'new_arrival',
  'best_seller',
  'badge',
  'rm_code',
  'tags',
  'fabric',
  'fit',
  'occasion',
  'season',
  'care',
  'image_url',
  'image_urls',
  'size',
  'color',
  'color_hex',
  'variant_sku',
  'barcode',
  'price',
  'stock',
] as const

export type CatalogHeader = (typeof CATALOG_HEADERS)[number]

export const CATALOG_SAMPLE_ROW: string[] = [
  'Sample Tee',
  'স্যাম্পল টি',
  'SPL-SAMPLE',
  'sample-tee',
  'Men',
  'Essentials',
  'Soft cotton tee',
  'নরম কটন টি',
  'Everyday essential',
  '1990',
  '2490',
  '800',
  'false',
  'false',
  'true',
  'false',
  'New',
  'RM-001',
  'cotton,casual',
  '100% cotton',
  'Regular',
  'Casual',
  'All season',
  'Machine wash cold',
  'https://example.com/tee-1.jpg',
  'https://example.com/tee-2.jpg | https://example.com/tee-3.jpg',
  'M',
  'Black',
  '',
  'SPL-SAMPLE-M-BLACK',
  '',
  '1990',
  '10',
]

export function catalogTemplateMatrix(): string[][] {
  return [[...CATALOG_HEADERS], [...CATALOG_SAMPLE_ROW]]
}

export function catalogTemplateName(format: 'csv' | 'xlsx'): string {
  return format === 'xlsx' ? 'splaro-catalog-template.xlsx' : 'splaro-catalog-template.csv'
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function truthy(v: string): boolean {
  const n = v.trim().toLowerCase()
  return n === '1' || n === 'true' || n === 'yes' || n === 'published' || n === 'publish'
}

function parseOptionalBool(raw: string): boolean | undefined {
  if (!raw.trim()) return undefined
  return truthy(raw)
}

function parseImageUrls(row: Record<string, string>): string[] {
  const urls: string[] = []
  const primary = (row.image_url ?? '').trim()
  if (primary) urls.push(primary)
  const extra = (row.image_urls ?? '').trim()
  if (extra) {
    for (const part of extra.split(/[|,]/)) {
      const u = part.trim()
      if (u && !urls.includes(u)) urls.push(u)
    }
  }
  return urls
}

function schemaString(markup: ApiProduct['schemaMarkup'], key: string): string {
  if (!markup || typeof markup !== 'object') return ''
  const value = markup[key]
  return typeof value === 'string' ? value : ''
}

/** Flatten live products into one sheet row per variant. */
export function productsToSheetRows(products: ApiProduct[]): string[][] {
  const rows: string[][] = [[...CATALOG_HEADERS]]
  for (const p of products) {
    const variants = p.variants?.length
      ? p.variants
      : [
          {
            sku: p.sku,
            size: '',
            color: '',
            colorName: '',
            colorHex: '',
            barcode: p.barcode,
            price: p.basePrice,
            stock: 0,
          },
        ]
    const images = (p.images ?? []).map((img) => img.url).filter(Boolean)
    const imageUrl = images[0] ?? ''
    const imageUrls = images.slice(1).join(' | ')
    const collection = p.collections?.[0]?.collection?.name ?? ''
    for (const v of variants) {
      rows.push([
        cell(p.name),
        cell(schemaString(p.schemaMarkup, 'nameBn')),
        cell(p.sku),
        cell(p.slug),
        cell(p.category?.name),
        cell(collection),
        cell(p.description),
        cell(schemaString(p.schemaMarkup, 'descriptionBn')),
        cell(p.shortDescription),
        cell(p.basePrice),
        cell(p.compareAtPrice),
        cell(p.costPrice),
        p.isPublished ? 'true' : 'false',
        p.isFeatured ? 'true' : 'false',
        p.isNewArrival ? 'true' : 'false',
        p.isBestSeller ? 'true' : 'false',
        cell(p.badge),
        cell(p.rmCode),
        cell((p.tags ?? []).join(',')),
        cell(p.fabricContent),
        cell(p.fitType),
        cell(p.occasion),
        cell(p.season),
        cell(p.careInstructions),
        cell(imageUrl),
        cell(imageUrls),
        cell(v.size),
        cell(v.colorName ?? v.color),
        cell(v.colorHex),
        cell(v.sku),
        cell(v.barcode),
        cell(v.price ?? p.basePrice),
        cell(typeof v.stock === 'number' ? v.stock : ''),
      ])
    }
  }
  return rows
}

export interface CatalogUpsertRow {
  name?: string
  nameBn?: string
  productSku: string
  slug?: string
  category?: string
  collection?: string
  description?: string
  descriptionBn?: string
  shortDescription?: string
  basePrice?: number
  compareAtPrice?: number | null
  costPrice?: number
  published?: boolean
  featured?: boolean
  newArrival?: boolean
  bestSeller?: boolean
  badge?: string
  rmCode?: string
  tags?: string[]
  fabric?: string
  fit?: string
  occasion?: string
  season?: string
  care?: string
  imageUrl?: string
  imageUrls?: string[]
  size?: string
  color?: string
  colorHex?: string
  variantSku?: string
  barcode?: string
  price?: number
  stock?: number
}

export const CATALOG_CHUNK_SIZE = 200

/** Paginate the full catalogue for dry-run matching. */
export async function fetchAllProductsForCatalog(): Promise<ApiProduct[]> {
  const all: ApiProduct[] = []
  let page = 1
  let totalPages = 1
  do {
    const res = await fetchProducts({ limit: 100, page })
    all.push(...res.products)
    totalPages = res.totalPages
    page += 1
  } while (page <= totalPages && page <= 500)
  return all
}

export function validateCatalogSheetHeaders(objects: Record<string, string>[]): string | null {
  if (objects.length === 0) return 'The file has a header but no data rows.'
  const keys = new Set(Object.keys(objects[0] ?? {}))
  const hasSku = keys.has('product_sku') || keys.has('variant_sku') || keys.has('sku')
  if (!hasSku) {
    return 'Missing product_sku or variant_sku column. Download the template and keep the header row exactly.'
  }
  return null
}

export function rejectRowsToMatrix(rows: BulkPreviewRow[]): string[][] {
  return [
    ['line', 'sku', 'product', 'reason'],
    ...rows
      .filter((r) => r.status === 'reject')
      .map((r) => [String(r.line), r.key, r.label ?? '', r.reason ?? '']),
  ]
}

export function summarizeCatalogDryRun(rows: BulkPreviewRow[]) {
  const ok = rows.filter((r) => r.status === 'ok')
  const creates = ok.filter((r) => r.value.startsWith('create')).length
  const updates = ok.filter((r) => r.value.startsWith('update')).length
  const draftWarnings = ok.filter((r) => r.reason?.includes('draft')).length
  return { creates, updates, draftWarnings, ok: ok.length, rejects: rows.length - ok.length }
}

export function chunkCatalogRows<T>(rows: T[], size = CATALOG_CHUNK_SIZE): T[][] {
  if (rows.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size))
  }
  return chunks
}

function parseOptionalNumber(raw: string): number | undefined {
  if (!raw.trim()) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : Number.NaN
}

/**
 * Validate catalog sheet rows against the live catalogue without writing.
 */
export function dryRunCatalogRows(
  objects: Record<string, string>[],
  products: ApiProduct[],
): { rows: BulkPreviewRow[]; parsed: number } {
  const byVariantSku = new Map<string, { product: ApiProduct; variantSku: string }>()
  const byProductSku = new Map<string, ApiProduct>()
  const byCombo = new Map<string, { product: ApiProduct; variantSku?: string | null }>()

  for (const p of products) {
    if (p.sku?.trim()) byProductSku.set(p.sku.trim().toLowerCase(), p)
    for (const v of p.variants ?? []) {
      if (v.sku?.trim()) {
        byVariantSku.set(v.sku.trim().toLowerCase(), {
          product: p,
          variantSku: v.sku.trim(),
        })
      }
      const combo = `${(p.sku ?? '').trim().toLowerCase()}::${(v.size ?? '').toLowerCase()}::${(v.colorName ?? v.color ?? '').toLowerCase()}`
      byCombo.set(combo, {
        product: p,
        ...(v.sku !== undefined ? { variantSku: v.sku } : {}),
      })
    }
  }

  const rows: BulkPreviewRow[] = []
  const seenVariantSkus = new Map<string, number>()
  const seenProductSkus = new Map<string, number>()

  objects.forEach((row, index) => {
    const line = index + 2
    const name = (row.name ?? '').trim()
    const productSku = (row.product_sku ?? row.sku ?? '').trim()
    const variantSku = (row.variant_sku ?? '').trim()
    const size = (row.size ?? '').trim()
    const color = (row.color ?? row.color_name ?? '').trim()
    const key = variantSku || productSku || name || '—'

    if (variantSku) {
      const dup = seenVariantSkus.get(variantSku.toLowerCase())
      if (dup) {
        rows.push({
          line,
          key: variantSku,
          value: name || productSku,
          status: 'reject',
          reason: `duplicate variant_sku in file (first on line ${dup})`,
        })
        return
      }
      seenVariantSkus.set(variantSku.toLowerCase(), line)
    }

    if (productSku && !variantSku) {
      const combo = `${productSku.toLowerCase()}::${size.toLowerCase()}::${color.toLowerCase()}`
      const dup = seenProductSkus.get(combo)
      if (dup) {
        rows.push({
          line,
          key: productSku,
          value: `${size}/${color}`,
          status: 'reject',
          reason: `duplicate product row in file (same size/color on line ${dup})`,
        })
        return
      }
      seenProductSkus.set(combo, line)
    }

    if (!productSku && !variantSku) {
      rows.push({
        line,
        key,
        value: name || '—',
        status: 'reject',
        reason: 'product_sku or variant_sku required',
      })
      return
    }

    const existingByVariant = variantSku
      ? byVariantSku.get(variantSku.toLowerCase())
      : undefined
    const existingByProduct = productSku
      ? byProductSku.get(productSku.toLowerCase())
      : existingByVariant?.product
    const comboKey = `${productSku.toLowerCase()}::${size.toLowerCase()}::${color.toLowerCase()}`
    const existingByCombo =
      !existingByVariant && productSku && (size || color) ? byCombo.get(comboKey) : undefined

    const isUpdate = Boolean(existingByVariant || existingByProduct || existingByCombo)
    if (!isUpdate && !name) {
      rows.push({
        line,
        key,
        value: productSku,
        status: 'reject',
        reason: 'name required to create a product',
      })
      return
    }

    const basePrice = parseOptionalNumber(row.base_price ?? '')
    const compareAtPrice = parseOptionalNumber(row.compare_at_price ?? '')
    const costPrice = parseOptionalNumber(row.cost_price ?? '')
    const price = parseOptionalNumber(row.price ?? row.base_price ?? '')
    const stock = parseOptionalNumber(row.stock ?? '')

    for (const [label, n] of [
      ['base_price', basePrice],
      ['compare_at_price', compareAtPrice],
      ['cost_price', costPrice],
      ['price', price],
      ['stock', stock],
    ] as const) {
      if (n !== undefined && Number.isNaN(n)) {
        rows.push({
          line,
          key,
          value: row[label] ?? '',
          status: 'reject',
          reason: `invalid ${label}`,
        })
        return
      }
      if (
        (label === 'price' || label === 'base_price' || label === 'stock') &&
        n !== undefined &&
        n < 0
      ) {
        rows.push({
          line,
          key,
          value: String(n),
          status: 'reject',
          reason: `${label} cannot be negative`,
        })
        return
      }
    }

    if (!isUpdate && price === undefined && basePrice === undefined) {
      rows.push({
        line,
        key,
        value: name,
        status: 'reject',
        reason: 'price or base_price required to create',
      })
      return
    }

    const published = parseOptionalBool(row.published ?? row.is_published ?? '')
    const featured = parseOptionalBool(row.featured ?? '')
    const newArrival = parseOptionalBool(row.new_arrival ?? '')
    const bestSeller = parseOptionalBool(row.best_seller ?? '')
    const tags = (row.tags ?? '')
      .split(/[,|]/)
      .map((t) => t.trim())
      .filter(Boolean)
    const imageList = parseImageUrls(row)

    const action = isUpdate ? 'update' : 'create'
    const label = existingByProduct?.name ?? existingByVariant?.product.name ?? name
    const draftNote =
      published === true &&
      !row.category?.trim() &&
      !(existingByProduct ?? existingByVariant?.product)?.categoryId
        ? 'published=true but no category — will save as draft'
        : undefined

    const payload: CatalogUpsertRow = {
      productSku: productSku || existingByVariant?.product.sku || variantSku,
      ...(name ? { name } : {}),
      ...(row.name_bn?.trim() ? { nameBn: row.name_bn.trim() } : {}),
      ...(row.slug?.trim() ? { slug: row.slug.trim() } : {}),
      ...(row.category?.trim() ? { category: row.category.trim() } : {}),
      ...(row.collection?.trim() ? { collection: row.collection.trim() } : {}),
      ...(row.description?.trim() ? { description: row.description.trim() } : {}),
      ...(row.description_bn?.trim() ? { descriptionBn: row.description_bn.trim() } : {}),
      ...(row.short_description?.trim()
        ? { shortDescription: row.short_description.trim() }
        : {}),
      ...(basePrice !== undefined ? { basePrice } : {}),
      ...(compareAtPrice !== undefined ? { compareAtPrice } : {}),
      ...(costPrice !== undefined ? { costPrice } : {}),
      ...(published !== undefined ? { published } : {}),
      ...(featured !== undefined ? { featured } : {}),
      ...(newArrival !== undefined ? { newArrival } : {}),
      ...(bestSeller !== undefined ? { bestSeller } : {}),
      ...(row.badge?.trim() ? { badge: row.badge.trim() } : {}),
      ...(row.rm_code?.trim() ? { rmCode: row.rm_code.trim() } : {}),
      ...(tags.length ? { tags } : {}),
      ...(row.fabric?.trim() ? { fabric: row.fabric.trim() } : {}),
      ...(row.fit?.trim() ? { fit: row.fit.trim() } : {}),
      ...(row.occasion?.trim() ? { occasion: row.occasion.trim() } : {}),
      ...(row.season?.trim() ? { season: row.season.trim() } : {}),
      ...(row.care?.trim() ? { care: row.care.trim() } : {}),
      ...(imageList[0] ? { imageUrl: imageList[0] } : {}),
      ...(imageList.length > 1 ? { imageUrls: imageList.slice(1) } : {}),
      ...(size ? { size } : {}),
      ...(color ? { color } : {}),
      ...(row.color_hex?.trim() ? { colorHex: row.color_hex.trim() } : {}),
      ...(variantSku ? { variantSku } : {}),
      ...(row.barcode?.trim() ? { barcode: row.barcode.trim() } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(stock !== undefined ? { stock } : {}),
    }

    rows.push({
      line,
      key,
      value: `${action} · ${size || '—'} / ${color || '—'} · ৳${price ?? basePrice ?? '—'}`,
      ...(label ? { label } : {}),
      ...(draftNote ? { reason: draftNote } : {}),
      status: 'ok',
      payload: payload as unknown as Record<string, unknown>,
    })
  })

  return { rows, parsed: objects.length }
}
