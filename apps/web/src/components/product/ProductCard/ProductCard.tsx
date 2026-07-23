'use client'

import { useState, useCallback } from 'react'
import { motion, useReducedMotion } from '@/lib/motion/react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import { MotionPressable } from '@/components/ui/MotionPressable'
import { useMotionReady } from '@/hooks/useMotionReady'
import { ProductTransitionLink } from '@/components/product/ProductTransitionLink'
import { productMediaTransitionStyle } from '@/lib/navigation/view-transition'
import { Heart, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { BagIcon } from '@/components/product/AddToBagIcon'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/lib/utils/cn'
import { ProductDiscountBadge, ProductPrice } from '@/components/product/ProductPrice'
import { pluralize } from '@/lib/utils/pluralize'
import { trackAddToCart, trackAddToWishlist } from '@/lib/analytics/meta-pixel'
import { resolveQuickAddVariant } from '@/lib/catalog/index'
import { resolveStockStatus } from '@/lib/catalog/stock-status'
import { cardHover } from '@/lib/motion/variants'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import type { ProductCardData } from '@/types/product'
import type { ProductStatus } from '@/data/storefront'

function cardStock(product: ProductCardData) {
  if (typeof product.stockUnits === 'number') return resolveStockStatus(product.stockUnits)
  if (product.variantRefs?.length) {
    const units = product.variantRefs
      .filter((ref) => ref.isActive !== false)
      .reduce((sum, ref) => sum + Math.max(0, Number(ref.stock) || 0), 0)
    return resolveStockStatus(units)
  }
  // Bundled/static cards without inventory — don't fake Sold Out.
  return { kind: 'in_stock' as const, units: 0, label: 'In Stock' }
}

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
  const { showMotion } = useMotionReady()
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

  const hasDiscount = Boolean(product.compareAtPrice && product.compareAtPrice > product.price)

  const colorCount = product.colorOptions?.length ?? 0
  const hasMultipleImages = images.length > 1
  const currentImage = images[imgIndex] ?? images[0] ?? PRODUCT_IMAGE_PLACEHOLDER

  // No whileInView on cards — grid opacity gates fight Lenis and feel like scroll jank.
  // Premium stays via cardHover + Pearl CSS; content is always visible.
  const mediaTransition = productMediaTransitionStyle(product.id, reducedMotion)

  return (
    <motion.article
      className="pc-shell group"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      initial={false}
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

        {hasDiscount && product.compareAtPrice ? (
          <ProductDiscountBadge
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            className="pc-badge pc-badge--sale"
          />
        ) : null}
        {product.isNewArrival && !hasDiscount && <span className="pc-badge pc-badge--new">New</span>}
        {product.isUnisex ? <span className="pc-badge pc-badge--unisex">Unisex</span> : null}

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
          <BagIcon size={15} strokeWidth={1.37} plus />
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
          <span className="pc-info__meta">
            {product.isUnisex ? <span className="pc-info__audience">Unisex</span> : null}
            {product.category ? <span className="pc-info__sku">{product.category}</span> : null}
          </span>
        </div>

        {colorCount > 0 && (
          <p className="pc-info__colors">
            <span>{pluralize(colorCount, 'color')}</span>
            <ChevronDown size={12} strokeWidth={2} aria-hidden />
          </p>
        )}

        <ProductPrice
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          className="pc-info__price-row"
          priceClassName="pc-info__price"
          compareClassName="pc-info__compare"
        />
        {(() => {
          const stock = cardStock(product)
          return (
            <p className={cn('pc-info__stock', `pc-info__stock--${stock.kind.replaceAll('_', '-')}`)}>
              {stock.label}
            </p>
          )
        })()}
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
  const addToCart = useCartStore((s) => s.addItem)
  const images = productImages(product)
  const primaryImage = images[0] ?? PRODUCT_IMAGE_PLACEHOLDER
  const hoverImage = images[1] ?? primaryImage
  const reducedMotion = useReducedMotion()
  const { showMotion } = useMotionReady()
  const mediaTransition = productMediaTransitionStyle(product.id, reducedMotion)

  const handleBag = (size?: string, color?: string) => {
    if (onShopAddToBag) {
      onShopAddToBag(size, color)
      return
    }
    const colorOpt = product.colorOptions?.find((c) => c.hex === color) ?? product.colorOptions?.[0]
    const colorLabel = colorOpt?.name ?? color
    const variant = resolveQuickAddVariant(
      product.variantRefs?.length ? { variantRefs: product.variantRefs } : {},
      size,
      color,
    )
    addToCart({
      productId: product.id,
      quantity: 1,
      name: product.name,
      price: product.price,
      image: primaryImage,
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
            {product.isUnisex ? (
              <span className="shop-product-badge shop-product-badge--unisex">Unisex</span>
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
            <ProductPrice
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              className="shop-product-card__price-row"
              priceClassName="shop-product-card__price"
              compareClassName="shop-product-card__compare"
              salePriceClassName="shop-product-card__price--sale"
            />
            {(() => {
              const stock = cardStock(product)
              return (
                <p
                  className={cn(
                    'shop-product-card__stock',
                    `shop-product-card__stock--${stock.kind.replaceAll('_', '-')}`,
                  )}
                >
                  {stock.label}
                </p>
              )
            })()}
          </div>
        </ProductTransitionLink>
        </div>

        <div className="shop-product-card__media-actions" aria-hidden={false}>
          <MotionPressable
            type="button"
            variant="icon"
            className="shop-bag-btn"
            onClick={() => handleBag(sizes[0], colorHexes[0])}
            aria-label={`Add ${product.name} to bag`}
          >
            <BagIcon size={18} strokeWidth={1.37} plus />
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
