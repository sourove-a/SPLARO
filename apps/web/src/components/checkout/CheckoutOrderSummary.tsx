import Image from 'next/image'
import Link from 'next/link'
import { Headphones, RefreshCw, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import type { CartItem } from '@/store/cartStore'
import { formatBDT } from '@/lib/utils/currency'
import { isDigitalPayment, type PaymentMethod } from '@/lib/checkout/payments'

interface CheckoutOrderSummaryProps {
  items: CartItem[]
  itemCount: number
  subtotal: number
  delivery: number
  discount: number
  totalBdt: number
  payment: PaymentMethod
  deliveryProgress: number | null
  freeDeliveryThreshold: number
}

export function CheckoutOrderSummary({
  items,
  itemCount,
  subtotal,
  delivery,
  discount,
  totalBdt,
  payment,
  deliveryProgress,
  freeDeliveryThreshold,
}: CheckoutOrderSummaryProps) {
  return (
    <aside className="checkout-summary checkout-glass-panel">
      <div className="checkout-summary__head">
        <h2>Order summary</h2>
        <span className="checkout-summary__badge">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
      </div>

      {deliveryProgress !== null ? (
        <div className="checkout-delivery-progress">
          <div className="checkout-delivery-progress__copy">
            <Truck className="h-3.5 w-3.5" strokeWidth={2.2} />
            <span>
              {deliveryProgress >= 100
                ? 'You unlocked free delivery'
                : `Add ${formatBDT(freeDeliveryThreshold - subtotal)} more for free delivery`}
            </span>
          </div>
          <div className="checkout-delivery-progress__track" aria-hidden>
            <span style={{ width: `${deliveryProgress}%` }} />
          </div>
        </div>
      ) : delivery === 0 && subtotal > 0 ? (
        <div className="checkout-delivery-progress checkout-delivery-progress--unlocked">
          <Truck className="h-3.5 w-3.5" strokeWidth={2.2} />
          <span>Free delivery applied</span>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="checkout-empty">
          <ShoppingBag className="mx-auto h-9 w-9 text-black/25" strokeWidth={1.75} />
          <p className="mt-4 text-lg font-black">Your bag is empty</p>
          <Link href="/shop" className="checkout-btn checkout-btn--primary mt-5">
            Shop products
          </Link>
        </div>
      ) : (
        <>
          <div className="checkout-items">
            {items.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="checkout-item">
                <div className="checkout-item__thumb">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="56px"
                    className="object-cover object-top"
                  />
                </div>
                <div className="checkout-item__meta">
                  <p className="checkout-item__name">{item.name}</p>
                  <p className="checkout-item__detail">
                    Qty {item.quantity}
                    {item.size ? ` · ${item.size}` : ''}
                  </p>
                </div>
                <p className="checkout-item__price">{formatBDT(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>

          <div className="checkout-summary-lines">
            <div className="checkout-summary-line">
              <span>Subtotal</span>
              <span>{formatBDT(subtotal)}</span>
            </div>
            <div className="checkout-summary-line">
              <span>Delivery</span>
              <span>{delivery === 0 ? 'Free' : formatBDT(delivery)}</span>
            </div>
            {discount > 0 ? (
              <div className="checkout-summary-line">
                <span>Discount</span>
                <span>- {formatBDT(discount)}</span>
              </div>
            ) : null}
            <div className="checkout-divider" />
            <div className="checkout-summary-line checkout-summary-line--total">
              <span>Total</span>
              <span>{formatBDT(totalBdt)}</span>
            </div>
          </div>

          {isDigitalPayment(payment) ? (
            <p className="checkout-promo">You save 5% with {payment}. Limited 2026 offer.</p>
          ) : null}

          <div className="checkout-security">
            <span className="checkout-security__icon">
              <ShieldCheck className="h-4 w-4" strokeWidth={2.1} />
            </span>
            <div>
              <p className="checkout-security__title">Your data is 100% safe and secure</p>
              <p className="checkout-security__text">
                We use SSL encryption and secure payment processing for every order.
              </p>
            </div>
          </div>

          <div className="checkout-sidebar-trust">
            <div className="checkout-sidebar-trust__card">
              <Truck className="h-4 w-4" strokeWidth={2} />
              <div>
                <strong>Fast delivery</strong>
                <span>Fast dispatch with live order updates.</span>
              </div>
            </div>
            <div className="checkout-sidebar-trust__card">
              <RefreshCw className="h-4 w-4" strokeWidth={2} />
              <div>
                <strong>Easy returns</strong>
                <span>Hassle-free returns within 7 days.</span>
              </div>
            </div>
            <div className="checkout-sidebar-trust__card">
              <Headphones className="h-4 w-4" strokeWidth={2} />
              <div>
                <strong>24/7 support</strong>
                <span>We&apos;re here to help you anytime.</span>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
