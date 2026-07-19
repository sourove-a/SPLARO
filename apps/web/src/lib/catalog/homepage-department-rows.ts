import { CATEGORY_SUBCATEGORIES } from '@splaro/config'
import {
  DEFAULT_CATALOG_CHANNELS,
  isCatalogChannelPublished,
  mergeCatalogChannels,
  type CatalogChannel,
} from '@splaro/types'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import {
  fetchLiveCollections,
  fetchStorefrontProductListing,
  type CatalogProduct,
} from '@/lib/catalog/live'
import { collectionHref } from '@/lib/storefront/collection-paths'

/** Men → Women → Kids → Footwear → Accessories (matches header dept order). */
const DEPARTMENT_ORDER = ['men', 'women', 'kids', 'footwear', 'accessories'] as const

const TILE_PRODUCT_LIMIT = 48

export interface HomepageCategoryTile {
  slug: string
  label: string
  image: string
  href: string
  count: number
}

export interface HomepageDepartmentRow {
  slug: string
  title: string
  exploreHref: string
  tiles: HomepageCategoryTile[]
}

function isRealImage(url: string | undefined | null): url is string {
  const trimmed = url?.trim()
  if (!trimmed) return false
  if (trimmed === PRODUCT_IMAGE_PLACEHOLDER) return false
  return true
}

function channelForSlug(channels: CatalogChannel[], slug: string): CatalogChannel | undefined {
  return channels.find((channel) => channel.slug === slug)
}

function exploreHrefFor(channel: CatalogChannel | undefined, slug: string): string {
  if (channel?.href) return channel.href
  if (slug === 'accessories') return '/accessories'
  return collectionHref(slug)
}

function subMeta(deptSlug: string): Map<string, string> {
  const list = CATEGORY_SUBCATEGORIES[deptSlug] ?? []
  return new Map(list.map((entry) => [entry.slug, entry.name]))
}

function groupProductsByCategorySlug(products: CatalogProduct[]): Map<string, CatalogProduct[]> {
  const groups = new Map<string, CatalogProduct[]>()
  for (const product of products) {
    const slug = (product.categorySlug ?? '').trim().toLowerCase()
    if (!slug) continue
    const bucket = groups.get(slug)
    if (bucket) bucket.push(product)
    else groups.set(slug, [product])
  }
  return groups
}

function tileImage(
  products: CatalogProduct[],
  liveImage: string | null | undefined,
): string | null {
  if (isRealImage(liveImage)) return liveImage.trim()
  for (const product of products) {
    if (isRealImage(product.image)) return product.image.trim()
    if (isRealImage(product.hoverImage)) return product.hoverImage.trim()
  }
  return null
}

type LiveCollectionMeta = {
  name: string
  imageUrl?: string | null | undefined
  productCount: number
}

function buildTilesForDepartment(
  deptSlug: string,
  products: CatalogProduct[],
  liveBySlug: Map<string, LiveCollectionMeta>,
): HomepageCategoryTile[] {
  const groups = groupProductsByCategorySlug(products)
  const known = subMeta(deptSlug)
  const slugOrder: string[] = []

  for (const slug of known.keys()) {
    if (groups.has(slug)) slugOrder.push(slug)
  }
  for (const slug of groups.keys()) {
    if (!slugOrder.includes(slug) && slug !== deptSlug) slugOrder.push(slug)
  }

  // Department-only products (no child slug) → single dept tile when no children
  if (!slugOrder.length && products.length) {
    const image = tileImage(products, liveBySlug.get(deptSlug)?.imageUrl)
    if (!image) return []
    const live = liveBySlug.get(deptSlug)
    return [
      {
        slug: deptSlug,
        label: live?.name ?? deptSlug.replace(/-/g, ' '),
        image,
        href: deptSlug === 'accessories' ? '/accessories' : collectionHref(deptSlug),
        count: products.length,
      },
    ]
  }

  const tiles: HomepageCategoryTile[] = []
  for (const slug of slugOrder) {
    const bucket = groups.get(slug) ?? []
    const live = liveBySlug.get(slug)
    const count = bucket.length || live?.productCount || 0
    if (count <= 0) continue
    const image = tileImage(bucket, live?.imageUrl)
    if (!image) continue
    const label =
      known.get(slug) ??
      live?.name ??
      bucket[0]?.categoryName ??
      slug.replace(/-/g, ' ')
    tiles.push({
      slug,
      label,
      image,
      href: collectionHref(slug),
      count,
    })
  }
  return tiles
}

async function loadDepartmentProducts(deptSlug: string): Promise<CatalogProduct[]> {
  const byParent = await fetchStorefrontProductListing({
    page: 1,
    limit: TILE_PRODUCT_LIMIT,
    parentCategorySlug: deptSlug,
  })
  if (byParent.products.length) return byParent.products

  const byCategory = await fetchStorefrontProductListing({
    page: 1,
    limit: TILE_PRODUCT_LIMIT,
    categorySlug: deptSlug,
  })
  return byCategory.products
}

/**
 * Live subcategory image rails for the homepage (ILYN-style).
 * Empty departments / tiles without real images are omitted — no fake stock.
 */
function isDepartmentHiddenInHeaderNav(
  slug: string,
  headerNav?: Array<{ href?: string; label?: string; hidden?: boolean }> | null,
): boolean {
  if (!headerNav?.length) return false
  const slugLc = slug.toLowerCase()
  const match = headerNav.find((item) => {
    const href = (item.href ?? '').split('?')[0]?.replace(/\/$/, '') ?? ''
    const label = (item.label ?? '').trim().toLowerCase()
    if (label === slugLc) return true
    if (slugLc === 'accessories') {
      return href === '/accessories' || href.endsWith('/accessories')
    }
    return (
      href === `/c/${slugLc}` ||
      href === `/collections/${slugLc}` ||
      href.endsWith(`/c/${slugLc}`) ||
      href.endsWith(`/collections/${slugLc}`)
    )
  })
  return match?.hidden === true
}

export async function getHomepageDepartmentRows(
  catalogChannels?: unknown,
  headerNav?: Array<{ href?: string; label?: string; hidden?: boolean }> | null,
): Promise<HomepageDepartmentRow[]> {
  const channels = mergeCatalogChannels(catalogChannels ?? DEFAULT_CATALOG_CHANNELS)
  const liveCollections = await fetchLiveCollections().catch(() => [])
  const liveBySlug = new Map<string, LiveCollectionMeta>(
    liveCollections.map((row) => [
      row.slug,
      {
        name: row.name,
        ...(row.imageUrl !== undefined ? { imageUrl: row.imageUrl } : {}),
        productCount: row.productCount,
      },
    ]),
  )

  const settled = await Promise.all(
    DEPARTMENT_ORDER.map(async (slug): Promise<HomepageDepartmentRow | null> => {
      if (!isCatalogChannelPublished(channels, slug)) return null
      // Admin “hide” on header nav also removes the homepage department rail
      if (isDepartmentHiddenInHeaderNav(slug, headerNav)) return null
      const channel = channelForSlug(channels, slug)
      const products = await loadDepartmentProducts(slug)
      const tiles = buildTilesForDepartment(slug, products, liveBySlug)
      if (!tiles.length) return null
      return {
        slug,
        title: channel?.label ?? slug.charAt(0).toUpperCase() + slug.slice(1),
        exploreHref: exploreHrefFor(channel, slug),
        tiles,
      }
    }),
  )
  return settled.filter((row): row is HomepageDepartmentRow => row != null)
}
