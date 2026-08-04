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

export async function refreshCategoryCatalogAfterMutation(
  cache: CacheService,
  storeId: string,
): Promise<void> {
  await cache.invalidateStoreResource(storeId, 'categories')
  void revalidateStorefrontWeb(['storefront-categories'])
}

export async function refreshCollectionCatalogAfterMutation(
  cache: CacheService,
  storeId: string,
): Promise<void> {
  await cache.invalidateStoreResource(storeId, 'collections')
  void revalidateStorefrontWeb(['storefront-collections'])
}
