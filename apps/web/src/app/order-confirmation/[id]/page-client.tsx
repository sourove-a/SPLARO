'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Check, Package, Printer, Truck } from 'lucide-react'
import { DeliveryMotion } from '@/components/order/DeliveryMotion'
import { formatOrderDate, fetchOrderById, loadOrders, type StoredOrder } from '@/lib/orders'
import { buildInvoiceUrl } from '@/lib/invoice-url'
import { formatBDT } from '@/lib/utils/currency'

interface OrderConfirmationPageClientProps {
  orderId: string
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
            <motion.div
              className="checkout-success__icon"
              initial={reducedMotion ? false : { scale: 0.72, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <Check className="h-6 w-6" strokeWidth={2.5} />
            </motion.div>
            <motion.p
              className="checkout-eyebrow"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.4 }}
            >
              Order confirmed
            </motion.p>
            {order.invoiceNumber ? (
              <motion.p
                className="checkout-invoice-ref"
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                Invoice {order.invoiceNumber}
              </motion.p>
            ) : null}
            <motion.h1
              className="checkout-title"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.45 }}
            >
              Thank you, {order.customer.name.split(' ')[0]}!
            </motion.h1>
            <motion.p
              className="checkout-subtitle"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.45 }}
            >
              Order <strong>{order.invoiceNumber}</strong> placed on {formatOrderDate(order.createdAt)}. We&apos;ll
              send delivery updates as your products move toward you.
            </motion.p>
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
              <h2 className="checkout-panel-title">Items ordered</h2>
              <div className="checkout-items">
                {order.items.map((item) => (
                  <div key={`${item.productId}-${item.variantId}`} className="checkout-item">
                    <div className="checkout-item__thumb">
                      <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover object-top" />
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
            </div>

            <div className="checkout-glass-panel">
              <h2 className="checkout-panel-title">Order summary</h2>
              <div className="checkout-summary-lines">
                <div className="checkout-summary-line">
                  <span>Customer</span>
                  <span>{order.customer.name}</span>
                </div>
                <div className="checkout-summary-line">
                  <span>Phone</span>
                  <span>{order.customer.phone}</span>
                </div>
                <div className="checkout-summary-line">
                  <span>Delivery</span>
                  <span>
                    {order.customer.address}, {order.customer.city}
                  </span>
                </div>
                <div className="checkout-summary-line">
                  <span>Payment</span>
                  <span>{order.customer.payment}</span>
                </div>
                <div className="checkout-divider" />
                <div className="checkout-summary-line">
                  <span>Subtotal</span>
                  <span>{formatBDT(order.subtotal)}</span>
                </div>
                <div className="checkout-summary-line">
                  <span>Delivery fee</span>
                  <span>{order.delivery === 0 ? 'Free' : formatBDT(order.delivery)}</span>
                </div>
                {order.discount > 0 ? (
                  <div className="checkout-summary-line">
                    <span>Discount</span>
                    <span>- {formatBDT(order.discount)}</span>
                  </div>
                ) : null}
                <div className="checkout-divider" />
                <div className="checkout-summary-line checkout-summary-line--total">
                  <span>Total</span>
                  <span>{formatBDT(order.total)}</span>
                </div>
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
