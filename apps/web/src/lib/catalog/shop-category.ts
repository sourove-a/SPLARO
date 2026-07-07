import type { Category } from '@/data/storefront'

export type ShopCategory = Exclude<Category, 'All'>

/** Leaf category slugs from admin → shop filter pill (Women, Kids, …). */
const SLUG_TO_SHOP: Record<string, ShopCategory> = {
  women: 'Women',
  dresses: 'Women',
  sarees: 'Women',
  'kurti-tunics': 'Women',
  'ethnic-wear': 'Women',
  'summer-edition': 'Summer Edition',
  kids: 'Kids',
  'boys-wear': 'Kids',
  'girls-wear': 'Kids',
  'baby-toddler': 'Kids',
  'ethnic-kids': 'Kids',
  footwear: 'Footwear',
  'women-footwear': 'Footwear',
  'men-footwear': 'Footwear',
  'kids-footwear': 'Footwear',
  accessories: 'Accessories',
  belts: 'Accessories',
  scarves: 'Accessories',
  'prayer-caps': 'Accessories',
  jewelry: 'Accessories',
  wallets: 'Accessories',
  bags: 'Accessories',
  glasses: 'Accessories',
  watches: 'Accessories',
  men: 'Men',
  panjabi: 'Men',
  't-shirts': 'Men',
  'polo-shirts': 'Men',
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

  if (slug.includes('footwear') || slug.includes('shoe')) return 'Footwear'
  if (slug.includes('kid') || slug.includes('boy') || slug.includes('baby') || slug.includes('toddler')) {
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
  if (slug.includes('men') && !slug.includes('women')) return 'Men'
  if (
    slug.includes('women') ||
    slug.includes('dress') ||
    slug.includes('saree') ||
    slug.includes('kurti') ||
    slug.includes('ethnic')
  ) {
    return 'Women'
  }

  return null
}

/** Map API category name/slug to shop filter category. */
export function resolveShopCategory(
  name?: string | null,
  slug?: string | null,
): ShopCategory {
  const normalizedSlug = slug?.trim().toLowerCase()
  if (normalizedSlug) {
    const fromSlug = inferShopCategoryFromSlug(normalizedSlug)
    if (fromSlug) return fromSlug
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

  return 'Women'
}
