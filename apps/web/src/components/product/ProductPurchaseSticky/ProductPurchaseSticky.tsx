'use client'

import '@/styles/pages/pdp.css'

import { AnimatePresence, motion } from '@/lib/motion/react'
import { AddToBagIconBadge } from '@/components/product/AddToBagIcon'
import { MotionPressable } from '@/components/ui/MotionPressable'
import { MotionSwapLabel } from '@/components/ui/MotionSwapLabel/MotionSwapLabel'
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
  if (!inStock) return null

  const selectionHint = [selectedSize, selectedColorLabel].filter(Boolean).join(' · ')
  const addLabelId =
    addingToCart && !addedPulse ? 'pending' : addedPulse ? 'added' : 'default'
  const addLabelText =
    addingToCart && !addedPulse ? 'Adding…' : addedPulse ? 'Added to bag' : 'Add to bag'

  return (
    <>
      {/* Mobile floating bar */}
      <div
        className={cn('pp-mobile-sticky-bar', !showFloating && 'pp-mobile-sticky-bar--hidden')}
        aria-label="Quick purchase"
        aria-hidden={!showFloating}
      >
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
            disabled={addingToCart || !showFloating}
            tabIndex={showFloating ? 0 : -1}
            variant="cta"
          >
            <AddToBagIconBadge size={16} tone="light" pulse={addedPulse} />
            <MotionSwapLabel id={addLabelId}>{addLabelText}</MotionSwapLabel>
          </MotionPressable>
          <MotionPressable
            type="button"
            className="pp-mobile-sticky-bar__btn pp-mobile-sticky-bar__btn--buy"
            onClick={onBuyNow}
            disabled={!showFloating}
            tabIndex={showFloating ? 0 : -1}
            variant="cta"
          >
            Buy now
          </MotionPressable>
        </div>
      </div>

      {/* Desktop floating bar */}
      <AnimatePresence>
        {showFloating ? (
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
        ) : null}
      </AnimatePresence>
    </>
  )
}
