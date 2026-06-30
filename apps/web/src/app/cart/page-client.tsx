'use client'

import { ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { CartEmptyState } from '@/components/cart/CartEmptyState'
import { CartFreeShippingBar } from '@/components/cart/CartFreeShippingBar'
import { CartLineItem } from '@/components/cart/CartLineItem'
import { CartSummary } from '@/components/cart/CartSummary'

export function CartPageClient() {
  const { items, subtotal, removeItem, updateQuantity } = useCartStore()
  const { shipping } = useStorefrontSettings()
  const freeShippingThreshold = shipping.freeDeliveryThreshold
  const showFreeShippingBar = freeShippingThreshold > 0 && subtotal > 0

  return (
    <main className="cart-page-shell px-3 pb-28 pt-6 sm:px-5 lg:px-8 lg:pb-12">
      <section className="cart-page mx-auto max-w-3xl">
        <header className="cart-page__header">
          <div className="cart-page__title-row">
            <ShoppingBag className="h-5 w-5 text-luxury-black" strokeWidth={1.5} />
            <h1 className="cart-page__title">Your Bag</h1>
            {items.length > 0 ? (
              <span className="cart-page__count">({items.length})</span>
            ) : null}
          </div>
          <p className="cart-page__subtitle">Review items before checkout</p>
        </header>

        <div className="cart-page__panel glass-panel">
          {showFreeShippingBar ? (
            <CartFreeShippingBar subtotal={subtotal} threshold={freeShippingThreshold} />
          ) : null}

          <div className="cart-page__body">
            {items.length === 0 ? (
              <CartEmptyState />
            ) : (
              <ul className="divide-y divide-black/5">
                {items.map((item) => (
                  <CartLineItem
                    key={`${item.productId}-${item.variantId ?? ''}`}
                    item={item}
                    onDecrease={() =>
                      updateQuantity(item.productId, item.variantId, item.quantity - 1)
                    }
                    onIncrease={() =>
                      updateQuantity(item.productId, item.variantId, item.quantity + 1)
                    }
                    onRemove={() => removeItem(item.productId, item.variantId)}
                  />
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 ? (
            <CartSummary subtotal={subtotal} continueHref="/shop" />
          ) : null}
        </div>
      </section>
    </main>
  )
}
