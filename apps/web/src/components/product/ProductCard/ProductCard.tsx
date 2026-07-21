'use client'

import { useState, useCallback } from 'react'
import { motion, useReducedMotion } from '@/lib/motion/react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import { MotionPressable } from '@/components/ui/MotionPressable'
import { useMotionReady } from '@/hooks/useMotionReady'
import { ProductTransitionLink } from '@/components/product/ProductTransitionLink'
import { productMediaTransitionStyle } from '@/lib/navigation/view-transition'
import { Heart, ShoppingBag, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'
import { pluralize } from '@/lib/utils/pluralize'
import { trackAddToCart, trackAddToWishlist } from '@/lib/analytics/meta-pixel'
import { resolveQuickAddVariant } from '@/lib/catalog/index'
import { fadeUp, cardHover } from '@/lib/motion/variants'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import type { ProductCardData } from '@/types/product'
import type { ProductStatus } from '@/data/storefront'

function productImages(product: ProductCardData): string[] {
  const fromList = (product.images ?? []).map((url) => url?.trim()).filter(Boolean) as string[]
  if (fromList.length) return fromList
  return [PRODUCT_IMAGE_PLACEHOLDER]
}

interface ProductCardProps {
  product: ProductCardData
  priority?: boolean
  variant?: 'default' | 'shop'
  productCode?: string
  productStatus?: ProductStatus
  sizes?: string[]
  colorHexes?: string[]
  productHref?: string
  onShopAddToBag?: (size?: string, color?: string) => void
}

export function ProductCard({
  product,
  priority = false,
  variant = 'default',
  productCode,
  productStatus = 'Ready',
  sizes = [],
  colorHexes = [],
  productHref,
  onShopAddToBag,
}: ProductCardProps) {
  if (variant === 'shop') {
    return (
      <ProductCardShop
        product={product}
        priority={priority}
        {...(productCode ? { productCode } : {})}
        productStatus={productStatus}
        sizes={sizes}
        colorHexes={colorHexes}
        productHref={productHref ?? `/products/${product.slug}`}
        {...(onShopAddToBag ? { onShopAddToBag } : {})}
      />
    )
  }

  return <ProductCardDefault product={product} priority={priority} />
}

function ProductCardDefault({ product, priority }: { product: ProductCardData; priority: boolean }) {
  const [hovered, setHovered] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const reducedMotion = useReducedMotion()
  const { showMotion, allowRevealAnimation } = useMotionReady()
  const images = productImages(product)

  const addToCart = useCartStore((s) => s.addItem)
  const wishlistHydrated = useWishlistStore((s) => s._hydrated)
  const { toggleWishlist, isInWishlist } = useWishlistStore()
  const inWishlist = wishlistHydrated && isInWishlist(product.id)

  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const defaultColorOpt = product.colorOptions?.[0]
      const defaultColorHex = defaultColorOpt?.hex ?? product.colorHexes?.[0]
      const colorLabel = defaultColorOpt?.name ?? defaultColorHex
      const defaultSize = product.sizes?.[0]
      const variant = resolveQuickAddVariant(
        product.variantRefs?.length ? { variantRefs: product.variantRefs } : {},
        defaultSize,
        defaultColorHex,
      )
      const size = variant?.size ?? defaultSize
      addToCart({
        productId: product.id,
        quantity: 1,
        name: product.name,
        price: product.price,
        image: images[0] ?? PRODUCT_IMAGE_PLACEHOLDER,
        slug: product.slug,
        ...(variant ? { variantId: variant.id } : {}),
        ...(size ? { size } : {}),
        ...(colorLabel ? { color: colorLabel } : {}),
      })
      trackAddToCart({
        id: variant?.id ?? product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        brand: 'SPLARO',
        ...(size || colorLabel
          ? { variant: [size, colorLabel].filter(Boolean).join(' / ') }
          : {}),
      })
    },
    [addToCart, product, images],
  )

  const handleWishlist = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const adding = !isInWishlist(product.id)
      toggleWishlist(product.id)
      if (adding) {
        trackAddToWishlist({
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          brand: 'SPLARO',
        })
      }
    },
    [toggleWishlist, isInWishlist, product.id, product.name, product.price],
  )

  const prevImg = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setImgIndex((i) => (i === 0 ? images.length - 1 : i - 1))
    },
    [images.length],
  )

  const nextImg = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setImgIndex((i) => (i === images.length - 1 ? 0 : i + 1))
    },
    [images.length],
  )

  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0

  const colorCount = product.colorOptions?.length ?? 0
  const hasMultipleImages = images.length > 1
  const currentImage = images[imgIndex] ?? images[0] ?? PRODUCT_IMAGE_PLACEHOLDER

  const revealMotion = !allowRevealAnimation
    ? { initial: false as const }
    : {
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: { once: true, margin: '-60px' as const },
        variants: fadeUp,
      }

  const mediaTransition = productMediaTransitionStyle(product.id, reducedMotion)

  return (
    <motion.article
      className="pc-shell group"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      {...revealMotion}
      {...(showMotion && !reducedMotion ? cardHover : {})}
    >
      <div className="pc-media">
        <ProductTransitionLink
          href={`/products/${product.slug}`}
          className="pc-media__link"
          aria-label={product.name}
        >
          <div className="product-shared-media" style={mediaTransition}>
            <StorefrontImage
              src={currentImage}
              alt={product.name}
              profile="card"
              fill
              fit="cover"
              className="pc-media__img"
              priority={priority}
            />
          </div>
        </ProductTransitionLink>

        {hasDiscount && <span className="pc-badge pc-badge--sale">-{discountPercent}%</span>}
        {product.isNewArrival && !hasDiscount && <span className="pc-badge pc-badge--new">New</span>}

        {hasMultipleImages && (
          <>
            <motion.button
              className="pc-arrow pc-arrow--prev"
              onClick={prevImg}
              aria-label="Previous image"
              initial={{ opacity: 0 }}
              animate={{ opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.18 }}
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </motion.button>
            <motion.button
              className="pc-arrow pc-arrow--next"
              onClick={nextImg}
              aria-label="Next image"
              initial={{ opacity: 0 }}
              animate={{ opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.18 }}
            >
              <ChevronRight size={16} strokeWidth={2} />
            </motion.button>
          </>
        )}

        <MotionPressable
          className="pc-cart-btn"
          variant="icon"
          onClick={handleAddToCart}
          aria-label={`Add ${product.name} to cart`}
          type="button"
        >
          <ShoppingBag size={14} strokeWidth={1.4} />
        </MotionPressable>

        <motion.button
          className={cn('pc-wish-btn', 'pc-wish-btn--touch', inWishlist && 'pc-wish-btn--saved')}
          onClick={handleWishlist}
          aria-label={inWishlist ? 'Remove from wishlist' : 'Save'}
          aria-pressed={inWishlist}
          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
          {...(showMotion ? { whileTap: { opacity: 0.9 } } : {})}
        >
          <Heart size={14} strokeWidth={1.6} className={cn(inWishlist && 'fill-current')} />
        </motion.button>
      </div>

      <ProductTransitionLink href={`/products/${product.slug}`} className="pc-info" tabIndex={-1}>
        <div className="pc-info__row">
          <span className="pc-info__name">{product.name}</span>
          {product.category && <span className="pc-info__sku">{product.category}</span>}
        </div>

        {colorCount > 0 && (
          <p className="pc-info__colors">
            <span>{pluralize(colorCount, 'color')}</span>
            <ChevronDown size={12} strokeWidth={2} aria-hidden />
          </p>
        )}

        <div className="pc-info__price-row">
          <span className="pc-info__price">{formatBDT(product.price)}</span>
          {hasDiscount && <span className="pc-info__compare">{formatBDT(product.compareAtPrice!)}</span>}
        </div>
      </ProductTransitionLink>
    </motion.article>
  )
}

function ProductCardShop({
  product,
  priority,
  productCode,
  productStatus,
  sizes,
  colorHexes,
  productHref,
  onShopAddToBag,
}: {
  product: ProductCardData
  priority: boolean
  productCode?: string
  productStatus: ProductStatus
  sizes: string[]
  colorHexes: string[]
  productHref: string
  onShopAddToBag?: (size?: string, color?: string) => void
}) {
  const wishlistHydrated = useWishlistStore((s) => s._hydrated)
  const { toggleWishlist, isInWishlist } = useWishlistStore()
  const saved = wishlistHydrated && isInWishlist(product.id)
  const images = productImages(product)
  const primaryImage = images[0] ?? PRODUCT_IMAGE_PLACEHOLDER
  const hoverImage = images[1] ?? primaryImage
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const reducedMotion = useReducedMotion()
  const { showMotion } = useMotionReady()
  const mediaTransition = productMediaTransitionStyle(product.id, reducedMotion)

  const handleBag = (size?: string, color?: string) => {
    onShopAddToBag?.(size, color)
  }

  return (
    <motion.article
      className="shop-product-card group"
      {...(showMotion && !reducedMotion ? cardHover : {})}
    >
      <div className="shop-product-card__shell">
        <div className="shop-product-card__media-wrap">
        <ProductTransitionLink
          href={productHref}
          className="shop-product-card__link"
          aria-label={`View ${product.name}`}
        >
          <div className="shop-product-card__media">
            <div className="product-shared-media" style={mediaTransition}>
              <StorefrontImage
                src={primaryImage}
                alt={product.name}
                profile="card"
                fill
                fit="cover"
                className="shop-product-card__img shop-product-card__img--primary"
                priority={priority}
              />
            </div>
            <StorefrontImage
              src={hoverImage}
              alt=""
              profile="card"
              fill
              fit="cover"
              className="shop-product-card__img shop-product-card__img--hover"
              aria-hidden
            />

            {productStatus !== 'Ready' ? (
              <span
                className={cn(
                  'shop-product-badge shop-product-badge--premium',
                  productStatus === 'New' && 'shop-product-badge--new',
                  productStatus === 'Limited' && 'shop-product-badge--limited',
                )}
              >
                {productStatus === 'New' ? 'NEW' : productStatus.toUpperCase()}
              </span>
            ) : null}
          </div>

          <div className="shop-product-card__info">
            <h3 className="shop-product-card__title">{product.name}</h3>
            {productCode ? <span className="shop-product-card__code">{productCode}</span> : null}
            {colorHexes.length > 0 ? (
              <div className="shop-product-card__colors">
                <span className="shop-product-card__colors-text">
                  {pluralize(colorHexes.length, 'color')}
                </span>
                <span className="shop-product-card__color-dots" aria-hidden>
                  {colorHexes.slice(0, 3).map((color) => (
                    <span key={color} className="shop-card-dot" style={{ backgroundColor: color }} />
                  ))}
                </span>
              </div>
            ) : null}
            <div className="shop-product-card__price-row">
              <span
                className={cn(
                  'shop-product-card__price',
                  hasDiscount && 'shop-product-card__price--sale',
                )}
              >
                {formatBDT(product.price)}
              </span>
              {hasDiscount ? (
                <span className="shop-product-card__compare">{formatBDT(product.compareAtPrice!)}</span>
              ) : null}
            </div>
          </div>
        </ProductTransitionLink>
        </div>

        <div className="shop-product-card__media-actions" aria-hidden={false}>
          <MotionPressable
            type="button"
            variant="icon"
            className={cn('shop-wishlist-btn', saved && 'shop-wishlist-btn--saved')}
            onClick={() => {
              const adding = !saved
              toggleWishlist(product.id)
              if (adding) {
                trackAddToWishlist({
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  quantity: 1,
                  brand: 'SPLARO',
                })
              }
            }}
            aria-label={saved ? 'Remove from saved' : 'Save product'}
          >
            <Heart className={cn('h-3.5 w-3.5', saved && 'fill-current')} strokeWidth={2} />
          </MotionPressable>

          <MotionPressable
            type="button"
            variant="icon"
            className="shop-bag-btn"
            onClick={() => handleBag(sizes[0], colorHexes[0])}
            aria-label={`Add ${product.name} to bag`}
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={2} />
          </MotionPressable>

          {sizes.length > 0 ? (
            <div className="shop-quickadd">
              <div className="shop-quickadd__sizes">
                {sizes.slice(0, 5).map((size) => (
                  <button
                    key={size}
                    type="button"
                    className="shop-quickadd__size"
                    onClick={() => handleBag(size, colorHexes[0])}
                    aria-label={`Add size ${size} to bag`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </motion.article>
  )
}
