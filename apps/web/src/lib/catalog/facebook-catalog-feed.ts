import type { StorefrontProduct } from '@/data/storefront'

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

export function storefrontProductToMetaCatalogRow(p: StorefrontProduct): string[] {
  const id = p.id
  const title = (p.name || '').trim().slice(0, 200)
  const description = `${title} — Premium luxury fashion by SPLARO Bangladesh.`

  const inStock = p.inStock !== false && (p.stockUnits === undefined || p.stockUnits > 0)
  const availability = inStock ? 'in stock' : 'out of stock'
  const condition = 'new'

  const link = `https://splaro.co/products/${encodeURIComponent(p.slug || p.id)}`

  // Main primary image link only
  const image_link = resolveFacebookImageUrl(p.image)

  const brand = (p.brand?.name || 'SPLARO').trim().slice(0, 100)

  const basePrice = Number(p.price) || 0
  const comparePrice = Number(p.compareAtPrice) || 0
  let priceStr: string
  let salePriceStr: string

  if (comparePrice > basePrice && basePrice > 0) {
    priceStr = `${comparePrice.toFixed(2)} BDT`
    salePriceStr = `${basePrice.toFixed(2)} BDT`
  } else {
    priceStr = `${basePrice.toFixed(2)} BDT`
    salePriceStr = `${basePrice.toFixed(2)} BDT`
  }

  const catName = (p.categoryName || p.category || '').toLowerCase()
  const catSlug = (p.categorySlug || '').toLowerCase()

  const isFootwear =
    catName.includes('shoe') ||
    catName.includes('footwear') ||
    catName.includes('sneaker') ||
    catSlug.includes('footwear') ||
    catSlug.includes('shoe')

  const isPants =
    catName.includes('pant') ||
    catName.includes('cargo') ||
    catName.includes('trouser') ||
    catName.includes('jean') ||
    catSlug.includes('pant') ||
    catSlug.includes('trouser')

  const isDress =
    catName.includes('dress') ||
    catName.includes('frock') ||
    catName.includes('saree') ||
    catName.includes('kameez')

  const google_product_category = isFootwear
    ? 'Apparel & Accessories > Shoes'
    : isPants
      ? 'Apparel & Accessories > Clothing > Pants'
      : isDress
        ? 'Apparel & Accessories > Clothing > Dresses'
        : 'Apparel & Accessories > Clothing'

  const fb_product_category = isFootwear
    ? 'Clothing & Accessories > Shoes'
    : 'Clothing & Accessories > Clothing'

  const quantity_to_sell_on_facebook = String(Math.max(0, p.stockUnits ?? (inStock ? 10 : 0)))
  const sale_price_effective_date = ''
  const item_group_id = (p.code || p.id).trim().slice(0, 100)

  const isMen = catName.includes('men') || catSlug.includes('men')
  const isWomen = catName.includes('women') || catSlug.includes('women') || isDress
  const gender = p.isUnisex ? 'unisex' : isMen && !isWomen ? 'male' : isWomen && !isMen ? 'female' : 'unisex'

  const color = (p.colors ?? []).join(' / ').slice(0, 200) || 'Default'
  const size = (p.sizes ?? []).join(' / ').slice(0, 200) || 'Regular'

  const isKids = catName.includes('kid') || catSlug.includes('kid') || catName.includes('child')
  const age_group = isKids ? 'kids' : 'adult'

  const material = (p.material || '').trim().slice(0, 200)
  const pattern = ''
  const shipping = 'BD::Standard:0.00 BDT'
  const shipping_weight = ''
  const offer_disclaimer = ''
  const offer_disclaimer_url = ''
  const video_url = ''
  const video_tag = ''
  const gtin = ''
  const product_tags_0 = (p.tags?.[0] || p.category || 'SPLARO').trim().slice(0, 110)
  const product_tags_1 = (p.tags?.[1] || p.status || 'Fashion').trim().slice(0, 110)
  const style_0 = (p.fit || 'Regular').trim().slice(0, 100)

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

export function buildFacebookCatalogCsvFromStorefront(products: StorefrontProduct[]): string {
  const headerRow = META_CATALOG_HEADERS.join(',')
  const dataRows = products.map((p) => storefrontProductToMetaCatalogRow(p).map(escapeCsvCell).join(','))
  return [META_CATALOG_COMMENT_LINE, headerRow, ...dataRows].join('\r\n')
}
