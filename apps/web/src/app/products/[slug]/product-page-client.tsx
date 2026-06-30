'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  Ruler,
  ShoppingBag,
  Star,
} from 'lucide-react'
import { ProductCard } from '@/components/product/ProductCard/ProductCard'
import { trackRecentlyViewed } from '@/lib/recentlyViewed'
import { collectionHref } from '@/lib/storefront/collection-paths'
import { useCartStore } from '@/store/cartStore'
import { useUiStore } from '@/store/uiStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'
import { trackAddToCart, trackViewContent } from '@/lib/analytics/meta-pixel'
import type { ProductDetailData } from '@/types/product'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { sanitizeRemoteImageUrl } from '@/lib/assets/images'
import type { ProductReview } from '@/lib/catalog/live'
import { sortSizes } from '@/lib/catalog/live'

interface ProductPageClientProps {
  product: ProductDetailData
  reviews?: ProductReview[]
  relatedProducts?: ProductDetailData[]
}

const PANEL_EASE = [0.22, 1, 0.36, 1] as const
const PANEL_MS = 0.3

export default function ProductPageClient({
  product,
  reviews = [],
  relatedProducts = [],
}: ProductPageClientProps) {
  const router = useRouter()
  const addItem = useCartStore((state) => state.addItem)
  const setCartOpen = useUiStore((state) => state.setCartOpen)
  const { toggleWishlist, isInWishlist } = useWishlistStore()

  const [activeImage, setActiveImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [addedPulse, setAddedPulse] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)

  const fullDescription = product.description?.trim() ?? ''
  const shortDesc =
    product.shortDescription?.trim() ||
    (fullDescription.length > 160 ? `${fullDescription.slice(0, 157)}…` : fullDescription)
  const showReadMore = fullDescription.length > 160 && !product.shortDescription

  const colorOptions = useMemo(() => {
    const map = new Map<string, { hex: string; name: string; image: string }>()

    product.variants.forEach((v) => {
      if (!v.colorHex) return
      const hex = v.colorHex.toLowerCase()
      if (!map.has(hex)) {
        map.set(hex, {
          hex,
          name: v.colorName ?? v.color ?? 'Selected',
          image: v.image ? sanitizeRemoteImageUrl(v.image) : '',
        })
      }
    })

    if (product.colorOptions?.length && map.size === 0) {
      product.colorOptions.forEach((opt, index) => {
        map.set(opt.hex.toLowerCase(), {
          hex: opt.hex.toLowerCase(),
          name: opt.name,
          image: sanitizeRemoteImageUrl(product.images[index] ?? product.images[0] ?? ''),
        })
      })
    }

    const options = [...map.values()]
    if (options.length > 1 && product.images.length > 1) {
      const uniqueImages = new Set(options.map((o) => o.image).filter(Boolean))
      if (uniqueImages.size <= 1) {
        return options.map((opt, index) => ({
          ...opt,
          image:
            sanitizeRemoteImageUrl(product.images[index] ?? product.images[0] ?? '') ||
            opt.image ||
            PRODUCT_IMAGE_PLACEHOLDER,
        }))
      }
    }

    return options.map((opt) => ({
      ...opt,
      image: opt.image || sanitizeRemoteImageUrl(product.images[0] ?? '') || PRODUCT_IMAGE_PLACEHOLDER,
    }))
  }, [product.colorOptions, product.images, product.variants])

  const colors = useMemo(
    () => colorOptions.map((opt) => [opt.hex, opt.name] as [string, string]),
    [colorOptions],
  )

  const activeColorOption = useMemo(
    () => colorOptions.find((opt) => opt.hex === selectedColor) ?? colorOptions[0],
    [colorOptions, selectedColor],
  )

  const colorMediaMap = useMemo(() => {
    const map = new Map<string, string[]>()
    product.variants.forEach((v) => {
      if (!v.colorHex) return
      const hex = v.colorHex.toLowerCase()
      const list = map.get(hex) ?? []
      const img = v.image ? sanitizeRemoteImageUrl(v.image) : ''
      if (img && !list.includes(img)) list.push(img)
      map.set(hex, list)
    })
    colorOptions.forEach((opt) => {
      const list = map.get(opt.hex) ?? []
      if (opt.image && !list.includes(opt.image)) list.unshift(opt.image)
      map.set(opt.hex, list.length ? list : [opt.image])
    })
    return map
  }, [colorOptions, product.variants])

  const media = useMemo(() => {
    const baseGallery = product.media?.length
      ? product.media
          .map((item) => ({
            type: item.type,
            url: item.type === 'image' ? sanitizeRemoteImageUrl(item.url) : item.url,
          }))
          .filter((item) => Boolean(item.url))
      : product.images
          .map((url) => ({ type: 'image' as const, url: sanitizeRemoteImageUrl(url) }))
          .filter((item) => Boolean(item.url))

    const hex = selectedColor?.toLowerCase()
    const colorUrls = hex ? colorMediaMap.get(hex)?.filter(Boolean) : undefined

    // Multiple uploads but one colour — show full gallery, not a single variant thumb.
    if (baseGallery.length > 1 && (!colorUrls?.length || colorUrls.length === 1)) {
      return baseGallery
    }

    if (colorUrls?.length) {
      return colorUrls.map((url) => ({ type: 'image' as const, url }))
    }

    return baseGallery.length > 0
      ? baseGallery
      : [{ type: 'image' as const, url: PRODUCT_IMAGE_PLACEHOLDER }]
  }, [colorMediaMap, product.images, product.media, selectedColor])
  const saved = isInWishlist(product.id)

  const sizes = useMemo(() => {
    const unique = new Set(product.variants.map((v) => v.size).filter(Boolean))
    return sortSizes(Array.from(unique) as string[], product.category)
  }, [product.variants, product.category])

  const showColorPicker = useMemo(() => {
    if (colorOptions.length > 1) return true
    if (colorOptions.length === 0) return false
    const name = colorOptions[0]?.name.trim().toLowerCase() ?? ''
    return name !== 'default' && name !== 'selected'
  }, [colorOptions])

  const sizeStock = useMemo(() => {
    const map = new Map<string, number>()
    product.variants.forEach((v) => {
      if (!v.size) return
      if (selectedColor && v.colorHex?.toLowerCase() !== selectedColor.toLowerCase()) return
      map.set(v.size, (map.get(v.size) ?? 0) + v.stock)
    })
    return map
  }, [product.variants, selectedColor])

  const activeVariant = useMemo(() => {
    return product.variants.find(
      (v) =>
        (!selectedSize || v.size === selectedSize) &&
        (!selectedColor || v.colorHex?.toLowerCase() === selectedColor.toLowerCase()),
    )
  }, [product.variants, selectedSize, selectedColor])

  const selectedColorName =
    colors.find(([hex]) => hex === selectedColor)?.[1] ?? '—'

  const stock = activeVariant?.stock ?? product.variants.reduce((max, v) => Math.max(max, v.stock), 0)
  const inStock = stock > 0
  const lowStock = inStock && stock <= 5
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPct = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0

  useEffect(() => {
    trackRecentlyViewed(product.id)
    trackViewContent({ id: product.id, name: product.name, price: product.price })
    setSelectedSize(sizes[0] ?? null)
    setSelectedColor(colorOptions[0]?.hex ?? null)
    setActiveImage(0)
    setQuantity(1)
    setDescExpanded(false)
    setOpenSection(null)
  }, [product.id, product.name, product.price, sizes, colorOptions])

  useEffect(() => {
    setActiveImage(0)
    if (selectedColor && selectedSize && (sizeStock.get(selectedSize) ?? 0) === 0) {
      const next = sizes.find((size) => (sizeStock.get(size) ?? 0) > 0)
      if (next) setSelectedSize(next)
    }
  }, [selectedColor, selectedSize, sizeStock, sizes])

  const productCode = product.sku ?? product.slug.replace(/-/g, ' ').slice(0, 12).toUpperCase()

  const detailSections = useMemo(() => {
    const sections: { id: string; content: string }[] = []

    const detailsParts = [
      fullDescription,
      product.fabricContent ? `Materials · ${product.fabricContent}` : null,
      product.occasion ? `Occasion · ${product.occasion}` : null,
      product.season ? `Season · ${product.season}` : null,
    ].filter(Boolean) as string[]

    if (detailsParts.length > 0) {
      sections.push({ id: 'Details', content: detailsParts.join('\n\n') })
    }

    const shippingParts = [
      'Complimentary standard delivery across Bangladesh within 3–7 business days.',
      'Express same-day delivery available in Dhaka metro.',
      product.origin ? `Origin · ${product.origin}` : null,
    ].filter(Boolean) as string[]

    sections.push({ id: 'Shipping', content: shippingParts.join('\n\n') })

    const careParts = [
      product.careInstructions,
      product.fitType ? `Fit · ${product.fitType}` : null,
    ].filter(Boolean) as string[]

    if (careParts.length > 0) {
      sections.push({ id: 'Care', content: careParts.join('\n\n') })
    }

    return sections
  }, [
    fullDescription,
    product.careInstructions,
    product.fabricContent,
    product.fitType,
    product.occasion,
    product.origin,
    product.season,
  ])

  const handleAddToCart = () => {
    if (!inStock) return
    addItem({
      productId: product.id,
      variantId: activeVariant?.id ?? product.id,
      quantity,
      name: product.name,
      price: product.price,
      image: activeVariant?.image ?? activeColorOption?.image ?? product.images[0] ?? '',
      slug: product.slug,
      ...(selectedSize ? { size: selectedSize } : {}),
      // Store the readable colour name (e.g. "Brown"), not the raw hex, for the cart line.
      ...(selectedColor ? { color: selectedColorName !== '—' ? selectedColorName : selectedColor } : {}),
    })
    trackAddToCart({ id: product.id, name: product.name, price: product.price })
    setCartOpen(true)
    setAddedPulse(true)
    setTimeout(() => setAddedPulse(false), 1200)
  }

  const handleCheckout = () => {
    handleAddToCart()
    router.push('/checkout')
  }

  const prevImage = () => setActiveImage((i) => (i - 1 + media.length) % media.length)
  const nextImage = () => setActiveImage((i) => (i + 1) % media.length)

  return (
    <div className="pp-root">
      <div className="pp-root__ambient" aria-hidden="true" />

      <div className="pp-wrap">
        <nav className="pp-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden>/</span>
          <Link href={collectionHref(product.collectionSlug ?? 'all')}>{product.category}</Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="pp-grid">
          {/* ─── Gallery ─────────────────────────────────── */}
          <div className="pp-gallery">
            <div className="pp-gallery__inner">
              <div className="pp-gallery__main">
                <div className="pp-gallery__sheen" aria-hidden />
                <div className="pp-gallery__badges">
                  {product.isNewArrival && (
                    <span className="pp-badge pp-badge--new">New</span>
                  )}
                  {hasDiscount && (
                    <span className="pp-badge pp-badge--sale">-{discountPct}%</span>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${selectedColor ?? 'default'}-${media[activeImage]?.type}-${media[activeImage]?.url}`}
                    className="pp-gallery__stage"
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: PANEL_MS, ease: PANEL_EASE }}
                  >
                    {media[activeImage]?.type === 'video' ? (
                      <video
                        src={media[activeImage]!.url}
                        className="pp-gallery__video"
                        autoPlay
                        muted
                        loop
                        playsInline
                        controls
                      />
                    ) : (
                      <Image
                        src={media[activeImage]!.url}
                        alt={product.name}
                        fill
                        sizes="(max-width: 1024px) 92vw, 58vw"
                        className="pp-gallery__img"
                        priority
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {media.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prevImage}
                      className="pp-gallery__nav pp-gallery__nav--prev"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={18} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={nextImage}
                      className="pp-gallery__nav pp-gallery__nav--next"
                      aria-label="Next image"
                    >
                      <ChevronRight size={18} strokeWidth={2} />
                    </button>

                    <div className="pp-gallery__counter" aria-live="polite">
                      {activeImage + 1} / {media.length}
                    </div>
                  </>
                )}
              </div>

              {media.length > 1 && (
                <div className="pp-gallery__thumbstrip" aria-label="Product images">
                  {media.map((item, i) => (
                    <button
                      key={`${item.type}-${item.url}-${i}`}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`View ${item.type} ${i + 1} of ${media.length}`}
                      aria-current={i === activeImage ? 'true' : undefined}
                      className={cn(
                        'pp-gallery__thumb',
                        i === activeImage && 'pp-gallery__thumb--active',
                      )}
                    >
                      {item.type === 'video' ? (
                        <>
                          <video src={item.url} muted playsInline className="pp-gallery__thumb-img" />
                          <span className="pp-gallery__thumb-play" aria-hidden>Play</span>
                        </>
                      ) : (
                        <Image src={item.url} alt="" fill sizes="80px" className="pp-gallery__thumb-img" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── Product info card ─────────────────────── */}
          <aside className="pp-info">
            <div className="pp-info__sheen" aria-hidden />

            <div className="pp-info__header">
              <p className="pp-info__brand">SPLARO</p>
              <h1 className="pp-info__name">{product.name}</h1>
              <p className="pp-info__code">Product Code · {productCode}</p>
            </div>

            {product.reviewCount > 0 && (
              <div className="pp-info__rating">
                <div className="pp-info__stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'pp-info__star',
                        i < Math.round(product.rating) && 'pp-info__star--filled',
                      )}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <span>{product.rating.toFixed(1)}</span>
                <span className="pp-info__rating-sep">·</span>
                <span>{product.reviewCount} reviews</span>
              </div>
            )}

            <div className="pp-info__lead">
              <div className="pp-info__price-row">
                <span className="pp-info__price">{formatBDT(product.price)}</span>
                {hasDiscount && (
                  <>
                    <span className="pp-info__compare">{formatBDT(product.compareAtPrice!)}</span>
                    <span className="pp-info__discount-badge">-{discountPct}%</span>
                  </>
                )}
              </div>
            </div>

            {lowStock && (
              <p className="pp-info__lowstock">Only {stock} left — order soon</p>
            )}
            {!inStock && <p className="pp-info__outstock">Out of stock</p>}

            <div className="pp-info__options">
              {showColorPicker && (
                <fieldset className="pp-variant-fieldset">
                  <legend className="pp-info__option-label">
                    Colour ·{' '}
                    <span className="pp-info__option-value">{selectedColorName}</span>
                  </legend>
                  <div className="shopify-color-swatches" role="list">
                    {colorOptions.map((opt) => (
                      <button
                        key={opt.hex}
                        type="button"
                        role="listitem"
                        onClick={() => setSelectedColor(opt.hex)}
                        aria-label={`${opt.name} colour`}
                        aria-pressed={selectedColor === opt.hex}
                        className={cn(
                          'shopify-color-swatch',
                          selectedColor === opt.hex && 'shopify-color-swatch--active',
                        )}
                      >
                        <span className="shopify-color-swatch__frame">
                          <Image
                            src={opt.image}
                            alt=""
                            fill
                            sizes="80px"
                            className="shopify-color-swatch__img"
                          />
                        </span>
                        <span className="shopify-color-swatch__label">{opt.name}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {sizes.length > 0 && (
                <div className="pp-info__option">
                  <div className="pp-info__option-head">
                    <p className="pp-info__option-label pp-info__option-label--inline">Size</p>
                    <Link href="/size-guide" className="pdp-size-guide">
                      <Ruler className="h-3 w-3" strokeWidth={2} />
                      Size Guide
                    </Link>
                  </div>
                  <div className="pdp-size-row">
                    {sizes.map((size) => {
                      const qty = sizeStock.get(size) ?? stock
                      const disabled = qty === 0
                      return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => !disabled && setSelectedSize(size)}
                        aria-pressed={selectedSize === size}
                        disabled={disabled}
                        className={cn(
                          'pdp-size-btn',
                          selectedSize === size && 'pdp-size-btn--active',
                          disabled && 'pdp-size-btn--unavailable',
                        )}
                      >
                        {size}
                      </button>
                    )})}
                  </div>
                </div>
              )}

              <div className="pp-info__option">
                <p className="pp-info__option-label">Quantity</p>
                <div className="pp-qty">
                  <button
                    type="button"
                    className="pp-qty__btn"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                  <span className="pp-qty__value" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    className="pp-qty__btn"
                    onClick={() => setQuantity((q) => Math.min(stock || 99, q + 1))}
                    aria-label="Increase quantity"
                    disabled={!inStock || quantity >= stock}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            </div>

            <div className="pp-info__ctas">
              <div className="pdp-trust" aria-label="Shopping assurances">
                <span>Easy returns</span>
                <span>Secure checkout</span>
                <span>Fast delivery</span>
              </div>

              <button
                type="button"
                className={cn('pdp-cta-add', addedPulse && 'pdp-cta-add--added')}
                onClick={handleAddToCart}
                disabled={!inStock}
              >
                <ShoppingBag className="h-4 w-4" strokeWidth={2} />
                {addedPulse ? 'Added to Bag!' : 'Add to Bag'}
              </button>

              <div className="pp-info__cta-row">
                <button
                  type="button"
                  className="pdp-cta-secondary pp-info__buy"
                  onClick={handleCheckout}
                  disabled={!inStock}
                >
                  Buy Now
                </button>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                  className={cn('pdp-cta-icon', saved && 'pdp-cta-icon--saved')}
                >
                  <Heart
                    className={cn('h-[1rem] w-[1rem]', saved && 'fill-[#C8A97E] text-[#C8A97E]')}
                    strokeWidth={2}
                  />
                </button>
              </div>
            </div>
          </aside>
        </div>

        {(shortDesc || detailSections.length > 0) && (
          <section className="pp-details" aria-label="Product details">
            {shortDesc && (
              <div className="pp-info__desc-block">
                <p className="pp-info__desc">
                  {descExpanded || !showReadMore ? fullDescription || shortDesc : shortDesc}
                </p>
                {showReadMore && (
                  <button
                    type="button"
                    className="pp-info__read-more"
                    onClick={() => setDescExpanded((v) => !v)}
                  >
                    {descExpanded ? 'Read less' : 'Read more'}
                  </button>
                )}
              </div>
            )}

            {detailSections.length > 0 && (
              <div className="pp-info__accordions">
                {detailSections.map((section) => {
                  const open = openSection === section.id
                  return (
                    <div
                      key={section.id}
                      className={cn('pp-accordion', open && 'pp-accordion--open')}
                    >
                      <button
                        type="button"
                        className="pp-accordion__trigger"
                        onClick={() => setOpenSection(open ? null : section.id)}
                        aria-expanded={open}
                      >
                        <span>{section.id}</span>
                        <motion.span
                          animate={{ rotate: open ? 45 : 0 }}
                          transition={{ duration: PANEL_MS, ease: PANEL_EASE }}
                          className="pp-accordion__icon"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                        </motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: PANEL_MS, ease: PANEL_EASE }}
                            className="pp-accordion__panel"
                          >
                            <p className="pp-accordion__body">{section.content}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {reviews.length > 0 && (
          <section className="pp-reviews" aria-labelledby="product-reviews-heading">
            <h2 id="product-reviews-heading" className="pp-related__title">
              Customer reviews
            </h2>
            <div className="pp-reviews__list">
              {reviews.map((review, index) => (
                <article key={`${review.name}-${index}`} className="pp-reviews__item account-glass">
                  <div className="pp-reviews__head">
                    <div className="pp-info__stars">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            'pp-info__star',
                            i < Math.round(review.rating) && 'pp-info__star--filled',
                          )}
                          strokeWidth={1.5}
                        />
                      ))}
                    </div>
                    <p className="pp-reviews__author">
                      {review.name}
                      {review.city ? ` · ${review.city}` : ''}
                    </p>
                  </div>
                  <p className="pp-reviews__body">{review.text}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {relatedProducts.length > 0 && (
          <section className="pp-related">
            <h2 className="pp-related__title">You may also like</h2>
            <div className="pp-related__grid">
              {relatedProducts.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
