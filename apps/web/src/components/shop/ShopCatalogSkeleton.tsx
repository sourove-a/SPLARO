import { ShopProductGridSkeleton } from '@/components/product/ProductCard/ProductCardSkeleton'

interface ShopCatalogSkeletonProps {
  count?: number
  density?: 1 | 2
  showToolbar?: boolean
}

/** Full shop shell skeleton for route `loading.tsx` — matches desktop filter height to avoid jump. */
export function ShopCatalogSkeleton({
  count = 8,
  density = 2,
  showToolbar = true,
}: ShopCatalogSkeletonProps) {
  return (
    <div className="shop-page-shell shop-catalog-skeleton-shell" aria-busy="true" aria-live="polite">
      <div className="shop-page-intro" aria-hidden>
        <div className="shop-page-intro__top">
          <span
            className="splaro-card-skeleton__line splaro-card-skeleton__line--meta"
            style={{ display: 'block', width: '5.5rem', marginBottom: '0.35rem' }}
          />
        </div>
      </div>
      {showToolbar ? (
        <div className="shop-catalog-skeleton-shell__toolbar" aria-hidden>
          <div className="shop-catalog-skeleton-shell__pills">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className="shop-catalog-skeleton-shell__pill" />
            ))}
          </div>
          <div className="shop-catalog-skeleton-shell__controls" />
          <div className="shop-catalog-skeleton-shell__mobile-bar" />
        </div>
      ) : null}
      <ShopProductGridSkeleton count={count} density={density} />
      <span className="sr-only">Loading products</span>
    </div>
  )
}
