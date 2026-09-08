import { downloadBlob } from '@/lib/admin/admin-actions'
import type { ApiProduct } from '@/lib/api/products'

export const META_CATALOG_COMMENT_LINE =
  `# Required | A unique content ID for the item. Use the item's SKU if you can. Each content ID must appear only once in your catalog. To run dynamic ads this ID must exactly match the content ID for the same item in your Meta Pixel code. Character limit: 100,# Required | A specific and relevant title for the item. See title specifications: https://www.facebook.com/business/help/2104231189874655 Character limit: 200,# Required | A short and relevant description of the item. Include specific or unique product features like material or color. Use plain text and don't enter text in all capital letters. See description specifications: https://www.facebook.com/business/help/2302017289821154 Character limit: 9999,# Required | The current availability of the item. | Supported values: in stock; out of stock,# Required | The current condition of the item. | Supported values: new; used,# Required | The URL of the specific product page where people can buy the item.,# Required | The URL for the main image of your item. Images must be in a supported format (JPG/GIF/PNG) and at least 500 x 500 pixels.,# Required | The brand name of the item. Character limit: 100.,# Optional | The price of the item. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (.) as the decimal point; don't use a comma.,# Optional | The Google product category for the item. Learn more about product categories: https://www.facebook.com/business/help/526764014610932.,# Optional | The Facebook product category for the item. Learn more about product categories: https://www.facebook.com/business/help/526764014610932.,# Optional | The quantity of this item you have to sell on Facebook and Instagram with checkout. Must be 1 or higher or the item won't be buyable,# Optional | The discounted price of the item if it's on sale. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (.) as the decimal point; don't use a comma. A sale price is required if you want to use an overlay for discounted prices.,# Optional | The time range for your sale period. Includes the date and time/time zone when your sale starts and ends. If this field is blank any items with a sale_price remain on sale until you remove the sale price. Use this format: YYYY-MM-DDT23:59+00:00/YYYY-MM-DDT23:59+00:00. Enter the start date as YYYY-MM-DD. Enter a 'T'. Enter the start time in 24-hour format (00:00 to 23:59) followed by the UTC time zone (-12:00 to +14:00). Enter '/' and then repeat the same format for your end date and time. The example row below uses PST time zone (-08:00).,# Optional | Use this field to create variants of the same item. Enter the same group ID for all variants within a group. Learn more about variants: https://www.facebook.com/business/help/2256580051262113 Character limit: 100.,# Optional | The gender of a person that the item is targeted towards. | Supported values: female; male; unisex,# Optional | The color of the item. Use one or more words to describe the color. Don't use a hex code. Character limit: 200.,# Optional | The size of the item written as a word or abbreviation or number. For example: small; XL; 12. Character limit: 200.,# Optional | The age group that the item is targeted towards. | Supported values: adult; all ages; infant; kids; newborn; teen; toddler,# Optional | The material the item is made from; such as cotton; denim or leather. Character limit: 200.,# Optional | The pattern or graphic print on the item. Character limit: 100.,# Optional | Shipping details for the item. Format as Country:Region:Service:Price. Include the 3-letter ISO 4217 currency code in the price. Enter the price as 0.0 to use the free shipping overlay in your ads. Use a semi-colon ';' or a comma ";" to separate multiple shipping details for different regions or countries. Only people in the specified region or country will see shipping details for that region or country. You can leave out the region (keep the double '::') if your shipping details are the same for an entire country.,# Optional | The shipping weight of the item. Include the unit of measurement (lb/oz/g/kg).,# Optional | Legal disclaimer text for product offers. This text provides important legal or regulatory information that must be displayed with the product offer. For example: "Valid while supplies last. Terms and conditions apply.",# Optional | URL linking to the full disclaimer text. This provides a link to a page containing the complete disclaimer information for the product offer. For example: "https://example.com/terms-and-conditions",# Optional | The URL for a video of your product. Link should be a videos file on a file hosting website; not a video player. Videos must be in a supported format (.3g2; .3gp; .3gpp; .asf; .avi; .dat; .divx; .dv; .f4v; .flv; .gif; .m2ts; .m4v; .mkv; .mod; .mov; .mp4; .mpe; .mpeg; .mpeg4; .mpg; .mts; .nsv; .ogm; .ogv; .qt; .tod; .ts; .vob or .wmv).,# Optional | The URL for a video of your product. Link should be a videos file on a file hosting website; not a video player. Videos must be in a supported format (.3g2; .3gp; .3gpp; .asf; .avi; .dat; .divx; .dv; .f4v; .flv; .gif; .m2ts; .m4v; .mkv; .mod; .mov; .mp4; .mpe; .mpeg; .mpeg4; .mpg; .mts; .nsv; .ogm; .ogv; .qt; .tod; .ts; .vob or .wmv).,# Optional | The item’s Global Trade Item Number (GTIN). Recommended to help classify the item. May appear on the barcode; packaging or book cover. Only provide GTIN if you’re sure it’s correct. GTIN types include UPC (12 digits); EAN (13 digits); JAN (8 or 13 digits); ISBN (13 digits) or ITF-14 (14 digits),# Optional | Add labels to products to help filter them into product sets. Max characters: 110 per label; 5000 labels per product,# Optional | Add labels to products to help filter them into product sets. Max characters: 110 per label; 5000 labels per product,# Optional | Describe the fashion style of this item.`

export const META_CATALOG_HEADERS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'link',
  'image_link',
  'brand',
  'price',
  'google_product_category',
  'fb_product_category',
  'quantity_to_sell_on_facebook',
  'sale_price',
  'sale_price_effective_date',
  'item_group_id',
  'gender',
  'color',
  'size',
  'age_group',
  'material',
  'pattern',
  'shipping',
  'shipping_weight',
  'offer_disclaimer',
  'offer_disclaimer_url',
  'video[0].url',
  'video[0].tag[0]',
  'gtin',
  'product_tags[0]',
  'product_tags[1]',
  'style[0]',
] as const

/**
 * Resolve public absolute URL for Facebook's image crawler.
 * Always resolves to a public production URL on splaro.co.
 */
export function resolveFacebookImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
      try {
        const u = new URL(trimmed)
        return `https://splaro.co${u.pathname}${u.search}`
      } catch {
        return trimmed
      }
    }
    return trimmed
  }
  return `https://splaro.co${trimmed.startsWith('/') ? '' : '/'}${trimmed}`
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert a product to a 31-column row matching Meta Commerce Manager's required template.
 * Uses the product's primary (default or first) image as `image_link`.
 */
export function productToMetaCatalogRow(p: ApiProduct): string[] {
  const id = p.id
  const title = (p.name || '').trim().slice(0, 200)

  // Plain text description without HTML tags
  const rawDesc = (p.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const description = (rawDesc || `${title} — Premium fashion by SPLARO Bangladesh.`).slice(0, 9999)

  // Availability
  const totalStock = (p.variants ?? []).reduce(
    (sum, v) => sum + Number(v.stockQuantity ?? v.stock ?? 0),
    0,
  )
  const inStock = p.isPublished !== false && totalStock > 0
  const availability = inStock ? 'in stock' : 'out of stock'
  const condition = 'new'

  const link = `https://splaro.co/products/${encodeURIComponent(p.slug || p.id)}`

  // Main primary image link only (first or isDefault image)
  const images = [...(p.images ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const mainImg =
    images.find((i) => i.isDefault)?.url ??
    images[0]?.url ??
    p.variants?.find((v) => v.image)?.image ??
    ''
  const image_link = resolveFacebookImageUrl(mainImg)

  const brand = (p.brand?.name || 'SPLARO').trim().slice(0, 100)

  // Price & Sale price formatting (ISO 4217 standard: "4600.00 BDT")
  const baseNum = Number(p.basePrice) || 0
  const compareNum = Number(p.compareAtPrice) || 0
  let priceStr: string
  let salePriceStr: string

  if (compareNum > baseNum && baseNum > 0) {
    priceStr = `${compareNum.toFixed(2)} BDT`
    salePriceStr = `${baseNum.toFixed(2)} BDT`
  } else {
    priceStr = `${baseNum.toFixed(2)} BDT`
    salePriceStr = `${baseNum.toFixed(2)} BDT`
  }

  // Google & Meta Product Categories
  const titleLower = (p.name || '').toLowerCase()
  const catName = (p.category?.name || '').toLowerCase()
  const catSlug = (p.category?.slug || '').toLowerCase()

  const isFootwear =
    catName.includes('shoe') ||
    catName.includes('footwear') ||
    catName.includes('sneaker') ||
    catSlug.includes('footwear') ||
    catSlug.includes('shoe') ||
    catSlug.includes('sneaker') ||
    titleLower.includes('sneaker') ||
    titleLower.includes('shoe') ||
    titleLower.includes('loafer') ||
    titleLower.includes('sandal') ||
    titleLower.includes('boot') ||
    titleLower.includes('heel') ||
    titleLower.includes('flat')

  const isPants =
    catName.includes('pant') ||
    catName.includes('cargo') ||
    catName.includes('trouser') ||
    catName.includes('jean') ||
    catSlug.includes('pant') ||
    catSlug.includes('trouser') ||
    titleLower.includes('cargo pant') ||
    titleLower.includes('pant') ||
    titleLower.includes('cargo') ||
    titleLower.includes('trouser') ||
    titleLower.includes('jogger') ||
    titleLower.includes('jean')

  const isDress =
    catName.includes('dress') ||
    catName.includes('frock') ||
    catName.includes('saree') ||
    catName.includes('kameez') ||
    titleLower.includes('dress') ||
    titleLower.includes('frock') ||
    titleLower.includes('saree') ||
    titleLower.includes('kameez') ||
    titleLower.includes('kurti') ||
    titleLower.includes('lehenga')

  const isAccessories =
    catName.includes('accessor') ||
    catName.includes('bag') ||
    catName.includes('wallet') ||
    catName.includes('belt') ||
    catSlug.includes('accessor') ||
    catSlug.includes('bag') ||
    catSlug.includes('wallet') ||
    titleLower.includes('bag') ||
    titleLower.includes('wallet') ||
    titleLower.includes('belt') ||
    titleLower.includes('watch') ||
    titleLower.includes('glass')

  const isKids =
    catName.includes('kid') ||
    catSlug.includes('kid') ||
    catName.includes('child') ||
    catName.includes('frock') ||
    titleLower.includes('kid') ||
    titleLower.includes("boy's") ||
    titleLower.includes("boys'") ||
    titleLower.includes("girl's") ||
    titleLower.includes("girls'") ||
    titleLower.includes('child') ||
    titleLower.includes('baby') ||
    titleLower.includes('toddler')

  const isMen =
    catName.includes('men') ||
    catSlug.includes('men') ||
    titleLower.includes("men's") ||
    titleLower.includes('mens') ||
    titleLower.includes('panjabi') ||
    isPants

  const isWomen =
    catName.includes('women') ||
    catSlug.includes('women') ||
    titleLower.includes("women's") ||
    titleLower.includes('womens') ||
    isDress

  const department = isFootwear
    ? 'Footwear'
    : isKids
      ? 'Kids'
      : isAccessories
        ? 'Accessories'
        : isWomen && !isMen
          ? 'Women'
          : 'Men'

  const subcategory = isFootwear
    ? titleLower.includes('sneaker')
      ? 'Sneakers'
      : titleLower.includes('loafer')
        ? 'Loafers'
        : titleLower.includes('sandal')
          ? 'Sandals'
          : 'Shoes'
    : isPants
      ? titleLower.includes('cargo')
        ? 'Cargo Pants'
        : 'Pants'
      : titleLower.includes('panjabi')
        ? 'Panjabi'
        : titleLower.includes('polo')
          ? 'Polo Shirts'
          : titleLower.includes('saree')
            ? 'Sarees'
            : isDress
              ? 'Dresses'
              : department

  const google_product_category = isFootwear
    ? 'Apparel & Accessories > Shoes'
    : isPants
      ? 'Apparel & Accessories > Clothing > Pants'
      : isDress
        ? 'Apparel & Accessories > Clothing > Dresses'
        : isAccessories
          ? 'Apparel & Accessories > Clothing Accessories'
          : 'Apparel & Accessories > Clothing'

  const fb_product_category = isFootwear
    ? 'Clothing & Accessories > Shoes'
    : isAccessories
      ? 'Clothing & Accessories > Handbags & Wallets'
      : 'Clothing & Accessories > Clothing'

  const quantity_to_sell_on_facebook = String(Math.max(0, totalStock))
  const sale_price_effective_date = ''
  const item_group_id = (p.productCode || p.sku || p.id).trim().slice(0, 100)

  // Gender
  const gender = isMen && !isWomen ? 'male' : isWomen && !isMen ? 'female' : 'unisex'

  // Variant attributes
  const colorList = [...new Set((p.variants ?? []).map((v) => v.colorName || v.color).filter(Boolean))]
  const color = colorList.join(' / ').slice(0, 200) || 'Default'

  const sizeList = [...new Set((p.variants ?? []).map((v) => v.size).filter(Boolean))]
  const size = sizeList.join(' / ').slice(0, 200) || 'Regular'

  const age_group = isKids ? 'kids' : 'adult'

  const material = (p.fabricContent || '').trim().slice(0, 200)
  const pattern = ''
  const shipping = 'BD::Standard:0.00 BDT'

  const weightNum = Number(p.weight) || 0
  const shipping_weight =
    weightNum > 0
      ? weightNum >= 1000
        ? `${(weightNum / 1000).toFixed(2)} kg`
        : `${weightNum} g`
      : ''

  const offer_disclaimer = ''
  const offer_disclaimer_url = ''
  const video_url = ''
  const video_tag = ''
  const gtin = (p.barcode || p.variants?.[0]?.barcode || '').trim()

  const product_tags_0 = department
  const product_tags_1 = subcategory
  const style_0 = (p.fitType || 'Regular').trim().slice(0, 100)

  return [
    id,
    title,
    description,
    availability,
    condition,
    link,
    image_link,
    brand,
    priceStr,
    google_product_category,
    fb_product_category,
    quantity_to_sell_on_facebook,
    salePriceStr,
    sale_price_effective_date,
    item_group_id,
    gender,
    color,
    size,
    age_group,
    material,
    pattern,
    shipping,
    shipping_weight,
    offer_disclaimer,
    offer_disclaimer_url,
    video_url,
    video_tag,
    gtin,
    product_tags_0,
    product_tags_1,
    style_0,
  ]
}

/**
 * Generate full CSV text matching Meta Commerce Manager file format.
 */
export function buildFacebookCatalogCsv(products: ApiProduct[]): string {
  const headerRow = META_CATALOG_HEADERS.join(',')
  const dataRows = products.map((p) => productToMetaCatalogRow(p).map(escapeCsvCell).join(','))
  return [META_CATALOG_COMMENT_LINE, headerRow, ...dataRows].join('\r\n')
}

/**
 * Trigger browser download of Facebook Catalog CSV.
 */
export function downloadFacebookCatalogCsv(products: ApiProduct[], filename?: string): void {
  const csvContent = buildFacebookCatalogCsv(products)
  const name =
    filename || `facebook-catalog-splaro-${new Date().toISOString().slice(0, 10)}.csv`
  downloadBlob(name, csvContent, 'text/csv;charset=utf-8')
}
