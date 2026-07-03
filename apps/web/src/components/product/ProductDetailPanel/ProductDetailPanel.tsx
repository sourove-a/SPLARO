'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft, ChevronRight,
  Heart, Minus, Plus, Ruler, Share2, ShoppingBag, X,
} from 'lucide-react'
import { getCheckoutEntryPath } from '@/lib/checkout/checkout-auth'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'
import { products, type ColorOption } from '@/data/storefront'
import { getRecentlyViewed, trackRecentlyViewed } from '@/lib/recentlyViewed'
import { ProductMiniRow } from '@/components/product/ProductMiniRow/ProductMiniRow'

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
  saved: boolean
  onClose: () => void
  onSizeChange: (size: string) => void
  onColorChange: (color: string) => void
  onAddToBag: (quantity: number) => void
  onCheckout?: () => void
  onSelectProduct?: (product: ProductDetailItem) => void
  onToggleSaved: () => void
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
  product, modalSize, modalColor, saved,
  onClose, onSizeChange, onColorChange, onAddToBag, onCheckout,
  onSelectProduct, onToggleSaved,
}: ProductDetailPanelProps) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [activeImage, setActiveImage] = useState(0)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [addedPulse, setAddedPulse] = useState(false)
  const [quantity, setQuantity] = useState(1)

  const colorOptions = useMemo(() => resolveColorOptions(product), [product])
  const activeColorHex = modalColor ?? colorOptions[0]?.hex ?? product.colors[0] ?? ''
  const activeColor = useMemo(
    () => colorOptions.find((o) => o.hex === activeColorHex) ?? colorOptions[0],
    [activeColorHex, colorOptions],
  )
  const activeColorName = activeColor?.name ?? colorLabels[activeColorHex.toLowerCase()] ?? 'Selected'

  const media = useMemo(() => {
    const primary = activeColor?.image ?? product.image
    if (product.media?.length) {
      const gallery = [...product.media]
      if (primary && !gallery.some((item) => item.url === primary)) {
        gallery.push({ type: 'image', url: primary })
      }
      return gallery
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
    trackRecentlyViewed(product.id)
    setRecentIds(getRecentlyViewed(product.id))
    document.body.classList.add('product-sheet-open')
    return () => document.body.classList.remove('product-sheet-open')
  }, [product.id])

  useEffect(() => { setActiveImage(0) }, [activeColorHex])

  const recentlyViewed = useMemo(
    () => recentIds.map((id) => products.find((p) => p.id === id)).filter(Boolean).slice(0, 6) as ProductDetailItem[],
    [recentIds],
  )
  const youMayAlsoLike = useMemo(
    () => products.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 6),
    [product.id, product.category],
  )

  const handleAddToBag = () => {
    onAddToBag(quantity)
    setAddedPulse(true)
    setTimeout(() => setAddedPulse(false), 1400)
  }

  const handleCheckout = () => {
    if (onCheckout) { onCheckout(); return }
    onAddToBag(quantity)
    router.push(getCheckoutEntryPath(Boolean(user)))
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
            <button className="pdp-close-img lg:hidden" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>

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
                    initial={{ opacity: 0, scale: 1.01 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.99 }}
                    transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
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

                {media.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prevImage}
                      className="splaro-nav-btn splaro-nav-btn--sm splaro-nav-btn--overlay splaro-nav-btn--prev"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={16} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={nextImage}
                      className="splaro-nav-btn splaro-nav-btn--sm splaro-nav-btn--overlay splaro-nav-btn--next"
                      aria-label="Next image"
                    >
                      <ChevronRight size={16} strokeWidth={2} />
                    </button>

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
                <div className="pdp-gallery__thumbstrip">
                  {media.map((item, i) => (
                    <button
                      key={`${item.type}-${item.url}-${i}`}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`${item.type} ${i + 1}`}
                      className={cn('pdp-gallery__thumb', i === activeImage && 'pdp-gallery__thumb--active')}
                    >
                      {item.type === 'video' ? (
                        <>
                          <video src={item.url} muted playsInline className="pdp-gallery__video-thumb" />
                          <span className="pp-gallery__thumb-play" aria-hidden>Play</span>
                        </>
                      ) : (
                        <Image src={item.url} alt="" fill sizes="64px" className="object-contain object-center" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Info ────────────────────────────────── */}
          <div className="pdp-info">

            {/* Scrollable content */}
            <div className="pdp-info__scroll" data-lenis-prevent>

              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="pdp-eyebrow">SPLARO</p>
                  <h2 className="pdp-name">{product.name}</h2>
                  <p className="pdp-code">Product Code · {product.code}</p>
                </div>
                <button className="pdp-close-info" onClick={onClose} aria-label="Close">
                  <X className="h-[0.9rem] w-[0.9rem]" strokeWidth={2.2} />
                </button>
              </div>

              {/* Price */}
              <div className="pdp-price-row">
                <span className="pdp-price">{formatBDT(product.price)}</span>
                {hasDiscount && (
                  <>
                    <span className="pdp-compare">{formatBDT(product.compareAtPrice!)}</span>
                    <span className="pdp-discount-badge">-{discountPct}%</span>
                  </>
                )}
              </div>

              <p className="pdp-desc">{productDescription}</p>

              <div className="pdp-divider" />

              {/* Colors — ilyn thumbnail style */}
              {colorOptions.length > 0 && (
                <div className="pdp-section">
                  <p className="pdp-label">
                    Color: <span className="font-normal opacity-55">{activeColorName}</span>
                  </p>
                  <div className="pdp-color-row">
                    {colorOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onColorChange(opt.hex)}
                        aria-label={opt.name}
                        aria-pressed={activeColorHex === opt.hex}
                        className={cn('pdp-color-thumb', activeColorHex === opt.hex && 'pdp-color-thumb--active')}
                      >
                        <Image
                          src={opt.image}
                          alt={opt.name}
                          fill
                          sizes="72px"
                          className="object-contain object-center"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sizes — ilyn style */}
              {product.sizes.length > 0 && (
                <div className="pdp-section">
                  <div className="flex items-center justify-between">
                    <p className="pdp-label">Select Size</p>
                    <button type="button" className="pdp-size-guide">
                      <Ruler className="h-3 w-3" strokeWidth={2} />
                      Size Guide
                    </button>
                  </div>
                  <div className="pdp-size-row">
                    {product.sizes.map((size) => {
                      const unavailable = product.unavailableSizes?.includes(size) ?? false
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => !unavailable && onSizeChange(size)}
                          aria-pressed={modalSize === size}
                          aria-disabled={unavailable}
                          className={cn(
                            'pdp-size-btn',
                            modalSize === size && !unavailable && 'pdp-size-btn--active',
                            unavailable && 'pdp-size-btn--unavailable',
                          )}
                        >
                          {size}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="pdp-section">
                <p className="pdp-label">Quantity</p>
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
                  <span className="pp-qty__value" aria-live="polite">{quantity}</span>
                  <button
                    type="button"
                    className="pp-qty__btn"
                    onClick={() => setQuantity((q) => q + 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              {/* Recently viewed + You may also like — desktop only */}
              <div className="hidden lg:block">
                <ProductMiniRow title="You may also like" products={youMayAlsoLike} onSelect={(p) => onSelectProduct?.(p)} />
                <ProductMiniRow title="Recently viewed" products={recentlyViewed} onSelect={(p) => onSelectProduct?.(p)} />
              </div>

            </div>{/* end scroll */}

            {/* ── Sticky CTA bar ─────────────────────────── */}
            <div className="pdp-cta-bar">
              <div className="pdp-trust" aria-label="Shopping assurances">
                <span>Easy returns</span>
                <span>Secure checkout</span>
                <span>Fast delivery</span>
              </div>

              {/* Add to bag */}
              <button
                type="button"
                className={cn('pdp-cta-add', addedPulse && 'pdp-cta-add--added')}
                onClick={handleAddToBag}
              >
                <ShoppingBag className="h-4 w-4" strokeWidth={2} />
                {addedPulse ? 'Added to Bag!' : 'Add to Bag'}
              </button>

              <div className="flex gap-2.5">
                <button type="button" className="pdp-cta-secondary flex-1" onClick={handleCheckout}>
                  Buy Now
                </button>
                <button
                  type="button"
                  onClick={onToggleSaved}
                  aria-label={saved ? 'Remove from wishlist' : 'Save'}
                  className={cn('pdp-cta-icon', saved && 'pdp-cta-icon--saved')}
                >
                  <Heart
                    className={cn('h-[1rem] w-[1rem]', saved && 'fill-[#C8A97E] text-[#C8A97E]')}
                    strokeWidth={2}
                  />
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share"
                  className="pdp-cta-icon"
                >
                  <Share2 className="h-[1rem] w-[1rem]" strokeWidth={2} />
                </button>
              </div>
            </div>

          </div>{/* end info */}
        </div>
      </motion.div>
    </motion.div>
  )
}
