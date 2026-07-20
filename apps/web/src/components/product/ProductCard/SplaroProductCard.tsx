'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from '@/lib/motion/react'
import { MEDIA, PRESS_DOWN } from '@/lib/motion/config'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import { ProductTransitionLink } from '@/components/product/ProductTransitionLink'
import { LiquidGlassNavPair } from '@/components/ui/LiquidGlass'
import { productMediaTransitionStyle } from '@/lib/navigation/view-transition'
import { Heart, ChevronUp, ChevronDown, ShoppingBag, Loader2 } from 'lucide-react'
import { useWishlistStore } from '@/store/wishlistStore'
import { useMobileViewport, useMounted } from '@/lib/hooks/use-mobile-viewport'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'
import { trackAddToWishlist } from '@/lib/analytics/meta-pixel'

const IMAGE_SPRING = { type: 'spring' as const, stiffness: 380, damping: 34, mass: 0.82 }

export interface SplaroProductCardProps {
  id: string
  slug: string
  name: string
  price: number
  compareAtPrice?: number
  image: string
  imageHover?: string
  galleryImages?: string[]
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
  onShowDetails?: () => void
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
  galleryImages = [],
  category,
  collection,
  productCode,
  colorHexes = [],
  status = 'Ready',
  meta,
  inStock = true,
  sizes: productSizes = [],
  href,
  priority = false,
  fit = 'contain',
  onAddToBag,
  onShowDetails,
  variant = 'default',
}: SplaroProductCardProps) {
  const reducedMotion = useReducedMotion()
  const isMobile = useMobileViewport()
  const mounted = useMounted()
  const wishlistHydrated = useWishlistStore((s) => s._hydrated)
  const { toggleWishlist, isInWishlist } = useWishlistStore()
  const saved = wishlistHydrated && isInWishlist(id)
  const [adding, setAdding] = useState(false)

  const link = href ?? `/products/${slug}`
  const hasDiscount = Boolean(compareAtPrice && compareAtPrice > price)
  const discount = hasDiscount
    ? Math.round(((compareAtPrice! - price) / compareAtPrice!) * 100)
    : 0
  const tag = collection ?? category
  const showStatus = status && status !== 'Ready'
  const imageGallery = useMemo(() => {
    const merged = [image, ...galleryImages, imageHover ?? image].map((url) => url?.trim()).filter(Boolean)
    return [...new Set(merged)].slice(0, 4) as string[]
  }, [galleryImages, image, imageHover])
  const [hovered, setHovered] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const isShop = variant === 'shop'
  const isHomepage = variant === 'homepage'
  const imageFit = isHomepage || isShop ? 'cover' : fit
  const showCollectionTag = Boolean(tag) && !isHomepage && !isShop
  const mediaTransition = productMediaTransitionStyle(id, reducedMotion)
  const showGalleryNav = !isShop && !isHomepage && imageGallery.length > 1
  const displayImage = useMemo(() => {
    if (imageGallery.length <= 1) return image
    if (showGalleryNav) return imageGallery[galleryIndex] ?? image
    if (hovered) {
      if (isShop || isHomepage) return imageGallery[1] ?? image
      return imageGallery[galleryIndex] ?? image
    }
    return image
  }, [galleryIndex, hovered, image, imageGallery, isHomepage, isShop, showGalleryNav])

  useEffect(() => {
    if (!hovered || imageGallery.length <= 1 || showGalleryNav || isShop || isHomepage) {
      setGalleryIndex(0)
      return
    }
    const timer = window.setInterval(() => {
      setGalleryIndex((current) => (current + 1) % imageGallery.length)
    }, 850)
    return () => window.clearInterval(timer)
  }, [hovered, imageGallery.length, showGalleryNav, isHomepage, isShop])

  const imageTransition = reducedMotion
    ? { duration: 0 }
    : MEDIA

  const imageEnter = reducedMotion
    ? { opacity: 1 }
    : { opacity: 0 }

  const imageExit = reducedMotion ? { opacity: 1 } : { opacity: 0 }

  const handleGalleryPrev = useCallback(() => {
    setGalleryIndex((current) => (current - 1 + imageGallery.length) % imageGallery.length)
  }, [imageGallery.length])

  const handleGalleryNext = useCallback(() => {
    setGalleryIndex((current) => (current + 1) % imageGallery.length)
  }, [imageGallery.length])

  const handleCardAction = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (isShop || isHomepage) {
        if (adding) return
        // Multi size/colour → open quick view instead of guessing first variant.
        const needsChoice = productSizes.length > 1 || colorHexes.length > 1
        if (needsChoice && onShowDetails) {
          onShowDetails()
          return
        }
        setAdding(true)
        onAddToBag?.()
        window.setTimeout(() => setAdding(false), 420)
        return
      }
      const addingToWishlist = !isInWishlist(id)
      toggleWishlist(id)
      if (addingToWishlist) {
        trackAddToWishlist({ id, name, price, quantity: 1, brand: 'SPLARO' })
      }
    },
    [
      adding,
      colorHexes.length,
      id,
      isHomepage,
      isInWishlist,
      isShop,
      name,
      onAddToBag,
      onShowDetails,
      price,
      productSizes.length,
      toggleWishlist,
    ],
  )

  return (
    <article
      className={cn(
        'splaro-card group',
        !inStock && 'splaro-card--out-of-stock',
        isShop && 'splaro-card--shop',
        isHomepage && 'splaro-card--homepage',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <m.div
        className="splaro-card__media"
      >
        <ProductTransitionLink
          href={link}
          className="splaro-card__link"
          aria-label={name}
          prefetch={!(isHomepage && mounted && isMobile)}
        >
          <div className="product-shared-media" style={mediaTransition}>
            <AnimatePresence mode="sync" initial={false}>
              <m.div
                key={displayImage}
                className="splaro-card__img-frame"
                initial={imageEnter}
                animate={{ opacity: 1, scale: 1 }}
                exit={imageExit}
                transition={imageTransition}
              >
                <StorefrontImage
                  src={displayImage}
                  alt={name}
                  profile="card"
                  fill
                  fit={imageFit}
                  priority={priority}
                  allowStockMedia
                  className={cn(
                    'splaro-card__img splaro-card__img--primary',
                    imageFit === 'cover'
                      ? 'splaro-card__img--cover'
                      : 'splaro-card__img--contain',
                  )}
                />
              </m.div>
            </AnimatePresence>
          </div>
        </ProductTransitionLink>

        {showGalleryNav ? (
          <m.div
            className="splaro-card__gallery-nav"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(event) => event.stopPropagation()}
          >
            <LiquidGlassNavPair onPrev={handleGalleryPrev} onNext={handleGalleryNext} />
          </m.div>
        ) : null}

        {showStatus ? (
          <span
            className={cn(
              'splaro-card__badge',
              status === 'Limited' && 'splaro-card__badge--limited',
            )}
          >
            {status === 'New' ? 'NEW' : status.toUpperCase()}
          </span>
        ) : null}
        {hasDiscount && !showStatus ? (
          <span className="splaro-card__badge splaro-card__badge--sale">
            -{discount}%
          </span>
        ) : null}

        {showCollectionTag ? (
          <span className="splaro-card__collection">{tag}</span>
        ) : null}

        {!inStock ? <span className="splaro-card__sold-badge">Sold out</span> : null}

        {inStock ? (
          <m.button
            type="button"
            data-no-press=""
            {...(reducedMotion ? {} : { whileTap: { opacity: 0.9 } })}
            transition={PRESS_DOWN}
            className={cn(
              'splaro-card__wish',
              !isShop && !isHomepage && saved && 'splaro-card__wish--saved',
              'splaro-card__wish--touch',
              isHomepage && 'splaro-card__wish--homepage',
              adding && 'splaro-card__wish--adding',
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
            <AnimatePresence mode="wait" initial={false}>
              {adding ? (
                <m.span
                  key="loading"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  {...(reducedMotion ? {} : { exit: { opacity: 0, scale: 0.8 } })}
                  transition={PRESS_DOWN}
                  className="inline-flex"
                >
                  <Loader2 className="splaro-card__wish-spinner h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                </m.span>
              ) : isShop || isHomepage ? (
                <m.span
                  key="bag"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  {...(reducedMotion ? {} : { exit: { opacity: 0, scale: 0.85 } })}
                  transition={PRESS_DOWN}
                  className="inline-flex"
                >
                  <ShoppingBag size={isHomepage ? 16 : 13} strokeWidth={1.5} />
                </m.span>
              ) : (
                <m.span
                  key="heart"
                  initial={false}
                  animate={{ scale: saved ? 1.08 : 1 }}
                  transition={IMAGE_SPRING}
                  className="inline-flex"
                >
                  <Heart size={13} strokeWidth={1.5} className={cn(saved && 'fill-current')} />
                </m.span>
              )}
            </AnimatePresence>
          </m.button>
        ) : null}
      </m.div>

        <ProductTransitionLink
          href={link}
          className="splaro-card__info"
          tabIndex={-1}
        >
        <div className="splaro-card__title-row">
          <h3 className="splaro-card__name">{name}</h3>
          {productCode ? (
            <span className="splaro-card__code">{productCode}</span>
          ) : null}
        </div>

        {colorHexes.length > 0 ? (
          <div className="splaro-card__colors">
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

        <div className="splaro-card__price-row">
          <span className="splaro-card__price">{formatBDT(price)}</span>
          {hasDiscount ? (
            <span className="splaro-card__compare">{formatBDT(compareAtPrice!)}</span>
          ) : null}
          {meta ? <span className="splaro-card__meta">{meta}</span> : null}
        </div>
      </ProductTransitionLink>
    </article>
  )
}
