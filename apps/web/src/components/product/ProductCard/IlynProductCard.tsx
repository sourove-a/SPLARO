'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import { Heart, ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'
import { trackAddToCart } from '@/lib/analytics/meta-pixel'

export interface IlynProductCardProps {
  id: string
  slug: string
  name: string
  price: number
  compareAtPrice?: number
  image: string
  imageHover?: string
  category?: string
  /** Collection label shown as the top-right tag. Falls back to category. */
  collection?: string
  productCode?: string
  colorHexes?: string[]
  /** Ready | New | Limited | any custom label */
  status?: string
  /** Small caption under price-row, e.g. "120 sold" */
  meta?: string
  /** When false, shows Out Of Stock action dock */
  inStock?: boolean
  sizes?: string[]
  href?: string
  priority?: boolean
  /** Use cover instead of the floating pedestal fit. */
  fit?: 'contain' | 'cover'
  /** Override the internal cart handler (e.g. size/color aware). */
  onAddToBag?: () => void
}

export function IlynProductCard({
  id,
  slug,
  name,
  price,
  compareAtPrice,
  image,
  imageHover,
  category,
  collection,
  productCode,
  colorHexes = [],
  status = 'Ready',
  meta,
  inStock = true,
  sizes: _sizes = [],
  href,
  priority = false,
  fit = 'cover',
  onAddToBag,
}: IlynProductCardProps) {
  const addToCart = useCartStore((s) => s.addItem)
  const wishlistHydrated = useWishlistStore((s) => s._hydrated)
  const { toggleWishlist, isInWishlist } = useWishlistStore()
  const saved = wishlistHydrated && isInWishlist(id)

  const link = href ?? `/products/${slug}`
  const hasDiscount = Boolean(compareAtPrice && compareAtPrice > price)
  const discount = hasDiscount
    ? Math.round(((compareAtPrice! - price) / compareAtPrice!) * 100)
    : 0
  const tag = collection ?? category
  const showStatus = status && status !== 'Ready'
  const secondImage = imageHover ?? image

  const handleBag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!inStock) return
      if (onAddToBag) {
        onAddToBag()
        return
      }
      addToCart({
        productId: id,
        variantId: id,
        quantity: 1,
        name,
        price,
        image,
        slug,
      })
      trackAddToCart({ id, name, price })
    },
    [addToCart, id, image, inStock, name, onAddToBag, price, slug],
  )

  const handleWishlist = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      toggleWishlist(id)
    },
    [toggleWishlist, id],
  )

  return (
    <article className={cn('ilyn-card group', !inStock && 'ilyn-card--out-of-stock')}>
      <div className="ilyn-card__media">
        <Link href={link} className="ilyn-card__link" aria-label={name} prefetch={false}>
          <StorefrontImage
            src={image}
            alt={name}
            profile="card"
            fill
            priority={priority}
            className={cn(
              'ilyn-card__img ilyn-card__img--primary',
              fit === 'cover' ? 'ilyn-card__img--cover' : 'ilyn-card__img--contain',
            )}
          />
          <StorefrontImage
            src={secondImage}
            alt=""
            profile="card"
            aria-hidden
            fill
            className={cn(
              'ilyn-card__img ilyn-card__img--hover',
              fit === 'cover' ? 'ilyn-card__img--cover' : 'ilyn-card__img--contain',
            )}
          />
        </Link>

        {showStatus && (
          <span
            className={cn(
              'ilyn-card__badge',
              status === 'Limited' && 'ilyn-card__badge--limited',
            )}
          >
            {status === 'New' ? 'NEW' : status.toUpperCase()}
          </span>
        )}
        {hasDiscount && !showStatus && (
          <span className="ilyn-card__badge ilyn-card__badge--sale">-{discount}%</span>
        )}

        {tag && <span className="ilyn-card__collection">{tag}</span>}

        {!inStock ? (
          <span className="ilyn-card__sold-badge">Sold out</span>
        ) : (
          <div className="ilyn-card__dock">
            <button
              type="button"
              className="ilyn-card__dock-bag"
              onClick={handleBag}
              aria-label={`Add ${name} to bag`}
            >
              <ShoppingBag size={16} strokeWidth={1.65} />
            </button>
          </div>
        )}

        <button
          type="button"
          className={cn('ilyn-card__wish', saved && 'ilyn-card__wish--saved', 'ilyn-card__wish--touch')}
          onClick={handleWishlist}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save product'}
        >
          <Heart size={14} strokeWidth={1.6} className={cn(saved && 'fill-current')} />
        </button>
      </div>

      <Link href={link} className="ilyn-card__info" tabIndex={-1} prefetch={false}>
        <div className="ilyn-card__info-top">
          {category && <span className="ilyn-card__category">{category}</span>}
          {productCode && <span className="ilyn-card__code">{productCode}</span>}
        </div>
        <h3 className="ilyn-card__name">{name}</h3>

        {colorHexes.length > 0 && (
          <div className="ilyn-card__colors">
            <span>
              {colorHexes.length} color{colorHexes.length > 1 ? 's' : ''}
            </span>
            <span className="ilyn-card__dots" aria-hidden>
              {colorHexes.slice(0, 3).map((c) => (
                <span key={c} className="ilyn-card__dot" style={{ backgroundColor: c }} />
              ))}
            </span>
          </div>
        )}

        <div className="ilyn-card__price-row">
          <span className="ilyn-card__price">{formatBDT(price)}</span>
          {hasDiscount && <span className="ilyn-card__compare">{formatBDT(compareAtPrice!)}</span>}
          {meta && <span className="ilyn-card__meta">{meta}</span>}
        </div>
      </Link>
    </article>
  )
}
