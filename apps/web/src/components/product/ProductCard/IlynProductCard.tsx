'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import { Heart, ChevronUp, ChevronDown, ShoppingBag } from 'lucide-react'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'

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
  /** Shop listing uses bag icon; homepage uses clean studio panel. */
  variant?: 'default' | 'shop' | 'homepage'
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
  fit = 'contain',
  onAddToBag,
  variant = 'default',
}: IlynProductCardProps) {
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
  const isShop = variant === 'shop'
  const isHomepage = variant === 'homepage'
  const imageFit = isHomepage ? 'cover' : fit
  const showCollectionTag = Boolean(tag) && !isHomepage

  const handleCardAction = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (isShop || isHomepage) {
        onAddToBag?.()
        return
      }
      toggleWishlist(id)
    },
    [id, isHomepage, isShop, onAddToBag, toggleWishlist],
  )

  return (
    <article
      className={cn(
        'ilyn-card group',
        !inStock && 'ilyn-card--out-of-stock',
        isShop && 'ilyn-card--shop',
        isHomepage && 'ilyn-card--homepage',
      )}
    >
      <div className="ilyn-card__media">
        <Link href={link} className="ilyn-card__link" aria-label={name} prefetch={false}>
          <StorefrontImage
            src={image}
            alt={name}
            profile="card"
            fill
            fit={imageFit}
            priority={priority}
            className={cn(
              'ilyn-card__img ilyn-card__img--primary',
              imageFit === 'cover' ? 'ilyn-card__img--cover' : 'ilyn-card__img--contain',
            )}
          />
          <StorefrontImage
            src={secondImage}
            alt=""
            profile="card"
            aria-hidden
            fill
            fit={imageFit}
            className={cn(
              'ilyn-card__img ilyn-card__img--hover',
              imageFit === 'cover' ? 'ilyn-card__img--cover' : 'ilyn-card__img--contain',
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

        {showCollectionTag ? <span className="ilyn-card__collection">{tag}</span> : null}

        {!inStock ? <span className="ilyn-card__sold-badge">Sold out</span> : null}

        {inStock ? (
          <button
            type="button"
            className={cn(
              'ilyn-card__wish',
              !isShop && !isHomepage && saved && 'ilyn-card__wish--saved',
              'ilyn-card__wish--touch',
              isHomepage && 'ilyn-card__wish--homepage',
            )}
            onClick={handleCardAction}
            aria-pressed={isShop || isHomepage ? undefined : saved}
            aria-label={isShop || isHomepage ? `Add ${name} to bag` : saved ? 'Remove from saved' : 'Save product'}
          >
            {isShop || isHomepage ? (
              <ShoppingBag size={isHomepage ? 16 : 13} strokeWidth={1.5} />
            ) : (
              <Heart size={13} strokeWidth={1.5} className={cn(saved && 'fill-current')} />
            )}
          </button>
        ) : null}
      </div>

      <Link href={link} className="ilyn-card__info" tabIndex={-1} prefetch={false}>
        <div className="ilyn-card__title-row">
          <h3 className="ilyn-card__name">{name}</h3>
          {productCode ? <span className="ilyn-card__code">{productCode}</span> : null}
        </div>

        {colorHexes.length > 0 && (
          <div className="ilyn-card__colors">
            <span>
              {colorHexes.length} color{colorHexes.length > 1 ? 's' : ''}
            </span>
            {isShop && !isHomepage ? (
              <ChevronDown size={11} strokeWidth={2} aria-hidden />
            ) : (
              <ChevronUp size={11} strokeWidth={2} aria-hidden />
            )}
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
