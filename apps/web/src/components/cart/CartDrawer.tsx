'use client'

import '@/styles/pages/cart.css'

import { useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from '@/lib/motion/react'
import { X, ShoppingBag } from 'lucide-react'
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
  useDialogFocusTrap(isOpen, drawerRef, onClose)
  useOverlayScrollLock(isOpen)
  const freeShippingThreshold = shipping.freeDeliveryThreshold
  const showFreeShippingBar = freeShippingThreshold > 0

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
    : { duration: 0.32, ease: EASE_EXPO_OUT }

  const panelTransition = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.82 }

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          {/* Opacity-only dim — blur is static via CSS so it doesn't recompute every frame */}
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            className="cart-drawer__backdrop z-drawer-backdrop"
            onClick={onClose}
            aria-label="Close cart"
          />

          <motion.aside
            ref={drawerRef}
            initial={reducedMotion ? { x: 0 } : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reducedMotion ? { x: 0, opacity: 0 } : { x: '100%' }}
            transition={panelTransition}
            className={cn(
              'cart-drawer__panel spl-glass-sheet z-drawer-panel',
              'fixed right-0 top-0 flex h-full w-96 max-w-[95vw] flex-col border-l',
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            tabIndex={-1}
          >
            <div className="h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

            <div className="flex items-center justify-between border-b border-black/5 px-6 py-5">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="h-4 w-4 text-luxury-black" strokeWidth={1.5} />
                <h2 className="text-[0.6875rem] font-black uppercase tracking-[0.18em] text-luxury-black">
                  Your Bag
                  {items.length > 0 ? (
                    <span className="ml-2 font-normal text-luxury-gray">({items.length})</span>
                  ) : null}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {items.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="px-2 py-1 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-luxury-gray transition-colors hover:text-red-600"
                  >
                    Clear all
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close cart"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-all hover:bg-black hover:text-white"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {subtotal > 0 && showFreeShippingBar ? (
              <CartFreeShippingBar subtotal={subtotal} threshold={freeShippingThreshold} />
            ) : null}

            <div className="flex-1 overflow-y-auto" data-lenis-prevent>
              {items.length === 0 ? (
                <CartEmptyState onClose={onClose} />
              ) : (
                <motion.ul className="divide-y divide-black/5" layout={!reducedMotion}>
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
    </AnimatePresence>
  )
}
