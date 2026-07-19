'use client'

import { RefreshCw } from 'lucide-react'
import { useCartStore, cartLineKey, toCartLineRef } from '@/store/cartStore'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { CartEmptyState } from '@/components/cart/CartEmptyState'
import { CartFreeShippingBar } from '@/components/cart/CartFreeShippingBar'
import { CartLineItem } from '@/components/cart/CartLineItem'
import { CartSummary } from '@/components/cart/CartSummary'
import { cn } from '@/lib/utils/cn'

export function CartPageClient() {
  const { items, itemCount, subtotal, removeItem, updateQuantity, clearCart } = useCartStore()
  const cartHydrated = useCartStore((state) => state._hydrated)
  const { shipping } = useStorefrontSettings()
  const freeShippingThreshold = shipping.freeDeliveryThreshold
  const showFreeShippingBar = freeShippingThreshold > 0 && subtotal > 0
  const isEmpty = items.length === 0

  if (!cartHydrated) {
    return (
      <div className="cart-page-shell cart-page-shell--loading">
        <section className="cart-page">
          <div className="cart-page__panel cart-page__panel--loading">
            <RefreshCw className="cart-page__spinner" strokeWidth={1.75} aria-hidden />
            <p className="cart-page__loading-text">Loading your bag…</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={cn('cart-page-shell', isEmpty && 'cart-page-shell--empty')}>
      <section className="cart-page">
        {!isEmpty ? (
          <header className="cart-page__header">
            <div className="cart-page__title-row">
              <div className="cart-page__heading">
                <h1 className="cart-page__title">Your Bag</h1>
                <span className="cart-page__count" aria-label={`${itemCount} items`}>
                  {itemCount}
                </span>
              </div>
              <button type="button" onClick={clearCart} className="cart-page__clear">
                Clear all
              </button>
            </div>
            <p className="cart-page__subtitle">Review items before checkout</p>
          </header>
        ) : null}

        <div className="cart-page__panel">
          {showFreeShippingBar ? (
            <CartFreeShippingBar subtotal={subtotal} threshold={freeShippingThreshold} />
          ) : null}

          <div className="cart-page__body">
            {isEmpty ? (
              <CartEmptyState />
            ) : (
              <ul className="cart-page__lines">
                {items.map((item) => (
                  <li key={cartLineKey(item)}>
                    <CartLineItem
                      item={item}
                      onDecrease={() => updateQuantity(toCartLineRef(item), item.quantity - 1)}
                      onIncrease={() => updateQuantity(toCartLineRef(item), item.quantity + 1)}
                      onRemove={() => removeItem(toCartLineRef(item))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isEmpty ? <CartSummary subtotal={subtotal} continueHref="/shop" /> : null}
        </div>
      </section>
    </div>
  )
}
