'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from '@/lib/motion/react'
import {
  ChevronLeft, ChevronRight,
  Maximize2, Minus, Plus, Ruler, Share2, X,
} from 'lucide-react'
import { AddToBagIconBadge } from '@/components/product/AddToBagIcon'
import { MotionPressable } from '@/components/ui/MotionPressable'
import { MotionSwapLabel } from '@/components/ui/MotionSwapLabel/MotionSwapLabel'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import {
  ProductFadeSwap,
  ProductReveal,
  ProductStagger,
  PRODUCT_GALLERY_MS,
  productGalleryEase,
  productGalleryMotion,
} from '@/components/product/ProductMotion'
import { getCheckoutEntryPath } from '@/lib/checkout/checkout-auth'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'
import { slugFromCategory } from '@/data/storefront'
import { storefrontToDetailItem } from '@/lib/catalog/product-detail-map'
import { resolveSizeOptionUi } from '@/lib/catalog/size-option-ui'
import { getRecentlyViewed, trackRecentlyViewed } from '@/lib/recentlyViewed'
import { ProductMiniRow } from '@/components/product/ProductMiniRow/ProductMiniRow'
import { SizeGuideModal } from '@/components/product/SizeGuideModal/SizeGuideModal'
import type { ColorOption, Category, StorefrontProduct } from '@/data/storefront'

export interface ProductDetailItem {
  id: string
  name: string
  code: string
  category: string
  price: number
  compareAtPrice?: number
  colors: string[]
  colorOptions?: ColorOption[]
  sizes: string[]
  unavailableSizes?: string[]
  status: string
  image: string
  hoverImage: string
  media?: { type: 'image' | 'video'; url: string; alt?: string }[]
  fit: string
  material: string
  description?: string
}

interface ProductDetailPanelProps {
  product: ProductDetailItem
  modalSize: string | null
  modalColor: string | null
  saved?: boolean
  onClose: () => void
  onSizeChange: (size: string) => void
  onColorChange: (color: string) => void
  onAddToBag: (quantity: number) => void
  onCheckout?: () => void
  onSelectProduct?: (product: ProductDetailItem) => void
  onToggleSaved?: () => void
}

const colorLabels: Record<string, string> = {
  '#f2f0e8': 'Ivory', '#b8c6bd': 'Sage', '#111111': 'Black', '#d8d6ce': 'Sand',
  '#1f2a2e': 'Deep Navy', '#f6d6d2': 'Blush', '#ece7dd': 'Oat', '#222222': 'Charcoal',
  '#f7c9d7': 'Rose', '#8dc7c8': 'Aqua', '#f1c34b': 'Sun', '#f5f5f0': 'Cloud',
  '#c9c1b5': 'Stone', '#121212': 'Onyx', '#f6efe5': 'Cream', '#d7bca2': 'Camel',
  '#dad6cc': 'Mist', '#253036': 'Forest', '#e9d4ef': 'Lilac', '#f0b350': 'Amber',
  '#8fbfc6': 'Sky', '#dc2626': 'Red',
}

function resolveColorOptions(product: ProductDetailItem): ColorOption[] {
  if (product.colorOptions?.length) return product.colorOptions
  const pool = [product.image, product.hoverImage].filter(
    (u, i, arr) => u && arr.indexOf(u) === i,
  )
  return product.colors.map((hex, i) => ({
    id: hex,
    hex,
    name: colorLabels[hex.toLowerCase()] ?? 'Selected',
    image: pool[i % pool.length] ?? product.image,
  }))
}

export function ProductDetailPanel({
  product, modalSize, modalColor,
  onClose, onSizeChange, onColorChange, onAddToBag, onCheckout,
  onSelectProduct,
}: ProductDetailPanelProps) {
  const router = useRouter()
  const [activeImage, setActiveImage] = useState(0)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [addedPulse, setAddedPulse] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  const [recentlyViewed, setRecentlyViewed] = useState<ProductDetailItem[]>([])
  const [youMayAlsoLike, setYouMayAlsoLike] = useState<ProductDetailItem[]>([])

  const colorOptions = useMemo(() => resolveColorOptions(product), [product])
  const sizeOptionUi = useMemo(
    () => resolveSizeOptionUi({ sizes: product.sizes, category: product.category }),
    [product.sizes, product.category],
  )
  const activeColorHex = modalColor ?? colorOptions[0]?.hex ?? product.colors[0] ?? ''
  const activeColor = useMemo(
    () => colorOptions.find((o) => o.hex === activeColorHex) ?? colorOptions[0],
    [activeColorHex, colorOptions],
  )
  const activeColorName = activeColor?.name ?? colorLabels[activeColorHex.toLowerCase()] ?? 'Selected'

  const media = useMemo(() => {
    const primary = activeColor?.image ?? product.image
    if (product.media?.length) {
      // Lead with the selected colour image so colour clicks visibly change the stage
      const rest = product.media.filter((item) => item.url !== primary)
      if (primary) {
        return [{ type: 'image' as const, url: primary }, ...rest]
      }
      return [...product.media]
    }
    const gallery = [{ type: 'image' as const, url: primary }]
    if (product.hoverImage && product.hoverImage !== primary) {
      gallery.push({ type: 'image' as const, url: product.hoverImage })
    }
    return gallery
  }, [activeColor?.image, product.hoverImage, product.image, product.media])

  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  const discountPct = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0

  useEffect(() => {
    setActiveImage(0)
    setQuantity(1)
    setLightboxOpen(false)
    trackRecentlyViewed(product.id)
    setRecentIds(getRecentlyViewed(product.id))
    document.body.classList.add('product-sheet-open')
    return () => document.body.classList.remove('product-sheet-open')
  }, [product.id])

  useEffect(() => { setActiveImage(0) }, [activeColorHex])

  useEffect(() => {
    if (!lightboxOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false)
      if (e.key === 'ArrowLeft') setActiveImage((i) => (i - 1 + media.length) % media.length)
      if (e.key === 'ArrowRight') setActiveImage((i) => (i + 1) % media.length)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [lightboxOpen, media.length])

  useEffect(() => {
    if (!recentIds.length) {
      setRecentlyViewed([])
      return
    }

    let cancelled = false
    void fetch(`/api/products?ids=${encodeURIComponent(recentIds.slice(0, 6).join(','))}`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { products?: StorefrontProduct[] } | null) => {
        if (cancelled || !data?.products?.length) return
        const byId = new Map(data.products.map((entry) => [entry.id, storefrontToDetailItem(entry)]))
        setRecentlyViewed(
          recentIds
            .map((id) => byId.get(id))
            .filter((entry): entry is ProductDetailItem => Boolean(entry))
            .slice(0, 6),
        )
      })
      .catch(() => {
        if (!cancelled) setRecentlyViewed([])
      })

    return () => {
      cancelled = true
    }
  }, [recentIds])

  useEffect(() => {
    let cancelled = false
    const categorySlug = slugFromCategory(product.category as Exclude<Category, 'All'>)

    void fetch(`/api/products?categorySlug=${encodeURIComponent(categorySlug)}&limit=12`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { products?: StorefrontProduct[] } | null) => {
        if (cancelled || !data?.products?.length) return
        setYouMayAlsoLike(
          data.products
            .filter((entry) => entry.id !== product.id)
            .slice(0, 6)
            .map(storefrontToDetailItem),
        )
      })
      .catch(() => {
        if (!cancelled) setYouMayAlsoLike([])
      })

    return () => {
      cancelled = true
    }
  }, [product.id, product.category])

  const handleAddToBag = () => {
    onAddToBag(quantity)
    setAddedPulse(true)
    setTimeout(() => setAddedPulse(false), 1400)
  }

  const handleCheckout = () => {
    if (onCheckout) {
      onCheckout()
      return
    }
    onAddToBag(quantity)
    const checkoutPath = getCheckoutEntryPath()
    router.prefetch(checkoutPath)
    safeClientNavigate(router, checkoutPath)
  }

  const prevImage = () => setActiveImage((i) => (i - 1 + media.length) % media.length)
  const nextImage = () => setActiveImage((i) => (i + 1) % media.length)

  const productDescription =
    product.description?.trim() ||
    `${product.name} is crafted from ${product.material.toLowerCase()} with a ${product.fit.toLowerCase()} fit for polished everyday wear.`

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: product.name, text: `Check out ${product.name}`, url: window.location.href })
    }
  }

  return (
    <motion.div
      className="pdp-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={onClose}
    >
      <motion.div
        data-section="productDetail"
        className="pdp-panel"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 28, scale: 0.98 }}
        transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pdp-grid">

          {/* ── LEFT: Gallery ─────────────────────────────── */}
          <div className="pdp-gallery">
            {/* Close — mobile */}
            <MotionPressable className="pdp-close-img lg:hidden" onClick={onClose} aria-label="Close" variant="icon">
              <X className="h-4 w-4" strokeWidth={2} />
            </MotionPressable>

            {/* Badges */}
            <div className="pdp-badges">
              {product.status === 'New' && <span className="pdp-badge pdp-badge--new">New</span>}
              {hasDiscount && <span className="pdp-badge pdp-badge--sale">-{discountPct}%</span>}
            </div>

            <div className="pdp-gallery__inner">
              <div className="pdp-gallery__frame">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${media[activeImage]?.type}-${media[activeImage]?.url}-${activeImage}`}
                    className="absolute inset-0"
                    initial={productGalleryMotion.initial}
                    animate={productGalleryMotion.animate}
                    exit={productGalleryMotion.exit}
                    transition={{ duration: PRODUCT_GALLERY_MS, ease: productGalleryEase }}
                  >
                    {media[activeImage]?.type === 'video' ? (
                      <video
                        src={media[activeImage]!.url}
                        className="pdp-gallery__video"
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
                        sizes="(max-width: 1024px) 92vw, 42vw"
                        className="object-contain object-center"
                        priority
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {media[activeImage]?.type !== 'video' && (
                  <MotionPressable
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="splaro-nav-btn splaro-nav-btn--sm pdp-zoom-btn"
                    aria-label="Expand image"
                    variant="icon"
                  >
                    <Maximize2 size={14} strokeWidth={2} />
                  </MotionPressable>
                )}

                {media.length > 1 && (
                  <>
                    <MotionPressable
                      type="button"
                      onClick={prevImage}
                      className="splaro-nav-btn splaro-nav-btn--sm splaro-nav-btn--overlay splaro-nav-btn--prev"
                      aria-label="Previous image"
                      variant="nav"
                    >
                      <ChevronLeft size={16} strokeWidth={2} />
                    </MotionPressable>
                    <MotionPressable
                      type="button"
                      onClick={nextImage}
                      className="splaro-nav-btn splaro-nav-btn--sm splaro-nav-btn--overlay splaro-nav-btn--next"
                      aria-label="Next image"
                      variant="nav"
                    >
                      <ChevronRight size={16} strokeWidth={2} />
                    </MotionPressable>

                    <div className="pdp-progress pdp-progress--inline">
                      <span className="pdp-progress__label">{activeImage + 1} / {media.length}</span>
                      <div className="pdp-progress__track">
                        <motion.div
                          className="pdp-progress__fill"
                          animate={{ width: `${((activeImage + 1) / media.length) * 100}%` }}
                          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {media.length > 1 && (
                <HorizontalScrollRail
                  className="pdp-gallery__thumbrail"
                  trackClassName="pdp-gallery__thumbstrip"
                  variant="pill"
                  ariaLabel="Product gallery thumbnails"
                >
                  {media.map((item, i) => (
                    <MotionPressable
                      key={`${item.type}-${item.url}-${i}`}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`${item.type} ${i + 1}`}
                      className={cn('pdp-gallery__thumb', i === activeImage && 'pdp-gallery__thumb--active')}
                      variant="chip"
                    >
                      {item.type === 'video' ? (
                        <>
                          <video src={item.url} muted playsInline className="pdp-gallery__video-thumb" />
                          <span className="pp-gallery__thumb-play" aria-hidden>Play</span>
                        </>
                      ) : (
                        <Image src={item.url} alt="" fill sizes="64px" className="object-contain object-center" />
                      )}
                    </MotionPressable>
                  ))}
                </HorizontalScrollRail>
              )}
            </div>
          </div>

          {/* ── RIGHT: Info ────────────────────────────────── */}
          <div className="pdp-info">

            {/* Scrollable content */}
            <div className="pdp-info__scroll" data-lenis-prevent>
              <ProductStagger>
              <ProductReveal>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="pdp-eyebrow">SPLARO</p>
                  <h2 className="pdp-name">{product.name}</h2>
                  {product.code ? (
                    <p className="pdp-code">Product Code · {product.code}</p>
                  ) : null}
                </div>
                <MotionPressable className="pdp-close-info" onClick={onClose} aria-label="Close" variant="icon">
                  <X className="h-[0.9rem] w-[0.9rem]" strokeWidth={2.2} />
                </MotionPressable>
              </div>
              </ProductReveal>

              <ProductReveal>
              <div className="pdp-price-row">
                <span className="pdp-price">{formatBDT(product.price)}</span>
                {hasDiscount && (
                  <>
                    <span className="pdp-compare">{formatBDT(product.compareAtPrice!)}</span>
                    <span className="pdp-discount-badge">-{discountPct}%</span>
                  </>
                )}
              </div>
              </ProductReveal>

              <ProductReveal>
              <p className="pdp-desc">{productDescription}</p>
              <div className="pdp-divider" />
              </ProductReveal>

              <ProductReveal>
              {colorOptions.length > 0 && (
                <div className="pdp-section">
                  <p className="pdp-label">
                    Color:{' '}
                    <AnimatePresence mode="wait" initial={false}>
                      <ProductFadeSwap
                        key={activeColorName}
                        motionKey={activeColorName}
                        className="font-normal opacity-55"
                      >
                        {activeColorName}
                      </ProductFadeSwap>
                    </AnimatePresence>
                  </p>
                  <div className="pdp-color-row">
                    {colorOptions.map((opt) => (
                      <MotionPressable
                        key={opt.id}
                        type="button"
                        onClick={() => onColorChange(opt.hex)}
                        aria-label={opt.name}
                        aria-pressed={activeColorHex === opt.hex}
                        className={cn('pdp-color-thumb', activeColorHex === opt.hex && 'pdp-color-thumb--active')}
                        variant="chip"
                      >
                        <Image
                          src={opt.image}
                          alt={opt.name}
                          fill
                          sizes="72px"
                          className="object-contain object-center"
                        />
                      </MotionPressable>
                    ))}
                  </div>
                </div>
              )}

              {sizeOptionUi.showSelector ? (
                <div className="pdp-section">
                  <div className="flex items-center justify-between">
                    <p className="pdp-label">{sizeOptionUi.label}</p>
                    {sizeOptionUi.showSizeGuide ? (
                      <MotionPressable
                        type="button"
                        className="pdp-size-guide"
                        variant="subtle"
                        onClick={() => setSizeGuideOpen(true)}
                      >
                        <Ruler className="h-3 w-3" strokeWidth={2} />
                        Size Guide
                      </MotionPressable>
                    ) : null}
                  </div>
                  <div className="pdp-size-row" role="group" aria-label={sizeOptionUi.ariaLabel}>
                    {product.sizes.map((size) => {
                      const unavailable = product.unavailableSizes?.includes(size) ?? false
                      const active = modalSize === size && !unavailable
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => !unavailable && onSizeChange(size)}
                          aria-pressed={active}
                          aria-disabled={unavailable}
                          disabled={unavailable}
                          className={cn(
                            'pdp-size-btn',
                            active && 'pdp-size-btn--active',
                            unavailable && 'pdp-size-btn--unavailable',
                          )}
                        >
                          <span className="pdp-size-btn__label">{size}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              </ProductReveal>

              <ProductReveal>
              <div className="pdp-section">
                <p className="pdp-label">Quantity</p>
                <div className="pp-qty">
                  <MotionPressable
                    type="button"
                    className="pp-qty__btn"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1}
                    variant="icon"
                  >
                    <Minus className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </MotionPressable>
                  <span className="pp-qty__value" aria-live="polite">{quantity}</span>
                  <MotionPressable
                    type="button"
                    className="pp-qty__btn"
                    onClick={() => setQuantity((q) => q + 1)}
                    aria-label="Increase quantity"
                    variant="icon"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </MotionPressable>
                </div>
              </div>
              </ProductReveal>

              <ProductReveal>
              <div className="hidden lg:block">
                <ProductMiniRow title="You may also like" products={youMayAlsoLike} onSelect={(p) => onSelectProduct?.(p)} />
                <ProductMiniRow title="Recently viewed" products={recentlyViewed} onSelect={(p) => onSelectProduct?.(p)} />
              </div>
              </ProductReveal>
              </ProductStagger>

            </div>{/* end scroll */}

            {/* ── Sticky CTA bar ─────────────────────────── */}
            <div className="pdp-cta-bar">
              {/* Add to bag */}
              <MotionPressable
                type="button"
                className={cn('pdp-cta-add', addedPulse && 'pdp-cta-add--added')}
                onClick={handleAddToBag}
                variant="cta"
              >
                <AddToBagIconBadge size={17} tone="dark" pulse={addedPulse} />
                <MotionSwapLabel id={addedPulse ? 'added' : 'default'}>
                  {addedPulse ? 'Added to Bag!' : 'Add to Bag'}
                </MotionSwapLabel>
              </MotionPressable>

              <div className="flex gap-2.5">
                <MotionPressable type="button" className="pdp-cta-secondary flex-1" onClick={handleCheckout} variant="cta">
                  Buy Now
                </MotionPressable>
                <MotionPressable
                  type="button"
                  onClick={handleShare}
                  aria-label="Share"
                  className="pdp-cta-icon"
                  variant="icon"
                >
                  <Share2 className="h-[1rem] w-[1rem]" strokeWidth={2} />
                </MotionPressable>
              </div>
            </div>

          </div>{/* end info */}
        </div>
      </motion.div>

      {/* ── Lightbox — fullscreen zoom viewer ─────────────── */}
      <AnimatePresence>
        {lightboxOpen && media[activeImage]?.type !== 'video' && (
          <motion.div
            className="pdp-lightbox-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false) }}
          >
            <motion.div
              className="pdp-lightbox-frame"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`lightbox-${media[activeImage]?.url}-${activeImage}`}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.24 }}
                >
                  <Image
                    src={media[activeImage]!.url}
                    alt={product.name}
                    fill
                    sizes="90vw"
                    className="object-contain object-center"
                  />
                </motion.div>
              </AnimatePresence>

              <MotionPressable
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="splaro-nav-btn splaro-nav-btn--sm splaro-nav-btn--glass-dark pdp-lightbox-close"
                aria-label="Close zoom"
                variant="icon"
              >
                <X size={16} strokeWidth={2.2} />
              </MotionPressable>

              {media.length > 1 && (
                <>
                  <MotionPressable
                    type="button"
                    onClick={prevImage}
                    className="splaro-nav-btn splaro-nav-btn--glass-dark splaro-nav-btn--overlay splaro-nav-btn--prev"
                    aria-label="Previous image"
                    variant="nav"
                  >
                    <ChevronLeft size={18} strokeWidth={2} />
                  </MotionPressable>
                  <MotionPressable
                    type="button"
                    onClick={nextImage}
                    className="splaro-nav-btn splaro-nav-btn--glass-dark splaro-nav-btn--overlay splaro-nav-btn--next"
                    aria-label="Next image"
                    variant="nav"
                  >
                    <ChevronRight size={18} strokeWidth={2} />
                  </MotionPressable>
                  <div className="pdp-lightbox-progress">{activeImage + 1} / {media.length}</div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SizeGuideModal
        open={sizeGuideOpen && sizeOptionUi.showSizeGuide}
        onClose={() => setSizeGuideOpen(false)}
        category={product.category}
        productName={product.name}
      />
    </motion.div>
  )
}
