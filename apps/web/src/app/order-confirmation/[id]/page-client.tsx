'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from '@/lib/motion/react'
import {
  ArrowLeft,
  AlertCircle,
  Check,
  Copy,
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
import {
  formatOrderDate,
  fetchOrderById,
  getDeliveryStage,
  loadOrders,
  saveOrderLocally,
  trackOrder,
  type StoredOrder,
} from '@/lib/orders'
import { resolveConfirmationStage } from '@/lib/order/delivery-progress'
import { buildInvoiceUrl } from '@/lib/invoice-url'
import { displayOrderCode } from '@splaro/config'
import { formatBDT } from '@/lib/utils/currency'
import { checkoutMotionTransition, checkoutTapSpring } from '@/lib/checkout/checkout-motion'
import { copyTextToClipboard } from '@/lib/utils/clipboard'

interface OrderConfirmationPageClientProps {
  orderId: string
}

function formatPaymentMethod(value: string): string {
  if (!value.includes('_') && value !== value.toUpperCase()) return value
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => (word === 'on' || word === 'of' ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

const CONFIRM_EASE = [0.16, 1, 0.3, 1] as const

function confirmCardMotion(index: number, reduced: boolean | null) {
  return reduced
    ? { initial: false as const, animate: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: 0.42 + index * 0.1, duration: 0.42, ease: CONFIRM_EASE },
      }
}

export default function OrderConfirmationPageClient({ orderId }: OrderConfirmationPageClientProps) {
  const searchParams = useSearchParams()
  const paymentPending = searchParams.get('payment') === 'pending'
  const accessKey = searchParams.get('key')?.trim() || undefined
  const [order, setOrder] = useState<StoredOrder | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false

    async function resolveOrder() {
      const fromApi = await fetchOrderById(orderId, accessKey)
      if (cancelled) return
      if (fromApi) {
        setOrder(fromApi)
        saveOrderLocally(fromApi)
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('splaro-last-order-id')
        }
        setHydrated(true)
        return
      }

      const fromCache =
        loadOrders().find(
          (item) => item.id === orderId || item.invoiceNumber === orderId,
        ) ?? null
      if (fromCache) {
        setOrder(fromCache)
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('splaro-last-order-id')
        }
        setHydrated(true)
        return
      }

      if (typeof window !== 'undefined') {
        try {
          const savedCustomer = window.localStorage.getItem('splaro-customer')
          if (savedCustomer) {
            const customer = JSON.parse(savedCustomer) as { phone?: string }
            if (customer.phone?.trim()) {
              const tracked = await trackOrder(orderId, customer.phone.trim())
              if (cancelled) return
              if (tracked) {
                setOrder(tracked)
                saveOrderLocally(tracked)
                if (typeof window !== 'undefined') {
                  window.sessionStorage.removeItem('splaro-last-order-id')
                }
                setHydrated(true)
                return
              }
            }
          }
        } catch {
          // fall through to not-found
        }
      }

      setHydrated(true)
    }

    void resolveOrder()
    return () => {
      cancelled = true
    }
  }, [accessKey, orderId, paymentPending])

  const orderCode = order ? displayOrderCode(order.invoiceNumber, order.id) : orderId
  const deliveryStage = useMemo(() => {
    if (!order) return 'Confirmed' as const
    const raw = getDeliveryStage(order.createdAt, order.tracking?.stage, order.status)
    return resolveConfirmationStage(raw, order.status)
  }, [order])

  const copyOrderCode = async () => {
    if (!orderCode) return
    const ok = await copyTextToClipboard(orderCode)
    setCopyState(ok ? 'copied' : 'failed')
    window.setTimeout(() => setCopyState('idle'), 2000)
  }

  const pressMotion = reducedMotion ? {} : { whileTap: checkoutTapSpring }

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
            <h1 className="checkout-title">
              We couldn&apos;t find{' '}
              {displayOrderCode(orderId, orderId) === 'Order'
                ? 'this order'
                : `order ${displayOrderCode(orderId, orderId)}`}
            </h1>
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

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <main className="checkout-shell">
      <section className="checkout-container">
        {paymentPending ? (
          <div className="checkout-payment-pending" role="status">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
            <div>
              <p className="checkout-payment-pending__title">Payment not completed</p>
              <p className="checkout-payment-pending__copy">
                Your order is saved, but online payment did not finish. Contact SPLARO support with
                order code <strong>{orderCode}</strong> to pay or confirm Cash on Delivery.
              </p>
            </div>
          </div>
        ) : null}

        <div className="checkout-success">
          <div className="checkout-success__hero checkout-glass-panel">
            <span className="checkout-success__halo checkout-success__halo--gold" aria-hidden="true" />
            <motion.div
              className="checkout-success__icon-wrap"
              initial={reducedMotion ? false : { scale: 0.55, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 380, damping: 22, mass: 0.85 }
              }
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
              transition={checkoutMotionTransition(reducedMotion, 0.38)}
            >
              {paymentPending ? 'Order received' : 'Order confirmed'}
            </motion.p>
            <motion.h1
              className="checkout-title"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...checkoutMotionTransition(reducedMotion, 0.42), delay: reducedMotion ? 0 : 0.06 }}
            >
              {paymentPending
                ? `Thanks, ${order.customer.name.split(' ')[0]} — payment pending`
                : `Thank you, ${order.customer.name.split(' ')[0]}!`}
            </motion.h1>
            <motion.p
              className="checkout-subtitle checkout-success__subtitle"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...checkoutMotionTransition(reducedMotion, 0.42), delay: reducedMotion ? 0 : 0.12 }}
            >
              {paymentPending
                ? 'We saved your order. Our team can help you complete payment or switch to Cash on Delivery.'
                : "We'll send delivery updates as your products move toward you."}
            </motion.p>
            <motion.div
              className="checkout-success__chips"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...checkoutMotionTransition(reducedMotion, 0.42), delay: reducedMotion ? 0 : 0.18 }}
            >
              <span className="checkout-success__chip checkout-success__chip--strong checkout-success__chip--shimmer">
                {orderCode}
              </span>
              <button
                type="button"
                className={`checkout-success__copy ${copyState === 'copied' ? 'checkout-success__copy--ok' : ''} ${copyState === 'failed' ? 'checkout-success__copy--fail' : ''}`}
                onClick={copyOrderCode}
                aria-label="Copy order code"
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />
                {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy'}
              </button>
              <span className="checkout-success__chip">{formatOrderDate(order.createdAt)}</span>
              <span className="checkout-success__chip">
                {itemCount} item{itemCount > 1 ? 's' : ''}
              </span>
            </motion.div>
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...checkoutMotionTransition(reducedMotion, 0.42), delay: reducedMotion ? 0 : 0.28 }}
            >
              <DeliveryMotion stage={deliveryStage} />
            </motion.div>
            <div className="checkout-success__actions">
              <motion.button
                type="button"
                className="checkout-btn checkout-btn--primary"
                onClick={() => window.open(buildInvoiceUrl(order), '_blank')}
                {...pressMotion}
                transition={checkoutMotionTransition(reducedMotion, 0.18)}
              >
                <Printer className="h-4 w-4" />
                Print invoice
              </motion.button>
              <motion.div {...pressMotion} transition={checkoutMotionTransition(reducedMotion, 0.18)}>
                <Link href="/track-order" className="checkout-btn checkout-btn--ghost">
                  <Truck className="h-4 w-4" />
                  Track order
                </Link>
              </motion.div>
            </div>
          </div>

          <div className="checkout-grid">
            <motion.div className="checkout-glass-panel" {...confirmCardMotion(0, reducedMotion)}>
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
            </motion.div>

            <motion.div className="checkout-glass-panel" {...confirmCardMotion(1, reducedMotion)}>
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
                    <p className="checkout-recipient__value">{order.customer.address}</p>
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
            </motion.div>
          </div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...checkoutMotionTransition(reducedMotion, 0.38), delay: reducedMotion ? 0 : 0.58 }}
          >
            <Link href="/shop" className="checkout-back-link">
              <ArrowLeft className="h-4 w-4" />
              Continue shopping
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
