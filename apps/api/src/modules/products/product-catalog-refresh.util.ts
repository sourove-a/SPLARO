import { CacheService } from '../../common/cache.service'
import { fireAndForget } from '../../common/fire-and-forget'
import { revalidateStorefrontWeb } from '../../common/revalidate-web'
import type { SearchService } from '../search/search.service'

/** Same post-mutation refresh as ProductsController (search reindex + cache bust + web revalidate). */
export async function refreshProductCatalogAfterMutation(
  deps: { cache: CacheService; search?: SearchService | null | undefined },
  storeId: string,
): Promise<void> {
  if (deps.search) {
    fireAndForget(deps.search.indexProducts(storeId), 'search.indexProducts')
  }
  await Promise.all([
    deps.cache.invalidateStoreResource(storeId, 'products'),
    deps.cache.invalidateStoreResource(storeId, 'product'),
  ])
  fireAndForget(revalidateStorefrontWeb(['storefront-products']), 'revalidate.storefront-products')
}

/**
 * A category write moves more than the category list: the mega menu is built
 * from the tree (`nav`), and every product listing is cached per category slug
 * (`products`). Busting only `categories` left the storefront menu and the
 * category pages serving the previous tree until their TTL ran out.
 */
export async function refreshCategoryCatalogAfterMutation(
  cache: CacheService,
  storeId: string,
): Promise<void> {
  await Promise.all([
    cache.invalidateStoreResource(storeId, 'categories'),
    cache.invalidateStoreResource(storeId, 'nav'),
    cache.invalidateStoreResource(storeId, 'products'),
  ])
  void revalidateStorefrontWeb([
    'storefront-categories',
    'storefront-menu-header',
    'storefront-nav',
    'storefront-products',
  ])
}

export async function refreshCollectionCatalogAfterMutation(
  cache: CacheService,
  storeId: string,
): Promise<void> {
  await cache.invalidateStoreResource(storeId, 'collections')
  void revalidateStorefrontWeb(['storefront-collections'])
}
