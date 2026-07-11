'use client'

import { useEffect, useMemo, useState, type SVGProps } from 'react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Plus,
  Ruler,
  Heart,
  Star,
  X as CloseIcon,
} from 'lucide-react'
import { AddToBagIconBadge } from '@/components/product/AddToBagIcon'
import { MotionAnchor, MotionLink, MotionPressable } from '@/components/ui/MotionPressable'
import {
  ProductFadeSwap,
  ProductReveal,
  ProductStagger,
  PRODUCT_GALLERY_MS,
  productGalleryEase,
  productGalleryMotion,
  productShake,
} from '@/components/product/ProductMotion'
import { ProductCard } from '@/components/product/ProductCard/ProductCard'
import { trackRecentlyViewed } from '@/lib/recentlyViewed'
import { collectionHref } from '@/lib/storefront/collection-paths'
import { useCartStore, type CartItem } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { getCheckoutEntryPath } from '@/lib/checkout/checkout-auth'
import { stageCheckoutItems } from '@/lib/cart/checkout-intent'
import { useWishlistStore } from '@/store/wishlistStore'
import { useUiStore } from '@/store/uiStore'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'
import { trackAddToCart, trackViewContent } from '@/lib/analytics/meta-pixel'
import type { ProductDetailData, ProductCardData } from '@/types/product'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { sanitizeRemoteImageUrl } from '@/lib/assets/images'
import { optimizeImageSrc } from '@/lib/assets/image-optimize'
import type { ProductReview } from '@/lib/catalog/live'
import { sortSizes } from '@/lib/catalog/live'
import { ProductReviews } from '@/components/product/ProductReviews/ProductReviews'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import { productMediaTransitionStyle } from '@/lib/navigation/view-transition'

interface ProductPageClientProps {
  product: ProductDetailData
  reviews?: ProductReview[]
  relatedProducts?: ProductCardData[]
}

const PANEL_EASE = [0.22, 1, 0.36, 1] as const
const PANEL_MS = 0.3

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M14.1 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.8-.1-1.6-.2-2.4-.2-2.5 0-4.2 1.5-4.2 4.3v2.2H8v3.1h2.8v8h3.3Z"
      />
    </svg>
  )
}

function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12.1 3.2a8.7 8.7 0 0 0-7.4 13.3L3.8 21l4.6-1.2a8.7 8.7 0 1 0 3.7-16.6Zm0 15.7a7 7 0 0 1-3.6-1l-.3-.2-2.7.7.7-2.6-.2-.3a7 7 0 1 1 6.1 3.4Zm3.9-5.2c-.2-.1-1.3-.7-1.5-.7-.2-.1-.4-.1-.5.1l-.7.8c-.1.2-.3.2-.5.1a5.7 5.7 0 0 1-2.8-2.4c-.2-.3 0-.4.1-.6l.4-.4.2-.4c.1-.1 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.9 2.3 1 2.5a8 8 0 0 0 3.1 2.8c1.2.5 1.7.6 2.3.5.4-.1 1.3-.5 1.5-1 .2-.5.2-.9.1-1-.1-.1-.2-.1-.5-.2Z"
      />
    </svg>
  )
}

function XSocialIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M17.7 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.2L5.3 21H2.2l7.2-8.3L1.8 3h6.5l4.4 5.7L17.7 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11 14.5Z"
      />
    </svg>
  )
}

export default function ProductPageClient({
  product,
  reviews = [],
  relatedProducts = [],
}: ProductPageClientProps) {
  const router = useRouter()
  const reducedMotion = useReducedMotion()
  const user = useAuthStore((state) => state.user)
  const authHydrated = useAuthStore((state) => state._hydrated)
  const { addItem, replaceItems } = useCartStore()
  const setCartOpen = useUiStore((state) => state.setCartOpen)
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist)
  const saved = useWishlistStore(
    (state) => state._hydrated && state.productIds.includes(product.id),
  )

  const [activeImage, setActiveImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [addedPulse, setAddedPulse] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [lightboxZoom, setLightboxZoom] = useState<'fit' | 'deep'>('fit')

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

  const [shareUrl, setShareUrl] = useState('')
  const [ctaShake, setCtaShake] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(window.location.href)
    }
  }, [product.slug])

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

  // Warm the browser cache for neighbouring gallery images so arrows switch instantly.
  useEffect(() => {
    if (typeof window === 'undefined' || media.length < 2) return
    const neighbours = [
      media[(activeImage + 1) % media.length],
      media[(activeImage - 1 + media.length) % media.length],
    ]
    for (const item of neighbours) {
      if (item?.type !== 'image' || !item.url) continue
      const img = new window.Image()
      img.decoding = 'async'
      img.src = optimizeImageSrc(item.url, 'gallery')
    }
  }, [activeImage, media])

  const productCode = product.sku ?? product.slug.replace(/-/g, ' ').slice(0, 12).toUpperCase()

  const detailSections = useMemo(() => {
    const sections: { id: string; content: string }[] = []

    const detailsParts = [
      fullDescription,
      product.weavingType ? `Weaving · ${product.weavingType}` : null,
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
    product.weavingType,
    product.fitType,
    product.occasion,
    product.origin,
    product.season,
  ])

  const buildSelectedCartItem = (): CartItem | null => {
    if (!inStock) return null
    // Synthetic variant ids (product.id or `${product.id}-…`) are UI-only —
    // the API rejects them, so only send ids that came from the database.
    const realVariantId =
      activeVariant?.id &&
      activeVariant.id !== product.id &&
      !activeVariant.id.startsWith(`${product.id}-`)
        ? activeVariant.id
        : undefined
    const item: CartItem = {
      productId: product.id,
      ...(realVariantId ? { variantId: realVariantId } : {}),
      quantity,
      name: product.name,
      price: product.price,
      image: activeVariant?.image ?? activeColorOption?.image ?? product.images[0] ?? '',
      slug: product.slug,
    }
    if (selectedSize) item.size = selectedSize
    if (selectedColor) {
      item.color = selectedColorName !== '—' ? selectedColorName : selectedColor
    }
    return item
  }

  const addSelectedItemToCart = () => {
    const item = buildSelectedCartItem()
    if (!item) return false
    addItem(item)
    trackAddToCart({ id: product.id, name: product.name, price: product.price })
    return true
  }

  const handleAddToCart = () => {
    if (addingToCart) return
    setAddingToCart(true)
    if (!addSelectedItemToCart()) {
      setAddingToCart(false)
      setCtaShake(true)
      window.setTimeout(() => setCtaShake(false), 480)
      return
    }
    setAddedPulse(true)
    window.setTimeout(() => setCartOpen(true), 420)
    window.setTimeout(() => {
      setAddingToCart(false)
      setAddedPulse(false)
    }, 1400)
  }

  const handleBuyNow = () => {
    const item = buildSelectedCartItem()
    if (!item) return
    stageCheckoutItems([item])
    replaceItems([item])
    trackAddToCart({ id: product.id, name: product.name, price: product.price })
    router.push(getCheckoutEntryPath(Boolean(user)))
  }

  const prevImage = () => {
    setLightboxZoom('fit')
    setActiveImage((i) => (i - 1 + media.length) % media.length)
  }
  const nextImage = () => {
    setLightboxZoom('fit')
    setActiveImage((i) => (i + 1) % media.length)
  }
  const openLightbox = () => {
    setLightboxZoom('fit')
    setIsLightboxOpen(true)
  }
  const closeLightbox = () => {
    setIsLightboxOpen(false)
    setLightboxZoom('fit')
  }
  const toggleLightboxZoom = () => {
    if (media[activeImage]?.type === 'video') return
    setLightboxZoom((z) => (z === 'fit' ? 'deep' : 'fit'))
  }
  const openGalleryZoom = () => {
    if (media[activeImage]?.type === 'video') return
    openLightbox()
  }

  const heroMediaTransition =
    activeImage === 0 && media[0]?.type !== 'video'
      ? productMediaTransitionStyle(product.id, reducedMotion)
      : undefined

  useEffect(() => {
    if (!isLightboxOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLightbox()
      }
      if (event.key === 'ArrowLeft') {
        setActiveImage((i) => (i - 1 + media.length) % media.length)
      }
      if (event.key === 'ArrowRight') {
        setActiveImage((i) => (i + 1) % media.length)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isLightboxOpen, media.length])

  return (
    <div className="pp-root pp-view">
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
            <div className="pp-gallery__main">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${selectedColor ?? 'default'}-${media[activeImage]?.type}-${media[activeImage]?.url}`}
                  className={cn(
                    'pp-gallery__stage',
                    media[activeImage]?.type !== 'video' && 'pp-gallery__stage--zoomable',
                  )}
                  {...(reducedMotion
                    ? {}
                    : {
                        initial: productGalleryMotion.initial,
                        exit: productGalleryMotion.exit,
                      })}
                  animate={productGalleryMotion.animate}
                  transition={{ duration: PRODUCT_GALLERY_MS, ease: productGalleryEase }}
                  onClick={openGalleryZoom}
                  onDoubleClick={(event) => {
                    event.stopPropagation()
                    openLightbox()
                    setLightboxZoom('deep')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openGalleryZoom()
                    }
                  }}
                  role={media[activeImage]?.type !== 'video' ? 'button' : undefined}
                  tabIndex={media[activeImage]?.type !== 'video' ? 0 : undefined}
                  aria-label={media[activeImage]?.type !== 'video' ? 'Open product image zoom' : undefined}
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
                    <div className="product-shared-media" style={heroMediaTransition}>
                      <StorefrontImage
                        src={media[activeImage]!.url}
                        alt={product.name}
                        profile="gallery"
                        fill
                        fit="cover"
                        className="pp-gallery__img"
                        priority={activeImage === 0}
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <MotionPressable
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  openLightbox()
                }}
                className="pp-gallery__zoom pp-pressable"
                aria-label="Open product image fullscreen"
                variant="icon"
              >
                <Maximize2 size={17} strokeWidth={1.8} />
              </MotionPressable>

              {media.length > 1 && (
                <>
                  <MotionPressable
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      prevImage()
                    }}
                    className="pp-gallery__nav pp-gallery__nav--prev pp-pressable"
                    aria-label="Previous image"
                    variant="nav"
                  >
                    <ChevronLeft size={18} strokeWidth={1.75} />
                  </MotionPressable>
                  <MotionPressable
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      nextImage()
                    }}
                    className="pp-gallery__nav pp-gallery__nav--next pp-pressable"
                    aria-label="Next image"
                    variant="nav"
                  >
                    <ChevronRight size={18} strokeWidth={1.75} />
                  </MotionPressable>
                </>
              )}
            </div>

            {media.length > 1 && (
              <div className="pp-gallery__progress" aria-live="polite">
                <span className="pp-gallery__progress-label">
                  {activeImage + 1} / {media.length}
                </span>
                <div className="pp-gallery__progress-track">
                  <motion.div
                    className="pp-gallery__progress-fill"
                    animate={{ width: `${((activeImage + 1) / media.length) * 100}%` }}
                    transition={{ duration: PRODUCT_GALLERY_MS, ease: productGalleryEase }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ─── Product info ─────────────────────────────── */}
          <aside className="pp-info">
            <ProductStagger>
            <ProductReveal className="pp-info__header">
              <h1 className="pp-info__name">{product.name}</h1>
              {product.nameBn ? (
                <p className="pp-info__name-bn" lang="bn">{product.nameBn}</p>
              ) : null}
              {product.weavingType ? (
                <p className="pp-info__weave">{product.weavingType}</p>
              ) : null}
              <p className="pp-info__code">Product Code: {productCode}</p>
              {(() => {
                // Honest rating only: backend aggregate, else average of real
                // approved reviews on this page — never an invented default.
                const realRating =
                  product.rating > 0
                    ? product.rating
                    : reviews.length > 0
                      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                      : 0
                const realCount = product.reviewCount || reviews.length
                if (realCount <= 0 || realRating <= 0) return null
                return (
                  <a href="#product-reviews-heading" className="pp-info__rating">
                    <span className="pp-info__stars" aria-hidden>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            'pp-info__star',
                            i < Math.round(realRating) && 'pp-info__star--filled',
                          )}
                          strokeWidth={1.5}
                        />
                      ))}
                    </span>
                    <span>{realRating.toFixed(1)}</span>
                    <span className="pp-info__rating-sep">·</span>
                    <span>
                      {realCount} review{realCount === 1 ? '' : 's'}
                    </span>
                  </a>
                )
              })()}
            </ProductReveal>

            <ProductReveal className="pp-info__lead">
              <div className="pp-info__price-row">
                <span className="pp-info__price">{formatBDT(product.price)}</span>
                {hasDiscount && (
                  <>
                    <span className="pp-info__compare">{formatBDT(product.compareAtPrice!)}</span>
                    <span className="pp-info__discount-badge">-{discountPct}%</span>
                  </>
                )}
              </div>
            </ProductReveal>

            <AnimatePresence mode="wait">
              {lowStock && (
                <motion.p
                  key="low-stock"
                  className="pp-info__lowstock"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.24, ease: productGalleryEase }}
                >
                  Only {stock} left — order soon
                </motion.p>
              )}
              {!inStock && (
                <motion.p
                  key="out-stock"
                  className="pp-info__outstock"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.24, ease: productGalleryEase }}
                >
                  Out of stock
                </motion.p>
              )}
            </AnimatePresence>

            <ProductReveal className="pp-info__options">
              {showColorPicker && (
                <div className="pp-info__option">
                  <p className="pp-info__option-label">
                    Color:{' '}
                    <AnimatePresence mode="wait" initial={false}>
                      <ProductFadeSwap
                        key={selectedColorName}
                        motionKey={selectedColorName}
                        className="pp-info__option-value"
                      >
                        {selectedColorName}
                      </ProductFadeSwap>
                    </AnimatePresence>
                  </p>
                  <HorizontalScrollRail
                    className="pp-color-rail"
                    trackClassName="pp-color-row"
                    variant="pill"
                    ariaLabel="Product colours"
                  >
                    {colorOptions.map((opt) => (
                      <MotionPressable
                        key={opt.hex}
                        type="button"
                        onClick={() => setSelectedColor(opt.hex)}
                        aria-label={`${opt.name} colour`}
                        aria-pressed={selectedColor === opt.hex}
                        className={cn(
                          'pp-color-thumb pp-pressable',
                          selectedColor === opt.hex && 'pp-color-thumb--active',
                        )}
                        variant="chip"
                      >
                        <StorefrontImage
                          src={opt.image}
                          alt=""
                          profile="thumb"
                          width={56}
                          height={56}
                          className="pp-color-thumb__img"
                        />
                      </MotionPressable>
                    ))}
                  </HorizontalScrollRail>
                </div>
              )}

              {sizes.length > 0 && (
                <div className="pp-info__option">
                  <div className="pp-info__option-head">
                    <p className="pp-info__option-label pp-info__option-label--inline">Select Size</p>
                    <MotionLink href="/size-guide" className="pp-size-guide" variant="subtle">
                      <Ruler className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Size Guide
                    </MotionLink>
                  </div>
                  <LayoutGroup id="pp-size-select">
                  <div className="pp-size-row">
                    {sizes.map((size) => {
                      const qty = sizeStock.get(size) ?? stock
                      const disabled = qty === 0
                      const active = selectedSize === size && !disabled
                      return (
                        <MotionPressable
                          key={size}
                          type="button"
                          onClick={() => !disabled && setSelectedSize(size)}
                          aria-pressed={active}
                          disabled={disabled}
                          className={cn(
                            'pp-size-btn pp-pressable',
                            active && 'pp-size-btn--active pp-size-btn--sliding',
                            disabled && 'pp-size-btn--unavailable',
                          )}
                          variant="chip"
                        >
                          {active && (
                            <motion.span
                              layoutId="pp-size-pill"
                              className="pp-size-btn__pill"
                              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                              aria-hidden
                            />
                          )}
                          <span className="pp-size-btn__label">{size}</span>
                        </MotionPressable>
                      )
                    })}
                  </div>
                  </LayoutGroup>
                </div>
              )}
            </ProductReveal>

            <ProductReveal>
            <motion.div
              className="pp-info__ctas"
              variants={productShake}
              animate={ctaShake ? 'shake' : 'idle'}
            >
              <MotionPressable
                type="button"
                className={cn(
                  'pp-btn-add pp-pressable',
                  addedPulse && 'pp-btn-add--added',
                  addingToCart && !addedPulse && 'pp-btn-add--pending',
                )}
                onClick={handleAddToCart}
                disabled={!inStock || addingToCart}
                variant="cta"
              >
                <AddToBagIconBadge size={17} tone="dark" pulse={addedPulse} />
                <motion.span
                  key={addedPulse ? 'added' : addingToCart ? 'pending' : 'default'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  {addingToCart && !addedPulse
                    ? 'Adding…'
                    : addedPulse
                      ? 'Added to Bag!'
                      : 'Add to bag'}
                </motion.span>
              </MotionPressable>

              <MotionPressable
                type="button"
                className="pp-btn-store pp-pressable"
                onClick={handleBuyNow}
                disabled={!inStock}
                variant="cta"
              >
                Buy Now
              </MotionPressable>

              <MotionPressable
                type="button"
                className={cn('pp-btn-wish pp-pressable', saved && 'pp-btn-wish--saved')}
                onClick={() => toggleWishlist(product.id)}
                aria-pressed={saved}
                aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                variant="icon"
              >
                <motion.span
                  animate={saved ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Heart className={cn('h-4 w-4', saved && 'fill-current')} strokeWidth={1.75} />
                </motion.span>
              </MotionPressable>

              {shareUrl ? (
                <div className="pp-share" aria-label="Share product">
                  <MotionAnchor
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pp-share__btn"
                    aria-label="Share on Facebook"
                    variant="icon"
                  >
                    <FacebookIcon className="pp-share__icon" />
                  </MotionAnchor>
                  <MotionAnchor
                    href={`https://wa.me/?text=${encodeURIComponent(`${product.name} ${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pp-share__btn"
                    aria-label="Share on WhatsApp"
                    variant="icon"
                  >
                    <WhatsAppIcon className="pp-share__icon" />
                  </MotionAnchor>
                  <MotionAnchor
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(product.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pp-share__btn"
                    aria-label="Share on X"
                    variant="icon"
                  >
                    <XSocialIcon className="pp-share__icon" />
                  </MotionAnchor>
                </div>
              ) : null}
            </motion.div>
            </ProductReveal>
            </ProductStagger>

            {(shortDesc || detailSections.length > 0) && (
              <section className="pp-info__details" aria-label="Product details">
                {shortDesc && (
                  <div className="pp-info__desc-block">
                    <p
                      className={cn(
                        'pp-info__desc',
                        descExpanded && 'pp-info__desc--expanded',
                      )}
                    >
                      {descExpanded || !showReadMore ? fullDescription || shortDesc : shortDesc}
                    </p>
                    {showReadMore && (
                      <MotionPressable
                        type="button"
                        className="pp-info__read-more"
                        onClick={() => setDescExpanded((v) => !v)}
                        variant="subtle"
                      >
                        {descExpanded ? 'Read less' : 'Read more'}
                      </MotionPressable>
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
                          <MotionPressable
                            type="button"
                            className="pp-accordion__trigger pp-pressable"
                            onClick={() => setOpenSection(open ? null : section.id)}
                            aria-expanded={open}
                            variant="subtle"
                          >
                            <span>{section.id}</span>
                            <motion.span
                              animate={{ rotate: open ? 45 : 0 }}
                              transition={{ duration: PANEL_MS, ease: PANEL_EASE }}
                              className="pp-accordion__icon"
                            >
                              <Plus className="h-3 w-3" strokeWidth={2} />
                            </motion.span>
                          </MotionPressable>
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
          </aside>
        </div>

        <ProductReviews
          productId={product.id}
          productSlug={product.slug}
          productName={product.name}
          rating={product.rating}
          reviewCount={product.reviewCount}
          reviews={reviews}
          isLoggedIn={authHydrated && Boolean(user)}
        />

        {relatedProducts.length > 0 && (
          <ProductReveal>
          <section className="pp-related">
            <h2 className="pp-related__title">You may also like</h2>
            <div className="pp-related__grid">
              {relatedProducts.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
          </ProductReveal>
        )}
      </div>

      {inStock ? (
        <div className="pp-mobile-sticky-bar" aria-label="Quick purchase">
          <div className="pp-mobile-sticky-bar__price">
            <span className="pp-mobile-sticky-bar__price-label">
              {quantity > 1 ? 'Total' : 'Price'}
            </span>
            <span className="pp-mobile-sticky-bar__price-value">
              {formatBDT(product.price * quantity)}
            </span>
          </div>
          <div className="pp-mobile-sticky-bar__actions">
            <button
              type="button"
              className="pp-mobile-sticky-bar__btn pp-mobile-sticky-bar__btn--add"
              onClick={handleAddToCart}
              disabled={addingToCart}
            >
              {addingToCart && !addedPulse ? 'Adding…' : addedPulse ? 'Added' : 'Add to bag'}
            </button>
            <button
              type="button"
              className="pp-mobile-sticky-bar__btn pp-mobile-sticky-bar__btn--buy"
              onClick={handleBuyNow}
            >
              Buy now
            </button>
          </div>
        </div>
      ) : null}

      {isLightboxOpen && (
        <div
          className="pp-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} fullscreen preview`}
          onClick={closeLightbox}
        >
          <MotionPressable
            type="button"
            className="pp-lightbox__close pp-pressable"
            onClick={(event) => {
              event.stopPropagation()
              closeLightbox()
            }}
            aria-label="Close fullscreen preview"
            variant="icon"
          >
            <CloseIcon size={22} strokeWidth={1.8} />
          </MotionPressable>

          {media.length > 1 && (
            <MotionPressable
              type="button"
              className="pp-lightbox__nav pp-lightbox__nav--prev pp-pressable"
              onClick={(event) => {
                event.stopPropagation()
                prevImage()
              }}
              aria-label="Previous image"
              variant="nav"
            >
              <ChevronLeft size={30} strokeWidth={1.55} />
            </MotionPressable>
          )}

          <div
            className={cn(
              'pp-lightbox__stage',
              lightboxZoom === 'deep' && 'pp-lightbox__stage--deep',
            )}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={toggleLightboxZoom}
          >
            {media[activeImage]?.type === 'video' ? (
              <video
                src={media[activeImage]!.url}
                className="pp-lightbox__media"
                autoPlay
                muted
                loop
                playsInline
                controls
              />
            ) : (
              <div
                className={cn(
                  'pp-lightbox__media-wrap',
                  lightboxZoom === 'deep' && 'pp-lightbox__media-wrap--deep',
                )}
              >
                <StorefrontImage
                  src={media[activeImage]?.url ?? PRODUCT_IMAGE_PLACEHOLDER}
                  alt={product.name}
                  profile="lightbox"
                  fill
                  fit="contain"
                  className="pp-lightbox__media"
                  draggable={false}
                />
              </div>
            )}
          </div>

          {media[activeImage]?.type !== 'video' && (
            <p className="pp-lightbox__hint">
              {lightboxZoom === 'fit' ? 'Double-click to zoom in' : 'Double-click to zoom out'}
            </p>
          )}

          {media.length > 1 && (
            <MotionPressable
              type="button"
              className="pp-lightbox__nav pp-lightbox__nav--next pp-pressable"
              onClick={(event) => {
                event.stopPropagation()
                nextImage()
              }}
              aria-label="Next image"
              variant="nav"
            >
              <ChevronRight size={30} strokeWidth={1.55} />
            </MotionPressable>
          )}

          <div className="pp-lightbox__counter">
            {activeImage + 1} / {media.length}
          </div>
        </div>
      )}
    </div>
  )
}
