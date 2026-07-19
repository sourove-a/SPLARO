'use client'

import '@/styles/pages/shop.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import { X } from 'lucide-react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import { LiquidGlassNavPair } from '@/components/ui/LiquidGlass'
import { MotionPressable } from '@/components/ui/MotionPressable'
import {
  quickViewImagesForColor,
  quickViewSizeInStock,
  type QuickViewProduct,
} from '@/lib/catalog/quick-view-product'
import { sortSizes } from '@/lib/catalog/live'
import { formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'
import toast from 'react-hot-toast'
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap'
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock'

interface ProductQuickViewProps {
  product: QuickViewProduct | null
  open: boolean
  onClose: () => void
  onAddToBag: (size?: string, colorHex?: string) => void
}

const PANEL_EASE = [0.16, 1, 0.3, 1] as const

export function ProductQuickView({ product, open, onClose, onAddToBag }: ProductQuickViewProps) {
  const reducedMotion = useReducedMotion()
  const [imageIndex, setImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [sizeShake, setSizeShake] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  useDialogFocusTrap(open, panelRef, onClose)

  useEffect(() => {
    if (!open || !product) return
    setImageIndex(0)
    setSelectedSize(null)
    setSelectedColor(product.colors[0] ?? product.colorOptions[0]?.hex ?? null)
    setSizeShake(false)
  }, [open, product])

  useOverlayScrollLock(open)

  const galleryImages = useMemo(
    () => (product ? quickViewImagesForColor(product, selectedColor ?? undefined) : []),
    [product, selectedColor],
  )

  const sortedSizes = useMemo(
    () => (product ? sortSizes(product.sizes, product.category) : []),
    [product],
  )

  const selectedColorName = useMemo(() => {
    if (!product || !selectedColor) return null
    return (
      product.colorOptions.find((color) => color.hex.toLowerCase() === selectedColor.toLowerCase())
        ?.name ?? selectedColor
    )
  }, [product, selectedColor])

  const hasDiscount = Boolean(product?.compareAtPrice && product.compareAtPrice > product.price)

  const handlePrevImage = useCallback(() => {
    setImageIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length)
  }, [galleryImages.length])

  const handleNextImage = useCallback(() => {
    setImageIndex((current) => (current + 1) % galleryImages.length)
  }, [galleryImages.length])

  const handleAddToBag = useCallback(() => {
    if (!product) return
    if (sortedSizes.length > 0 && !selectedSize) {
      setSizeShake(true)
      toast.error('Please select a size')
      window.setTimeout(() => setSizeShake(false), 520)
      return
    }
    if (
      selectedSize &&
      !quickViewSizeInStock(product, selectedSize, selectedColor ?? undefined)
    ) {
      setSizeShake(true)
      toast.error('Selected size is out of stock')
      window.setTimeout(() => setSizeShake(false), 520)
      return
    }
    onAddToBag(selectedSize ?? undefined, selectedColor ?? undefined)
    onClose()
  }, [onAddToBag, onClose, product, selectedColor, selectedSize, sortedSizes.length])

  const panelMotion = reducedMotion
    ? { initial: false as const }
    : {
        initial: { x: '100%' },
        animate: { x: '0%' },
        exit: { x: '100%' },
        transition: { duration: 0.36, ease: PANEL_EASE },
      }

  return (
    <AnimatePresence>
      {open && product ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="pqv-backdrop fixed inset-0 z-[58] bg-luxury-black/42 backdrop-blur-[5px]"
            aria-label="Close quick view"
            onClick={onClose}
          />

          <motion.aside
            ref={panelRef}
            {...panelMotion}
            className="pqv-panel fixed right-0 top-0 z-[59] flex h-full w-full max-w-[min(100vw,28rem)] flex-col border-l border-white/70 bg-white/[0.94] shadow-[-20px_0_72px_rgba(16,17,20,0.14)]"
            role="dialog"
            aria-modal="true"
            aria-label="Quick view"
          >
            <div className="pqv-panel__header flex items-center justify-between border-b border-black/6 px-5 py-4">
              <h2 className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-luxury-black">
                Quick View
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center border border-luxury-black/10 bg-white text-luxury-black transition-colors hover:border-luxury-black/20"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="pqv-panel__body flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
              <div className="pqv-gallery relative bg-[#f6f4f1]">
                <div className="pqv-gallery__stage relative aspect-[4/5] w-full overflow-hidden">
                  {galleryImages[imageIndex] ? (
                    <StorefrontImage
                      src={galleryImages[imageIndex]}
                      alt={product.name}
                      profile="gallery"
                      fill
                      fit="contain"
                      className="pqv-gallery__img"
                      priority
                    />
                  ) : null}
                </div>

                {galleryImages.length > 1 ? (
                  <>
                    <div className="pqv-gallery__controls">
                      <LiquidGlassNavPair
                        onPrev={handlePrevImage}
                        onNext={handleNextImage}
                      />
                    </div>
                    <p className="pqv-gallery__counter">
                      {imageIndex + 1} / {galleryImages.length}
                    </p>
                  </>
                ) : null}
              </div>

              <div className="pqv-info px-5 py-5">
                <h3 className="font-serif text-[1.35rem] leading-tight tracking-tight text-luxury-black">
                  {product.name}
                </h3>
                {product.productCode ? (
                  <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-luxury-gray">
                    Code: {product.productCode}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-baseline gap-2">
                  <span className="text-[0.95rem] font-semibold text-luxury-black">
                    {formatBDT(product.price)}
                  </span>
                  {hasDiscount ? (
                    <span className="text-[0.82rem] text-luxury-gray line-through">
                      {formatBDT(product.compareAtPrice!)}
                    </span>
                  ) : null}
                </div>

                {selectedColorName ? (
                  <p className="mt-4 text-[0.78rem] text-luxury-gray">
                    Color: <span className="text-luxury-black">{selectedColorName}</span>
                  </p>
                ) : null}

                {product.colorOptions.length > 1 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.colorOptions.map((color) => {
                      const active =
                        selectedColor?.toLowerCase() === color.hex.toLowerCase()
                      return (
                        <button
                          key={color.hex}
                          type="button"
                          className={cn(
                            'pqv-color-swatch',
                            active && 'pqv-color-swatch--active',
                          )}
                          style={{ backgroundColor: color.hex }}
                          onClick={() => {
                            setSelectedColor(color.hex)
                            setImageIndex(0)
                          }}
                          aria-label={color.name}
                          aria-pressed={active}
                        />
                      )
                    })}
                  </div>
                ) : null}

                {sortedSizes.length > 0 ? (
                  <div className={cn('pqv-sizes mt-5', sizeShake && 'pqv-sizes--shake')}>
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-luxury-black">
                        Select Size
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sortedSizes.map((size) => {
                        const inStock = quickViewSizeInStock(
                          product,
                          size,
                          selectedColor ?? undefined,
                        )
                        const active = selectedSize === size
                        return (
                          <button
                            key={size}
                            type="button"
                            disabled={!inStock}
                            className={cn(
                              'pqv-size',
                              active && 'pqv-size--active',
                              !inStock && 'pqv-size--disabled',
                            )}
                            onClick={() => setSelectedSize(size)}
                            aria-pressed={active}
                          >
                            {size}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 space-y-2.5">
                  <MotionPressable
                    type="button"
                    className="pqv-cta w-full"
                    disabled={!product.inStock}
                    onClick={handleAddToBag}
                  >
                    {product.inStock ? 'Add to bag' : 'Sold out'}
                  </MotionPressable>

                  <Link
                    href={product.href}
                    className="pqv-full-details"
                    onClick={onClose}
                    prefetch
                  >
                    Full details
                  </Link>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
