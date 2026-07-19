import type { Category } from '@/data/storefront'

export type ShopCategory = Exclude<Category, 'All'>

/** Leaf + department slugs from admin category tree → shop filter pill. */
const SLUG_TO_SHOP: Record<string, ShopCategory> = {
  women: 'Women',
  dresses: 'Women',
  sarees: 'Women',
  kameez: 'Women',
  'single-kameez': 'Women',
  'single-kurti': 'Women',
  'kurti-tunics': 'Women',
  'ethnic-wear': 'Women',
  'western-wear': 'Women',
  'western-tops': 'Women',
  'burqa-abaya': 'Women',
  bridal: 'Women',
  'tops-tees': 'Women',
  'denim-jeans': 'Women',
  leggings: 'Women',
  maternity: 'Women',
  nightwear: 'Women',
  skirts: 'Women',
  'shalwar-kameez': 'Women',
  'women-coats-jackets': 'Women',
  'women-pants': 'Women',
  'women-shawls': 'Women',
  'summer-edition': 'Summer Edition',
  kids: 'Kids',
  'boys-wear': 'Kids',
  'girls-wear': 'Kids',
  'baby-toddler': 'Kids',
  'ethnic-kids': 'Kids',
  'kids-ghagra-lehenga': 'Kids',
  'kids-party-wear': 'Kids',
  'school-wear': 'Kids',
  footwear: 'Footwear',
  'women-footwear': 'Footwear',
  'men-footwear': 'Footwear',
  'kids-footwear': 'Footwear',
  sandals: 'Footwear',
  sneakers: 'Footwear',
  heels: 'Footwear',
  flats: 'Footwear',
  loafers: 'Footwear',
  accessories: 'Accessories',
  belts: 'Accessories',
  scarves: 'Accessories',
  'prayer-caps': 'Accessories',
  jewelry: 'Accessories',
  wallets: 'Accessories',
  bags: 'Accessories',
  handbags: 'Accessories',
  glasses: 'Accessories',
  watches: 'Accessories',
  'home-decor': 'Accessories',
  men: 'Men',
  panjabi: 'Men',
  't-shirts': 'Men',
  'polo-shirts': 'Men',
  'casual-shirts': 'Men',
  'formal-shirts': 'Men',
  blazers: 'Men',
  'full-sleeve': 'Men',
  'half-sleeve': 'Men',
  'formal-pants': 'Men',
  'denim-pants': 'Men',
  'chino-pants': 'Men',
  joggers: 'Men',
  'relax-wear': 'Men',
  lungi: 'Men',
  'men-casual': 'Men',
  trousers: 'Men',
  fatua: 'Men',
  'short-kurta': 'Men',
  'men-jackets': 'Men',
  'men-shawls': 'Men',
  'men-sleeping-suits': 'Men',
  'scarves-mufflers': 'Men',
}

const NAME_TO_SHOP: Record<string, ShopCategory> = {
  Women: 'Women',
  Kids: 'Kids',
  Men: 'Men',
  Footwear: 'Footwear',
  Accessories: 'Accessories',
  'Summer Edition': 'Summer Edition',
}

function inferShopCategoryFromSlug(slug: string): ShopCategory | null {
  const direct = SLUG_TO_SHOP[slug]
  if (direct) return direct

  // Footwear before Kids — kids-footwear / men-footwear must not become Kids/Men.
  if (slug.includes('footwear') || slug.includes('shoe') || slug.includes('sandal') || slug.includes('sneaker') || slug.includes('loafer')) {
    return 'Footwear'
  }
  if (slug.startsWith('kids-') || slug.includes('kid') || slug.includes('boy') || slug.includes('baby') || slug.includes('toddler') || slug.includes('girl')) {
    return 'Kids'
  }
  if (
    slug.includes('belt') ||
    slug.includes('scarf') ||
    slug.includes('wallet') ||
    slug.includes('bag') ||
    slug.includes('watch') ||
    slug.includes('glass') ||
    slug.includes('jewel') ||
    slug.includes('accessor') ||
    slug.includes('prayer')
  ) {
    return 'Accessories'
  }
  // men-* leaves under Men — but men-footwear already caught above
  if (slug === 'men' || slug.startsWith('men-') || slug.includes('panjabi') || slug.includes('shirt') || slug.includes('trouser') || slug.includes('polo') || slug.includes('kurta') || slug.includes('fatua')) {
    if (!slug.includes('women')) return 'Men'
  }
  if (
    slug.includes('women') ||
    slug.includes('dress') ||
    slug.includes('saree') ||
    slug.includes('kurti') ||
    slug.includes('ethnic') ||
    slug.includes('bridal') ||
    slug.includes('legging')
  ) {
    return 'Women'
  }

  return null
}

/** Map API category name/slug (+ optional parent) to shop filter category. */
export function resolveShopCategory(
  name?: string | null,
  slug?: string | null,
  parentSlug?: string | null,
): ShopCategory {
  const normalizedSlug = slug?.trim().toLowerCase()
  if (normalizedSlug) {
    const fromSlug = inferShopCategoryFromSlug(normalizedSlug)
    if (fromSlug) return fromSlug
  }

  const normalizedParent = parentSlug?.trim().toLowerCase()
  if (normalizedParent) {
    const fromParent = inferShopCategoryFromSlug(normalizedParent)
    if (fromParent) return fromParent
  }

  const normalizedName = name?.trim()
  if (normalizedName && NAME_TO_SHOP[normalizedName]) {
    return NAME_TO_SHOP[normalizedName]
  }

  if (normalizedName) {
    const slugGuess = normalizedName.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-')
    const inferred = inferShopCategoryFromSlug(slugGuess)
    if (inferred) return inferred
  }

  // Unmapped leaf — do not silently label as Women (broke Men / Footwear filters).
  return 'Accessories'
}
