import { DELIVERY_ZONES } from '@splaro/config'
import type { StorefrontProduct } from '@/data/storefront'
import { productSlug } from '@/lib/catalog/index'
import { absoluteUrl, stripHtml, xmlEscape } from '@/lib/seo/site-url'
import { sanitizeStorefrontMaterial } from '@/lib/catalog/storefront-sanitize'

const HEX_COLOR_NAMES: Record<string, string> = {
  '#f2f0e8': 'Ivory',
  '#b8c6bd': 'Sage',
  '#111111': 'Black',
  '#121212': 'Onyx',
  '#222222': 'Charcoal',
  '#d8d6ce': 'Sand',
  '#1f2a2e': 'Deep Navy',
  '#253036': 'Forest',
  '#f6d6d2': 'Blush',
  '#ece7dd': 'Oat',
  '#f7c9d7': 'Rose',
  '#8dc7c8': 'Aqua',
  '#f1c34b': 'Sun',
  '#f5f5f0': 'Cloud',
  '#c9c1b5': 'Stone',
  '#f6efe5': 'Cream',
  '#d7bca2': 'Camel',
  '#dad6cc': 'Mist',
  '#e9d4ef': 'Lilac',
  '#f0b350': 'Amber',
  '#8fbfc6': 'Sky',
  '#dc2626': 'Red',
  '#ffffff': 'White',
  '#000000': 'Black',
  '#b6845c': 'Tan',
}

const NONSPECIFIC_COLORS = new Set([
  'multi',
  'multicolor',
  'various',
  'assorted',
  'n/a',
  'na',
  'default',
  'selected',
])

export function resolveHumanColorName(rawColor?: string, colorOptionName?: string): string {
  if (
    colorOptionName &&
    !colorOptionName.startsWith('#') &&
    !NONSPECIFIC_COLORS.has(colorOptionName.trim().toLowerCase())
  ) {
    return colorOptionName.trim()
  }
  if (!rawColor) return ''
  const trimmed = rawColor.trim()
  if (trimmed.startsWith('#')) {
    return HEX_COLOR_NAMES[trimmed.toLowerCase()] ?? ''
  }
  if (NONSPECIFIC_COLORS.has(trimmed.toLowerCase())) return ''
  return trimmed
}

/** Google Merchant `g:id` — unique, stable, ≤50 chars. Prefer DB variant id alone. */
export function merchantOfferId(variantDbId: string, itemGroupId: string): string {
  const primary = variantDbId.replace(/[^\w.-]/g, '_').slice(0, 50)
  if (primary) return primary
  return itemGroupId.replace(/[^\w.-]/g, '_').slice(0, 50)
}

export function merchantItemGroupId(product: Pick<StorefrontProduct, 'id' | 'code'>): string {
  return (product.code || product.id).replace(/[^\w.-]/g, '_').slice(0, 50)
}

function slugifyValue(val: string): string {
  return val
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function variantTitle(productName: string, colorName: string, size: string): string {
  const bits = [colorName, size].filter(Boolean)
  const base = productName.slice(0, bits.length ? 120 : 150)
  if (!bits.length) return base
  return `${base} — ${bits.join(' / ')}`.slice(0, 150)
}

/**
 * Bangladesh is not in Google’s product-level region allowlist.
 * One conservative national rate — no overlapping Dhaka `<g:region>` block.
 */
function bangladeshShippingXml(outsideDhakaCharge: number): string {
  const safeCharge =
    Number.isFinite(outsideDhakaCharge) && outsideDhakaCharge >= 0
      ? outsideDhakaCharge
      : DELIVERY_ZONES.OUTSIDE_DHAKA.charge
  const price = safeCharge.toFixed(2)
  return `      <g:shipping>
        <g:country>BD</g:country>
        <g:service>Standard Bangladesh</g:service>
        <g:price>${price} BDT</g:price>
      </g:shipping>`
}

type FeedVariantRow = {
  id: string
  dbId: string
  colorName: string
  size: string
  stock: number
  image?: string
}

function collectVariants(product: StorefrontProduct, itemGroupId: string): FeedVariantRow[] {
  if (product.variantRefs?.length) {
    return product.variantRefs
      .filter((ref) => ref.isActive !== false)
      .map((ref) => {
        const colorFromOptions = product.colorOptions?.find(
          (c) => c.hex.toLowerCase() === (ref.colorHex ?? '').toLowerCase(),
        )?.name
        const colorName = resolveHumanColorName(ref.colorHex, ref.colorName ?? colorFromOptions)
        return {
          id: merchantOfferId(ref.id, itemGroupId),
          dbId: ref.id,
          colorName,
          size: ref.size ?? '',
          stock: Number(ref.stock ?? 0),
          ...(ref.image ? { image: ref.image } : {}),
        }
      })
  }

  const colors = (product.colorOptions?.map((c) => c.name) ?? product.colors ?? [])
    .map((c) => resolveHumanColorName(c))
    .filter(Boolean)
  const sizes = product.sizes?.length ? product.sizes : ['']
  const cleanColors = colors.length ? colors : ['']
  const rows: FeedVariantRow[] = []

  for (const colorName of cleanColors) {
    for (const size of sizes) {
      const variantSuffix = [colorName, size].filter(Boolean).map(slugifyValue).join('-')
      const rawId = variantSuffix ? `${itemGroupId}-${variantSuffix}` : itemGroupId
      const id = merchantOfferId(rawId, itemGroupId)
      rows.push({
        id,
        dbId: id,
        colorName,
        size,
        stock: product.stockUnits ?? 0,
      })
    }
  }
  return rows
}

export function buildMerchantFeedItems(
  products: StorefrontProduct[],
  siteBase: string,
  outsideDhakaCharge: number = DELIVERY_ZONES.OUTSIDE_DHAKA.charge,
): string[] {
  const base = siteBase.replace(/\/$/, '')
  const items: string[] = []
  const shippingXml = bangladeshShippingXml(outsideDhakaCharge)

  for (const product of products) {
    const slug = product.slug ?? productSlug(product)
    const productLink = `${base}/products/${slug}`
    const imageLink = absoluteUrl(product.image)
    if (!imageLink) continue

    const price = Number(product.price)
    if (!Number.isFinite(price) || price <= 0) continue

    const safeMaterial = sanitizeStorefrontMaterial(product.material)
    const description = stripHtml(
      `${product.name}. Premium fashion from SPLARO Bangladesh. ${safeMaterial || ''} ${product.fit || ''}`.trim(),
    ).slice(0, 5000)

    const itemGroupId = merchantItemGroupId(product)

    const additional = (product.media ?? [])
      .filter((m) => m.type === 'image')
      .map((m) => absoluteUrl(m.url))
      .filter((u): u is string => Boolean(u) && u !== imageLink)
      .slice(0, 9)

    const compareAt = product.compareAtPrice != null ? Number(product.compareAtPrice) : null
    const onSale = compareAt != null && compareAt > price
    const priceXml = onSale
      ? `      <g:price>${compareAt.toFixed(2)} BDT</g:price>
      <g:sale_price>${price.toFixed(2)} BDT</g:sale_price>`
      : `      <g:price>${price.toFixed(2)} BDT</g:price>`

    const catLower = String(product.category ?? '').toLowerCase()
    const gender = product.isUnisex
      ? 'unisex'
      : catLower.includes('men') && !catLower.includes('women')
        ? 'male'
        : catLower.includes('kids')
          ? 'unisex'
          : 'female'
    const ageGroup = catLower.includes('kids') ? 'kids' : 'adult'
    const materialXml = safeMaterial
      ? `\n      <g:material>${xmlEscape(safeMaterial)}</g:material>`
      : ''

    // Private-label catalog: no GTIN/MPN assigned — honest until catalog audit adds identifiers.

    const variants = collectVariants(product, itemGroupId)
    const hasMultipleVariants = variants.length > 1
    const hasColorDimension =
      hasMultipleVariants &&
      variants.every((variant) => Boolean(variant.colorName)) &&
      new Set(variants.map((variant) => variant.colorName)).size > 1
    const hasSizeDimension =
      hasMultipleVariants &&
      variants.every((variant) => Boolean(variant.size)) &&
      new Set(variants.map((variant) => variant.size)).size > 1
    const isVariantGroup = hasColorDimension || hasSizeDimension
    const itemGroupXml = isVariantGroup
      ? `\n      <g:item_group_id>${xmlEscape(itemGroupId)}</g:item_group_id>\n      <g:item_group_title>${xmlEscape(product.name.slice(0, 150))}</g:item_group_title>`
      : ''
    const seen = new Set<string>()

    for (const variant of variants) {
      if (seen.has(variant.id)) continue
      seen.add(variant.id)

      const availability = variant.stock > 0 ? 'in_stock' : 'out_of_stock'
      const colorXml = variant.colorName
        ? `\n      <g:color>${xmlEscape(variant.colorName)}</g:color>`
        : ''
      const sizeXml = variant.size ? `\n      <g:size>${xmlEscape(variant.size)}</g:size>` : ''
      const variantOptionsXml = [
        hasColorDimension
          ? `\n      <g:variant_option>\n        <g:name>color</g:name>\n        <g:value>${xmlEscape(variant.colorName)}</g:value>\n      </g:variant_option>`
          : '',
        hasSizeDimension
          ? `\n      <g:variant_option>\n        <g:name>size</g:name>\n        <g:value>${xmlEscape(variant.size)}</g:value>\n      </g:variant_option>`
          : '',
      ].join('')
      const params = new URLSearchParams({ v: variant.dbId })
      if (variant.size) params.set('size', variant.size)
      if (variant.colorName) params.set('color', variant.colorName)
      const link = `${productLink}?${params.toString()}`
      const title = variantTitle(product.name, variant.colorName, variant.size)
      const variantImage = (variant.image ? absoluteUrl(variant.image) : null) || imageLink

      items.push(`    <item>
      <g:id>${xmlEscape(variant.id)}</g:id>${itemGroupXml}
      <g:title>${xmlEscape(title)}</g:title>
      <g:description>${xmlEscape(description)}</g:description>
      <g:link>${xmlEscape(link)}</g:link>
      <g:image_link>${xmlEscape(variantImage)}</g:image_link>
${additional.map((u) => `      <g:additional_image_link>${xmlEscape(u)}</g:additional_image_link>`).join('\n')}
      <g:availability>${availability}</g:availability>
${priceXml}
      <g:brand>SPLARO</g:brand>
      <g:condition>new</g:condition>
      <g:gender>${gender}</g:gender>
      <g:age_group>${ageGroup}</g:age_group>${colorXml}${sizeXml}${variantOptionsXml}${materialXml}
      <g:size_type>regular</g:size_type>
      <g:size_system>UK</g:size_system>
      <g:product_type>${xmlEscape(String(product.categoryName ?? product.category))}</g:product_type>
      <g:google_product_category>Apparel &amp; Accessories</g:google_product_category>
      <g:identifier_exists>no</g:identifier_exists>
${shippingXml}
    </item>`)
    }
  }

  return items
}
