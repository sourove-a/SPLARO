import { cn } from '@/lib/utils/cn'

interface ProductCardSkeletonProps {
  className?: string
}

/** Soft shimmer placeholder matching SplaroProductCard shop layout. */
export function ProductCardSkeleton({ className }: ProductCardSkeletonProps) {
  return (
    <div className={cn('splaro-card-skeleton', className)} aria-hidden>
      <div className="splaro-card-skeleton__media">
        <span className="splaro-card-skeleton__shimmer" />
        <span className="splaro-card-skeleton__mark" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="splaro-card-skeleton__info">
        <span className="splaro-card-skeleton__line splaro-card-skeleton__line--name" />
        <span className="splaro-card-skeleton__line splaro-card-skeleton__line--meta" />
        <span className="splaro-card-skeleton__line splaro-card-skeleton__line--price" />
      </div>
    </div>
  )
}

interface ShopProductGridSkeletonProps {
  count?: number
  density?: 1 | 2
  className?: string
}

export function ShopProductGridSkeleton({
  count = 8,
  density = 2,
  className,
}: ShopProductGridSkeletonProps) {
  return (
    <div
      className={cn(
        'shop-product-grid shop-product-grid--skeleton',
        density === 1 && 'shop-product-grid--cols-1',
        density === 2 && 'shop-product-grid--cols-2',
        className,
      )}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={`skeleton-${index}`} className="shop-product-grid__cell min-w-0">
          <ProductCardSkeleton />
        </div>
      ))}
    </div>
  )
}
