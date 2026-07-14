'use client'

import { RefreshCw, ShoppingBag } from 'lucide-react'
import { useCartStore, cartLineKey, toCartLineRef } from '@/store/cartStore'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { CartEmptyState } from '@/components/cart/CartEmptyState'
import { CartFreeShippingBar } from '@/components/cart/CartFreeShippingBar'
import { CartLineItem } from '@/components/cart/CartLineItem'
import { CartSummary } from '@/components/cart/CartSummary'
import { cn } from '@/lib/utils/cn'

export function CartPageClient() {
  const { items, subtotal, removeItem, updateQuantity, clearCart } = useCartStore()
  const cartHydrated = useCartStore((state) => state._hydrated)
  const { shipping } = useStorefrontSettings()
  const freeShippingThreshold = shipping.freeDeliveryThreshold
  const showFreeShippingBar = freeShippingThreshold > 0 && subtotal > 0
  const isEmpty = items.length === 0

  if (!cartHydrated) {
    return (
      <div className="cart-page-shell cart-page-shell--loading px-3 pb-28 pt-6 sm:px-5 lg:px-8 lg:pb-12">
        <section className="cart-page mx-auto max-w-3xl">
          <div className="cart-page__panel glass-panel flex min-h-[240px] flex-col items-center justify-center py-16">
            <RefreshCw className="h-8 w-8 animate-spin text-black/35" strokeWidth={2} />
            <p className="mt-4 text-sm font-black text-black/55">Loading your bag…</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'cart-page-shell px-3 pb-28 pt-6 sm:px-5 lg:px-8 lg:pb-12',
        isEmpty && 'cart-page-shell--empty',
      )}
    >
      <section className="cart-page mx-auto max-w-3xl">
        {!isEmpty ? (
          <header className="cart-page__header">
            <div className="cart-page__title-row">
              <ShoppingBag className="h-5 w-5 text-luxury-black" strokeWidth={1.5} />
              <h1 className="cart-page__title">Your Bag</h1>
              <span className="cart-page__count">({items.length})</span>
              <button
                type="button"
                onClick={clearCart}
                className="ml-auto text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-luxury-gray transition-colors hover:text-red-600"
              >
                Clear all
              </button>
            </div>
            <p className="cart-page__subtitle">Review items before checkout</p>
          </header>
        ) : null}

        <div className="cart-page__panel glass-panel">
          {showFreeShippingBar ? (
            <CartFreeShippingBar subtotal={subtotal} threshold={freeShippingThreshold} />
          ) : null}

          <div className="cart-page__body">
            {isEmpty ? (
              <CartEmptyState />
            ) : (
              <ul className="divide-y divide-black/5">
                {items.map((item) => (
                  <CartLineItem
                    key={cartLineKey(item)}
                    item={item}
                    onDecrease={() => updateQuantity(toCartLineRef(item), item.quantity - 1)}
                    onIncrease={() => updateQuantity(toCartLineRef(item), item.quantity + 1)}
                    onRemove={() => removeItem(toCartLineRef(item))}
                  />
                ))}
              </ul>
            )}
          </div>

          {!isEmpty ? (
            <CartSummary subtotal={subtotal} continueHref="/shop" />
          ) : null}
        </div>
      </section>
    </div>
  )
}
