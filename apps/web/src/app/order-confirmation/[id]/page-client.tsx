'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  MapPin,
  Package,
  Printer,
  ReceiptText,
  ShoppingBag,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react'
import { DeliveryMotion } from '@/components/order/DeliveryMotion'
import { formatOrderDate, fetchOrderById, loadOrders, type StoredOrder } from '@/lib/orders'
import { buildInvoiceUrl } from '@/lib/invoice-url'
import { formatBDT } from '@/lib/utils/currency'

interface OrderConfirmationPageClientProps {
  orderId: string
}

/** "CASH_ON_DELIVERY" → "Cash on Delivery" (leaves already-readable values untouched). */
function formatPaymentMethod(value: string): string {
  if (!value.includes('_') && value !== value.toUpperCase()) return value
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => (word === 'on' || word === 'of' ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

export default function OrderConfirmationPageClient({ orderId }: OrderConfirmationPageClientProps) {
  const [order, setOrder] = useState<StoredOrder | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    fetchOrderById(orderId).then((match) => {
      setOrder(
        match ??
          loadOrders().find(
            (item) => item.id === orderId || item.invoiceNumber === orderId,
          ) ??
          null,
      )
      setHydrated(true)
    })
  }, [orderId])

  if (!hydrated) {
    return (
      <main className="checkout-shell checkout-shell--loading">
        <div className="checkout-glass-panel checkout-glass-panel--center">
          <Package className="mx-auto h-8 w-8 text-black/35" strokeWidth={2} />
          <p className="mt-4 text-sm font-black text-black/55">Loading order...</p>
        </div>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="checkout-shell">
        <section className="checkout-container">
          <div className="checkout-success__hero checkout-glass-panel">
            <p className="checkout-eyebrow">Order not found</p>
            <h1 className="checkout-title">We couldn&apos;t find order {orderId}</h1>
            <p className="checkout-subtitle">
              Check your order number or track an existing order from your account.
            </p>
            <div className="checkout-success__actions">
              <Link href="/track-order" className="checkout-btn checkout-btn--primary">
                Track order
              </Link>
              <Link href="/account" className="checkout-btn checkout-btn--ghost">
                My account
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="checkout-shell">
      <section className="checkout-container">
        <div className="checkout-success">
          <div className="checkout-success__hero checkout-glass-panel">
            <span className="checkout-success__halo" aria-hidden="true" />
            <motion.div
              className="checkout-success__icon-wrap"
              initial={reducedMotion ? false : { scale: 0.72, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="checkout-success__icon-ring" aria-hidden="true" />
              <span className="checkout-success__icon-ring checkout-success__icon-ring--outer" aria-hidden="true" />
              <div className="checkout-success__icon">
                <Check className="h-6 w-6" strokeWidth={2.5} />
              </div>
            </motion.div>
            <motion.p
              className="checkout-eyebrow"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.4 }}
            >
              Order confirmed
            </motion.p>
            <motion.h1
              className="checkout-title"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.45 }}
            >
              Thank you, {order.customer.name.split(' ')[0]}!
            </motion.h1>
            <motion.p
              className="checkout-subtitle checkout-success__subtitle"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.45 }}
            >
              We&apos;ll send delivery updates as your products move toward you.
            </motion.p>
            <motion.div
              className="checkout-success__chips"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26, duration: 0.45 }}
            >
              {order.invoiceNumber ? (
                <span className="checkout-success__chip checkout-success__chip--strong">
                  {order.invoiceNumber}
                </span>
              ) : null}
              <span className="checkout-success__chip">{formatOrderDate(order.createdAt)}</span>
              <span className="checkout-success__chip">
                {order.items.reduce((sum, item) => sum + item.quantity, 0)} item
                {order.items.reduce((sum, item) => sum + item.quantity, 0) > 1 ? 's' : ''}
              </span>
            </motion.div>
            <DeliveryMotion />
            <div className="checkout-success__actions">
              <button
                type="button"
                className="checkout-btn checkout-btn--primary"
                onClick={() => window.open(buildInvoiceUrl(order), '_blank')}
              >
                <Printer className="h-4 w-4" />
                Print invoice
              </button>
              <Link href="/track-order" className="checkout-btn checkout-btn--ghost">
                <Truck className="h-4 w-4" />
                Track order
              </Link>
            </div>
          </div>

          <div className="checkout-grid">
            <div className="checkout-glass-panel">
              <h2 className="checkout-panel-title">
                <ShoppingBag className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                Items ordered
                <span className="checkout-panel-title__count">{order.items.length}</span>
              </h2>
              <div className="checkout-items checkout-items--confirmation">
                {order.items.map((item) => (
                  <div key={`${item.productId}-${item.variantId}`} className="checkout-item checkout-item--confirmation">
                    <div className="checkout-item__thumb checkout-item__thumb--lg">
                      <Image src={item.image} alt={item.name} fill sizes="72px" className="object-cover object-center" />
                      <span className="checkout-item__qty-badge">{item.quantity}</span>
                    </div>
                    <div className="checkout-item__meta">
                      <p className="checkout-item__name">{item.name}</p>
                      <p className="checkout-item__detail">
                        {item.size ? `Size ${item.size}` : `Qty ${item.quantity}`}
                        {item.size && item.quantity > 1 ? ` · Qty ${item.quantity}` : ''}
                      </p>
                      <p className="checkout-item__unit">{formatBDT(item.price)} each</p>
                    </div>
                    <p className="checkout-item__price">{formatBDT(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="checkout-glass-panel">
              <h2 className="checkout-panel-title">
                <ReceiptText className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                Order summary
              </h2>

              <div className="checkout-recipient">
                <div className="checkout-recipient__row">
                  <span className="checkout-recipient__icon" aria-hidden="true">
                    <UserRound className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </span>
                  <div>
                    <p className="checkout-recipient__value">{order.customer.name}</p>
                    <p className="checkout-recipient__hint">{order.customer.phone}</p>
                  </div>
                </div>
                <div className="checkout-recipient__row">
                  <span className="checkout-recipient__icon" aria-hidden="true">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </span>
                  <div>
                    <p className="checkout-recipient__value">
                      {order.customer.address}
                    </p>
                    <p className="checkout-recipient__hint">{order.customer.city}</p>
                  </div>
                </div>
                <div className="checkout-recipient__row">
                  <span className="checkout-recipient__icon" aria-hidden="true">
                    <Wallet className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </span>
                  <div>
                    <p className="checkout-recipient__value">{formatPaymentMethod(order.customer.payment)}</p>
                    <p className="checkout-recipient__hint">Payment method</p>
                  </div>
                </div>
              </div>

              <div className="checkout-summary-lines">
                <div className="checkout-summary-line">
                  <span>Subtotal</span>
                  <span>{formatBDT(order.subtotal)}</span>
                </div>
                <div className="checkout-summary-line">
                  <span>Delivery fee</span>
                  <span>{order.delivery === 0 ? 'Free' : formatBDT(order.delivery)}</span>
                </div>
                {order.discount > 0 ? (
                  <div className="checkout-summary-line checkout-summary-line--discount">
                    <span>Discount</span>
                    <span>- {formatBDT(order.discount)}</span>
                  </div>
                ) : null}
              </div>
              <div className="checkout-total-band">
                <span>Total</span>
                <span>{formatBDT(order.total)}</span>
              </div>
            </div>
          </div>

          <Link href="/shop" className="checkout-back-link">
            <ArrowLeft className="h-4 w-4" />
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  )
}
