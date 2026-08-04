import type { ApiProduct, CreateProductInput } from '@/lib/api/products'
import { DEFAULT_COLOUR_HEX } from '@/lib/admin/colour-names'

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function num(v: number | string | null | undefined, fallback = 0): number {
  if (v == null || v === '') return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Build a create payload that duplicates a product as a draft.
 * Stock uses `defaultStock` (not live inventory). SKU / barcode / QR are cleared.
 */
export function buildCloneProductPayload(
  product: ApiProduct,
  opts?: { defaultStock?: number },
): CreateProductInput {
  const defaultStock = Math.max(0, opts?.defaultStock ?? 0)
  const baseName = product.name.trim() || 'Product'
  const name = baseName.endsWith(' (copy)') ? baseName : `${baseName} (copy)`
  const baseSlug = slugify(product.slug?.trim() || baseName) || 'product'
  const slug = `${baseSlug}-copy`.replace(/-copy-copy$/, '-copy')
  const basePrice = num(product.basePrice)
  const compareAt = product.compareAtPrice != null ? num(product.compareAtPrice) : null
  const imageUrls = (product.images ?? [])
    .map((img) => img.url)
    .filter((url): url is string => Boolean(url?.trim()))

  const variants = (product.variants ?? [])
    .filter((v) => v.isActive !== false)
    .map((v) => {
      const row: NonNullable<CreateProductInput['variants']>[number] = {
        price: num(v.price, basePrice),
        stock: defaultStock,
        isActive: true,
      }
      if (v.size) row.size = v.size
      const colorName = v.colorName || v.color
      if (colorName) row.colorName = colorName
      if (v.colorHex) row.colorHex = v.colorHex
      if (v.image) row.image = v.image
      if (v.compareAtPrice != null) row.compareAtPrice = num(v.compareAtPrice)
      else if (compareAt != null) row.compareAtPrice = compareAt
      return row
    })

  const sizes = [
    ...new Set(
      variants.map((v) => v.size?.trim()).filter((s): s is string => Boolean(s)),
    ),
  ]
  const colors = [
    ...new Map(
      variants
        .filter((v) => v.colorName?.trim())
        .map((v) => [
          v.colorName!.trim().toLowerCase(),
          {
            name: v.colorName!.trim(),
            hex: v.colorHex || DEFAULT_COLOUR_HEX,
            ...(v.image ? { image: v.image } : {}),
          },
        ]),
    ).values(),
  ]

  const payload: CreateProductInput = {
    name,
    slug,
    basePrice,
    isPublished: false,
    isHidden: false,
    status: 'DRAFT',
    lowStockThreshold: product.lowStockThreshold ?? 5,
    defaultStock,
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
  }

  if (product.description) payload.description = product.description
  if (product.shortDescription) payload.shortDescription = product.shortDescription
  if (compareAt != null && compareAt > basePrice) payload.compareAtPrice = compareAt
  if (product.costPrice != null) payload.costPrice = num(product.costPrice)
  if (product.tags?.length) payload.tags = product.tags
  const categoryId = product.categoryId ?? product.category?.id
  if (categoryId) payload.categoryId = categoryId
  const collectionId = product.collections?.[0]?.collectionId
  if (collectionId) payload.collectionId = collectionId
  if (imageUrls[0]) payload.imageUrl = imageUrls[0]
  if (imageUrls.length) payload.imageUrls = imageUrls
  if (product.fabricContent) payload.fabricContent = product.fabricContent
  if (product.fitType) payload.fitType = product.fitType
  if (product.occasion) payload.occasion = product.occasion
  if (product.careInstructions) payload.careInstructions = product.careInstructions
  if (product.season) payload.season = product.season
  if (product.metaTitle) payload.metaTitle = product.metaTitle
  if (product.metaDescription) payload.metaDescription = product.metaDescription
  if (product.weight != null) payload.weight = num(product.weight)
  if (product.badge) payload.badge = product.badge
  if (sizes.length) payload.sizes = sizes
  if (colors.length) payload.colors = colors
  if (variants.length) payload.variants = variants

  return payload
}
