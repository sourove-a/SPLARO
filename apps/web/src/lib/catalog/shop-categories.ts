import { getPublishedShopCategories, type CatalogChannel } from '@splaro/types'
import type { Category, StorefrontProduct } from '@/data/storefront'

/** Shop filter pills from published catalog channels, else live product categories — never hardcoded. */
export function deriveShopFilterCategories(
  channels: CatalogChannel[],
  products: StorefrontProduct[] = [],
): Category[] {
  const fromChannels = getPublishedShopCategories(channels)
  if (fromChannels.length) {
    return ['All', ...dedupeCategories(fromChannels)] as Category[]
  }

  if (products.length) {
    const fromProducts = dedupeCategories(products.map((product) => product.category))
    if (fromProducts.length) return ['All', ...fromProducts] as Category[]
  }

  return ['All']
}

function dedupeCategories(values: string[]): Category[] {
  const seen = new Set<string>()
  const out: Category[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed as Category)
  }
  return out
}
