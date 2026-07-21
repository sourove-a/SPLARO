'use client'

import '@/styles/pages/pdp.css'

import { AnimatePresence, motion } from '@/lib/motion/react'
import { AddToBagIconBadge } from '@/components/product/AddToBagIcon'
import { MotionPressable } from '@/components/ui/MotionPressable'
import { MotionSwapLabel } from '@/components/ui/MotionSwapLabel/MotionSwapLabel'
import { useMinWidth, useMounted } from '@/lib/hooks/use-mobile-viewport'
import { EASE_EXPO_OUT } from '@/lib/motion/config'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'

interface ProductPurchaseStickyProps {
  /** True when inline CTAs scrolled out of view — show floating bars. */
  showFloating: boolean
  inStock: boolean
  price: number
  quantity: number
  selectedSize: string | null
  selectedColorLabel: string | null
  addingToCart: boolean
  addedPulse: boolean
  onAddToCart: () => void
  onBuyNow: () => void
  showMotion: boolean
}

export function ProductPurchaseSticky({
  showFloating,
  inStock,
  price,
  quantity,
  selectedSize,
  selectedColorLabel,
  addingToCart,
  addedPulse,
  onAddToCart,
  onBuyNow,
  showMotion,
}: ProductPurchaseStickyProps) {
  const mounted = useMounted()
  const isDesktop = useMinWidth(1024)

  // Unmount when idle — avoids duplicate Buy Now / price in the DOM (a11y + crawlers).
  // Viewport-split so mobile + desktop bars never coexist.
  if (!inStock || !showFloating || !mounted) return null

  const selectionHint = [selectedSize, selectedColorLabel].filter(Boolean).join(' · ')
  const addLabelId =
    addingToCart && !addedPulse ? 'pending' : addedPulse ? 'added' : 'default'
  const addLabelText =
    addingToCart && !addedPulse ? 'Adding…' : addedPulse ? 'Added to bag' : 'Add to bag'

  if (!isDesktop) {
    return (
      <div className="pp-mobile-sticky-bar" aria-label="Quick purchase">
        <div className="pp-mobile-sticky-bar__price">
          <span className="pp-mobile-sticky-bar__price-label">
            {quantity > 1 ? 'Total' : 'Price'}
          </span>
          <span className="pp-mobile-sticky-bar__price-value">{formatBDT(price * quantity)}</span>
          {selectionHint ? (
            <span className="pp-mobile-sticky-bar__meta">{selectionHint}</span>
          ) : null}
        </div>
        <div className="pp-mobile-sticky-bar__actions">
          <MotionPressable
            type="button"
            className={cn(
              'pp-mobile-sticky-bar__btn pp-mobile-sticky-bar__btn--add',
              addedPulse && 'pp-btn-add--added',
            )}
            onClick={onAddToCart}
            disabled={addingToCart}
            variant="cta"
          >
            <AddToBagIconBadge size={16} tone="light" pulse={addedPulse} />
            <MotionSwapLabel id={addLabelId}>{addLabelText}</MotionSwapLabel>
          </MotionPressable>
          <MotionPressable
            type="button"
            className="pp-mobile-sticky-bar__btn pp-mobile-sticky-bar__btn--buy"
            onClick={onBuyNow}
            variant="cta"
          >
            Buy now
          </MotionPressable>
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        key="desktop-sticky"
        className="pp-desktop-sticky-bar"
        initial={showMotion ? { y: 24, opacity: 0, x: '-50%' } : { x: '-50%' }}
        animate={{ y: 0, opacity: 1, x: '-50%' }}
        {...(showMotion ? { exit: { y: 20, opacity: 0, x: '-50%' } } : {})}
        transition={{ duration: 0.34, ease: EASE_EXPO_OUT }}
        aria-label="Quick purchase"
      >
        <div className="pp-desktop-sticky-bar__inner">
          <div className="pp-desktop-sticky-bar__copy">
            <span className="pp-desktop-sticky-bar__price">{formatBDT(price * quantity)}</span>
            {selectionHint ? (
              <span className="pp-desktop-sticky-bar__meta">{selectionHint}</span>
            ) : null}
          </div>
          <div className="pp-desktop-sticky-bar__actions">
            <MotionPressable
              type="button"
              className={cn('pp-desktop-sticky-bar__add', addedPulse && 'pp-btn-add--added')}
              onClick={onAddToCart}
              disabled={addingToCart}
              variant="cta"
            >
              <AddToBagIconBadge size={16} tone="dark" pulse={addedPulse} />
              <MotionSwapLabel id={`desktop-${addLabelId}`}>{addLabelText}</MotionSwapLabel>
            </MotionPressable>
            <MotionPressable
              type="button"
              className="pp-desktop-sticky-bar__buy"
              onClick={onBuyNow}
              variant="cta"
            >
              Buy Now
            </MotionPressable>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
