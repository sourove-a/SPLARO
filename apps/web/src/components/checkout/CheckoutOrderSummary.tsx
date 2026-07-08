import Image from 'next/image'
import Link from 'next/link'
import { Headphones, RefreshCw, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import type { CartItem } from '@/store/cartStore'
import { formatBDT, DIGITAL_PAYMENT_DISCOUNT_RATE } from '@/lib/utils/currency'
import type { PaymentMethod } from '@/lib/checkout/payments'

interface CheckoutOrderSummaryProps {
  items: CartItem[]
  itemCount: number
  subtotal: number
  delivery: number
  discount: number
  digitalDiscount: number
  totalBdt: number
  payment: PaymentMethod
  deliveryProgress: number | null
  freeDeliveryThreshold: number
}

function formatVariantDetail(item: CartItem): string {
  const parts: string[] = []
  if (item.size) parts.push(`Size ${item.size}`)
  if (item.color) {
    const isHex = item.color.startsWith('#')
    parts.push(isHex ? `Color ${item.color.toUpperCase()}` : item.color)
  }
  parts.push(`Qty ${item.quantity}`)
  return parts.join(' · ')
}

export function CheckoutOrderSummary({
  items,
  itemCount,
  subtotal,
  delivery,
  discount,
  digitalDiscount,
  totalBdt,
  payment,
  deliveryProgress,
  freeDeliveryThreshold,
}: CheckoutOrderSummaryProps) {
  const paymentLabel =
    payment === 'Cash on Delivery' ? 'Cash on delivery' : payment

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
              <div key={`${item.productId}-${item.variantId ?? ''}-${item.size ?? ''}`} className="checkout-item">
                <div className="checkout-item__thumb">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="64px"
                    className="object-contain object-center"
                  />
                </div>
                <div className="checkout-item__meta">
                  <p className="checkout-item__name">{item.name}</p>
                  <p className="checkout-item__detail">{formatVariantDetail(item)}</p>
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
              <div className="checkout-summary-line checkout-summary-line--discount">
                <span>Discount</span>
                <span>- {formatBDT(discount)}</span>
              </div>
            ) : null}
            <div className="checkout-divider" />
            <div className="checkout-summary-line checkout-summary-line--total">
              <span>Total</span>
              <span>{formatBDT(totalBdt)}</span>
            </div>
            <div className="checkout-summary-line checkout-summary-line--payment">
              <span>Payment</span>
              <span>{paymentLabel}</span>
            </div>
          </div>

          {digitalDiscount > 0 && DIGITAL_PAYMENT_DISCOUNT_RATE > 0 ? (
            <p className="checkout-promo">
              {Math.round(DIGITAL_PAYMENT_DISCOUNT_RATE * 100)}% digital payment savings applied
            </p>
          ) : null}

          <p className="checkout-security checkout-security--compact">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.1} />
            <span>Secure checkout · SSL encrypted</span>
          </p>

          <div className="checkout-sidebar-trust checkout-sidebar-trust--compact">
            <div className="checkout-sidebar-trust__card">
              <Truck className="h-3.5 w-3.5" strokeWidth={2} />
              <div>
                <strong>Fast delivery</strong>
                <span>Dispatch with live updates</span>
              </div>
            </div>
            <div className="checkout-sidebar-trust__card">
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
              <div>
                <strong>Easy returns</strong>
                <span>7-day hassle-free returns</span>
              </div>
            </div>
            <div className="checkout-sidebar-trust__card">
              <Headphones className="h-3.5 w-3.5" strokeWidth={2} />
              <div>
                <strong>Support</strong>
                <span>We&apos;re here to help</span>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
