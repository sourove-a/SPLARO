'use client'

import '@/styles/pages/cart.css'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from '@/lib/motion/react'
import { X } from 'lucide-react'
import { BagIcon } from '@/components/product/AddToBagIcon'
import { useCartStore, cartLineKey, toCartLineRef } from '@/store/cartStore'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { CartEmptyState } from './CartEmptyState'
import { CartLineItem } from './CartLineItem'
import { CartFreeShippingBar } from './CartFreeShippingBar'
import { CartSummary } from './CartSummary'
import { exitPop } from '@/lib/motion/variants'
import { EASE_EXPO_OUT } from '@/lib/motion/config'
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap'
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock'
import { cn } from '@/lib/utils/cn'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, subtotal, removeItem, updateQuantity, clearCart } = useCartStore()
  const { shipping } = useStorefrontSettings()
  const reducedMotion = useReducedMotion()
  const drawerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useDialogFocusTrap(isOpen, drawerRef, onClose)
  useOverlayScrollLock(isOpen)
  const freeShippingThreshold = shipping.freeDeliveryThreshold
  const showFreeShippingBar = freeShippingThreshold > 0

  useEffect(() => setMounted(true), [])

  const lineMotion = reducedMotion
    ? { initial: false as const }
    : {
        variants: exitPop,
        initial: 'initial',
        animate: 'animate',
        exit: 'exit',
      }

  const backdropTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: EASE_EXPO_OUT }

  // Tween over spring — spring felt like “loading” on bag click.
  const panelTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: EASE_EXPO_OUT }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence mode="sync">
      {isOpen ? (
        <>
          {/* Opacity-only dim — blur is static via CSS so it doesn't recompute every frame */}
          <motion.button
            key="cart-backdrop"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            className="cart-drawer__backdrop z-drawer-backdrop"
            onClick={onClose}
            aria-label="Dismiss cart overlay"
          />

          <motion.aside
            key="cart-panel"
            ref={drawerRef}
            initial={reducedMotion ? { x: 0 } : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reducedMotion ? { x: 0, opacity: 0 } : { x: '100%' }}
            transition={panelTransition}
            className={cn(
              'cart-drawer__panel spl-glass-sheet z-drawer-panel',
              'fixed right-0 top-0 flex h-full w-[min(24rem,95vw)] flex-col border-l',
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            tabIndex={-1}
            data-lenis-prevent
          >
            <div className="cart-drawer__accent" aria-hidden />

            <div className="cart-drawer__header">
              <div className="cart-drawer__title-wrap">
                <span className="cart-drawer__icon" aria-hidden>
                  <BagIcon size={16} strokeWidth={1.6} />
                </span>
                <div>
                  <p className="cart-drawer__eyebrow">SPLARO</p>
                  <h2 className="cart-drawer__title">
                    Your Bag
                    {items.length > 0 ? (
                      <span className="cart-drawer__count">{items.length}</span>
                    ) : null}
                  </h2>
                </div>
              </div>
              <div className="cart-drawer__header-actions">
                {items.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="cart-drawer__clear"
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close cart"
                  className="cart-drawer__close"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {subtotal > 0 && showFreeShippingBar ? (
              <CartFreeShippingBar subtotal={subtotal} threshold={freeShippingThreshold} />
            ) : null}

            <div className="cart-drawer__body" data-lenis-prevent>
              {items.length === 0 ? (
                <CartEmptyState onClose={onClose} />
              ) : (
                <motion.ul className="cart-drawer__list" layout={!reducedMotion}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {items.map((item) => (
                      <motion.li key={cartLineKey(item)} layout={!reducedMotion} {...lineMotion}>
                        <CartLineItem
                          item={item}
                          onDecrease={() => updateQuantity(toCartLineRef(item), item.quantity - 1)}
                          onIncrease={() => updateQuantity(toCartLineRef(item), item.quantity + 1)}
                          onRemove={() => removeItem(toCartLineRef(item))}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </div>

            {items.length > 0 ? <CartSummary subtotal={subtotal} onClose={onClose} /> : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
