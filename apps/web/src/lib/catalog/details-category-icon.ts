import { Footprints, Gem, Shirt, type LucideIcon } from 'lucide-react'
import { resolveShopCategory } from '@/lib/catalog/shop-category'

/**
 * DETAILS accordion header icon — department-aware, never throws.
 * Clothing (Men/Women/Kids) → Shirt · Footwear → Footprints · Accessories → Gem.
 */
export function resolveDetailsCategoryIcon(
  category?: string | null,
  categorySlug?: string | null,
): LucideIcon {
  try {
    const shop = resolveShopCategory(category, categorySlug)
    if (shop === 'Footwear') return Footprints
    if (shop === 'Accessories') return Gem
    return Shirt
  } catch {
    return Shirt
  }
}
