'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import { Heart, ChevronUp, ChevronDown, ShoppingBag, Loader2 } from 'lucide-react'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'

export interface SplaroProductCardProps {
  id: string
  slug: string
  name: string
  price: number
  compareAtPrice?: number
  image: string
  imageHover?: string
  category?: string
  collection?: string
  productCode?: string
  colorHexes?: string[]
  status?: string
  meta?: string
  inStock?: boolean
  sizes?: string[]
  href?: string
  priority?: boolean
  fit?: 'contain' | 'cover'
  onAddToBag?: () => void
  variant?: 'default' | 'shop' | 'homepage'
}

export function SplaroProductCard({
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
}: SplaroProductCardProps) {
  const wishlistHydrated = useWishlistStore((s) => s._hydrated)
  const { toggleWishlist, isInWishlist } = useWishlistStore()
  const saved = wishlistHydrated && isInWishlist(id)
  const [adding, setAdding] = useState(false)
  const [linkPressed, setLinkPressed] = useState(false)

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
        if (adding) return
        setAdding(true)
        onAddToBag?.()
        window.setTimeout(() => setAdding(false), 420)
        return
      }
      toggleWishlist(id)
    },
    [adding, id, isHomepage, isShop, onAddToBag, toggleWishlist],
  )

  return (
    <article
      className={cn(
        'splaro-card ilyn-card group',
        !inStock && 'splaro-card--out-of-stock ilyn-card--out-of-stock',
        isShop && 'splaro-card--shop ilyn-card--shop',
        isHomepage && 'splaro-card--homepage ilyn-card--homepage',
        linkPressed && 'splaro-card--pressed ilyn-card--pressed',
      )}
    >
      <div className="splaro-card__media ilyn-card__media">
        <Link
          href={link}
          className="splaro-card__link ilyn-card__link"
          aria-label={name}
          prefetch
          onMouseDown={() => setLinkPressed(true)}
          onMouseUp={() => setLinkPressed(false)}
          onMouseLeave={() => setLinkPressed(false)}
          onTouchStart={() => setLinkPressed(true)}
          onTouchEnd={() => setLinkPressed(false)}
        >
          <StorefrontImage
            src={image}
            alt={name}
            profile="card"
            fill
            fit={imageFit}
            priority={priority}
            className={cn(
              'splaro-card__img splaro-card__img--primary ilyn-card__img ilyn-card__img--primary',
              imageFit === 'cover'
                ? 'splaro-card__img--cover ilyn-card__img--cover'
                : 'splaro-card__img--contain ilyn-card__img--contain',
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
              'splaro-card__img splaro-card__img--hover ilyn-card__img ilyn-card__img--hover',
              imageFit === 'cover'
                ? 'splaro-card__img--cover ilyn-card__img--cover'
                : 'splaro-card__img--contain ilyn-card__img--contain',
            )}
          />
        </Link>

        {showStatus ? (
          <span
            className={cn(
              'splaro-card__badge ilyn-card__badge',
              status === 'Limited' && 'splaro-card__badge--limited ilyn-card__badge--limited',
            )}
          >
            {status === 'New' ? 'NEW' : status.toUpperCase()}
          </span>
        ) : null}
        {hasDiscount && !showStatus ? (
          <span className="splaro-card__badge splaro-card__badge--sale ilyn-card__badge ilyn-card__badge--sale">
            -{discount}%
          </span>
        ) : null}

        {showCollectionTag ? (
          <span className="splaro-card__collection ilyn-card__collection">{tag}</span>
        ) : null}

        {!inStock ? <span className="splaro-card__sold-badge ilyn-card__sold-badge">Sold out</span> : null}

        {inStock ? (
          <button
            type="button"
            className={cn(
              'splaro-card__wish ilyn-card__wish',
              !isShop && !isHomepage && saved && 'splaro-card__wish--saved ilyn-card__wish--saved',
              'splaro-card__wish--touch ilyn-card__wish--touch',
              isHomepage && 'splaro-card__wish--homepage ilyn-card__wish--homepage',
              adding && 'splaro-card__wish--adding ilyn-card__wish--adding',
            )}
            onClick={handleCardAction}
            disabled={adding}
            aria-pressed={isShop || isHomepage ? undefined : saved}
            aria-label={
              isShop || isHomepage
                ? adding
                  ? `Adding ${name} to bag`
                  : `Add ${name} to bag`
                : saved
                  ? 'Remove from saved'
                  : 'Save product'
            }
          >
            {adding ? (
              <Loader2 className="splaro-card__wish-spinner h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : isShop || isHomepage ? (
              <ShoppingBag size={isHomepage ? 16 : 13} strokeWidth={1.5} />
            ) : (
              <Heart size={13} strokeWidth={1.5} className={cn(saved && 'fill-current')} />
            )}
          </button>
        ) : null}
      </div>

      <Link
        href={link}
        className="splaro-card__info ilyn-card__info"
        tabIndex={-1}
        prefetch
        onMouseDown={() => setLinkPressed(true)}
        onMouseUp={() => setLinkPressed(false)}
        onMouseLeave={() => setLinkPressed(false)}
      >
        <div className="splaro-card__title-row ilyn-card__title-row">
          <h3 className="splaro-card__name ilyn-card__name">{name}</h3>
          {productCode ? (
            <span className="splaro-card__code ilyn-card__code">{productCode}</span>
          ) : null}
        </div>

        {colorHexes.length > 0 ? (
          <div className="splaro-card__colors ilyn-card__colors">
            <span>
              {colorHexes.length} color{colorHexes.length > 1 ? 's' : ''}
            </span>
            {isShop && !isHomepage ? (
              <ChevronDown size={11} strokeWidth={2} aria-hidden />
            ) : (
              <ChevronUp size={11} strokeWidth={2} aria-hidden />
            )}
          </div>
        ) : null}

        <div className="splaro-card__price-row ilyn-card__price-row">
          <span className="splaro-card__price ilyn-card__price">{formatBDT(price)}</span>
          {hasDiscount ? (
            <span className="splaro-card__compare ilyn-card__compare">{formatBDT(compareAtPrice!)}</span>
          ) : null}
          {meta ? <span className="splaro-card__meta ilyn-card__meta">{meta}</span> : null}
        </div>
      </Link>
    </article>
  )
}
