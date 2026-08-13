/** Optional homepage Men/Women rails — pick category + product, or leave auto. */

export const HOMEPAGE_CATALOG_DEPARTMENTS = [
  'men',
  'women',
  'kids',
  'footwear',
  'accessories',
] as const

export type HomepageCatalogDepartment = (typeof HOMEPAGE_CATALOG_DEPARTMENTS)[number]

export interface HomepageCatalogTile {
  id: string
  department: HomepageCatalogDepartment
  categorySlug: string
  productId: string
}

export interface HomepageCatalogConfig {
  /** When true, only `tiles` render. When false, auto subcategory rails. */
  curated: boolean
  tiles: HomepageCatalogTile[]
}

export const DEFAULT_HOMEPAGE_CATALOG: HomepageCatalogConfig = {
  curated: false,
  tiles: [],
}

const DEPT = new Set<string>(HOMEPAGE_CATALOG_DEPARTMENTS)
const MAX_TILES = 40

export function isHomepageCatalogDepartment(value: string): value is HomepageCatalogDepartment {
  return DEPT.has(value)
}

export function mergeHomepageCatalog(raw: unknown): HomepageCatalogConfig {
  if (!raw || typeof raw !== 'object') {
    return { curated: false, tiles: [] }
  }
  const input = raw as Partial<HomepageCatalogConfig>
  const tiles = Array.isArray(input.tiles)
    ? input.tiles
        .map((tile, index): HomepageCatalogTile | null => {
          if (!tile || typeof tile !== 'object') return null
          const department = String(tile.department ?? '')
            .trim()
            .toLowerCase()
          const categorySlug = String(tile.categorySlug ?? '')
            .trim()
            .toLowerCase()
          const productId = String(tile.productId ?? '').trim()
          if (!isHomepageCatalogDepartment(department) || !categorySlug || !productId) return null
          const id =
            String(tile.id ?? '').trim() || `tile-${department}-${categorySlug}-${index}`
          return { id, department, categorySlug, productId }
        })
        .filter((tile): tile is HomepageCatalogTile => tile != null)
        .slice(0, MAX_TILES)
    : []
  return { curated: input.curated === true, tiles }
}
