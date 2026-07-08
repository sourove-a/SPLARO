import { CacheService } from '../../common/cache.service'
import { revalidateStorefrontWeb } from '../../common/revalidate-web'
import type { SearchService } from '../search/search.service'

/** Same post-mutation refresh as ProductsController (search reindex + cache bust + web revalidate). */
export async function refreshProductCatalogAfterMutation(
  deps: { cache: CacheService; search?: SearchService | null | undefined },
  storeId: string,
): Promise<void> {
  void deps.search?.indexProducts(storeId)
  await deps.cache.invalidateStoreResource(storeId, 'products')
  void revalidateStorefrontWeb(['storefront-products'])
}
