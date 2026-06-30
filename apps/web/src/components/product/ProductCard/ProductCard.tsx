'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { Heart, ShoppingBag, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'
import { trackAddToCart } from '@/lib/analytics/meta-pixel'
import { fadeUp } from '@/lib/motion/variants'
import type { ProductCardData } from '@/types/product'
import type { ProductStatus } from '@/data/storefront'

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

  const addToCart = useCartStore((s) => s.addItem)
  const { toggleWishlist, isInWishlist } = useWishlistStore()
  const inWishlist = isInWishlist(product.id)

  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      addToCart({
        productId: product.id,
        variantId: product.id,
        quantity: 1,
        name: product.name,
        price: product.price,
        image: product.images[0] ?? '',
        slug: product.slug,
      })
      trackAddToCart({ id: product.id, name: product.name, price: product.price })
    },
    [addToCart, product],
  )

  const handleWishlist = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      toggleWishlist(product.id)
    },
    [toggleWishlist, product.id],
  )

  const prevImg = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setImgIndex((i) => (i === 0 ? product.images.length - 1 : i - 1))
    },
    [product.images.length],
  )

  const nextImg = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setImgIndex((i) => (i === product.images.length - 1 ? 0 : i + 1))
    },
    [product.images.length],
  )

  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0

  const colorCount = product.colorOptions?.length ?? 0
  const hasMultipleImages = product.images.length > 1
  const currentImage = product.images[imgIndex] ?? product.images[0] ?? ''

  const revealMotion = reducedMotion
    ? { initial: false as const }
    : {
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: { once: true, margin: '-60px' as const },
        variants: fadeUp,
      }

  return (
    <motion.article
      className="pc-shell group"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      {...revealMotion}
    >
      <div className="pc-media">
        <Link href={`/products/${product.slug}`} className="pc-media__link" aria-label={product.name}>
          <Image
            src={currentImage}
            alt={product.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="pc-media__img"
          />
        </Link>

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

        <button
          className="pc-cart-btn"
          onClick={handleAddToCart}
          aria-label={`Add ${product.name} to cart`}
          type="button"
        >
          <ShoppingBag size={14} strokeWidth={1.4} />
        </button>

        <motion.button
          className={cn('pc-wish-btn', inWishlist && 'pc-wish-btn--saved')}
          onClick={handleWishlist}
          aria-label={inWishlist ? 'Remove from wishlist' : 'Save'}
          aria-pressed={inWishlist}
          initial={{ opacity: 0 }}
          animate={{ opacity: hovered || inWishlist ? 1 : 0 }}
          transition={{ duration: 0.18 }}
        >
          <Heart size={14} strokeWidth={1.6} className={cn(inWishlist && 'fill-current')} />
        </motion.button>
      </div>

      <Link href={`/products/${product.slug}`} className="pc-info" tabIndex={-1}>
        <div className="pc-info__row">
          <span className="pc-info__name">{product.name}</span>
          {product.category && <span className="pc-info__sku">{product.category}</span>}
        </div>

        {colorCount > 0 && (
          <p className="pc-info__colors">
            <span>
              {colorCount} color{colorCount > 1 ? 's' : ''}
            </span>
            <ChevronDown size={12} strokeWidth={2} aria-hidden />
          </p>
        )}

        <div className="pc-info__price-row">
          <span className="pc-info__price">{formatBDT(product.price)}</span>
          {hasDiscount && <span className="pc-info__compare">{formatBDT(product.compareAtPrice!)}</span>}
        </div>
      </Link>
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
  const { toggleWishlist, isInWishlist } = useWishlistStore()
  const saved = isInWishlist(product.id)
  const primaryImage = product.images[0] ?? ''
  const hoverImage = product.images[1] ?? primaryImage
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price

  const handleBag = (size?: string, color?: string) => {
    onShopAddToBag?.(size, color)
  }

  return (
    <article className="shop-product-card group">
      <div className="shop-product-card__shell">
        <Link href={productHref} className="shop-product-card__link" aria-label={`View ${product.name}`} prefetch={false}>
          <div className="shop-product-card__media">
            <Image
              src={primaryImage}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="shop-product-card__img shop-product-card__img--primary"
              priority={priority}
            />
            <Image
              src={hoverImage}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="shop-product-card__img shop-product-card__img--hover"
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
                  {colorHexes.length} color{colorHexes.length > 1 ? 's' : ''}
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
        </Link>

        <div className="shop-product-card__media-actions" aria-hidden={false}>
          <button
            type="button"
            className={cn('shop-wishlist-btn', saved && 'shop-wishlist-btn--saved')}
            onClick={() => toggleWishlist(product.id)}
            aria-label={saved ? 'Remove from saved' : 'Save product'}
          >
            <Heart className={cn('h-3.5 w-3.5', saved && 'fill-current')} strokeWidth={2} />
          </button>

          <button
            type="button"
            className="shop-bag-btn"
            onClick={() => handleBag(sizes[0], colorHexes[0])}
            aria-label={`Add ${product.name} to bag`}
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={2} />
          </button>

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
    </article>
  )
}
