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
  OrderDispatchCeremony,
  isDispatchPending,
  wasDispatchSeen,
} from '@/components/order/OrderDispatchCeremony'
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
import { displayOrderCode, orderConfirmedDocumentTitle } from '@splaro/config'
import { formatBDT } from '@/lib/utils/currency'
import { checkoutMotionTransition, checkoutTapSpring } from '@/lib/checkout/checkout-motion'
import { displaySizeLabel } from '@splaro/config'
import { copyTextToClipboard } from '@/lib/utils/clipboard'
import { useOrderRealtime } from '@/lib/realtime/useOrderRealtime'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { resolveWhatsAppNumber, whatsAppHref } from '@/lib/storefront/contact'
import { buildOrderConfirmationWhatsAppMessage } from '@/lib/orders/confirmation-whatsapp'

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

function WhatsAppIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export default function OrderConfirmationPageClient({ orderId }: OrderConfirmationPageClientProps) {
  const searchParams = useSearchParams()
  const paymentPending = searchParams.get('payment') === 'pending'
  const accessKey = searchParams.get('key')?.trim() || undefined
  const [order, setOrder] = useState<StoredOrder | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [showDispatch, setShowDispatch] = useState(false)
  const reducedMotion = useReducedMotion()
  const storefrontSettings = useStorefrontSettings()
  const { liveHint } = useOrderRealtime({
    orderId: order?.id || orderId,
    accessKey,
    enabled: Boolean(order),
    onEvent: (event) => {
      setOrder((current) => {
        if (!current) return current
        const status = event.status?.toLowerCase()
        return {
          ...current,
          ...(status ? { status } : {}),
          ...(event.updatedAt ? { updatedAt: event.updatedAt } : {}),
          tracking: {
            ...current.tracking,
            ...(status ? { stage: status } : {}),
            ...(event.updatedAt ? { updatedAt: event.updatedAt } : {}),
          },
        }
      })
    },
    onReconcile: async () => {
      const fresh = await fetchOrderById(orderId, accessKey)
      if (fresh) {
        setOrder(fresh)
        saveOrderLocally(fresh)
      }
    },
  })

  const whatsappUrl = useMemo(() => {
    if (!order) return '#'
    return whatsAppHref(
      resolveWhatsAppNumber(storefrontSettings),
      buildOrderConfirmationWhatsAppMessage(order),
    )
  }, [order, storefrontSettings])

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

      // Prefer live track-by-phone over localStorage — cache is only a short
      // post-checkout handoff, never an authoritative history source.
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
                window.sessionStorage.removeItem('splaro-last-order-id')
                setHydrated(true)
                return
              }
            }
          }
        } catch {
          // fall through to fresh handoff cache
        }
      }

      const fromCache =
        loadOrders().find(
          (item) => item.id === orderId || item.invoiceNumber === orderId,
        ) ?? null
      const cacheAgeMs = fromCache
        ? Date.now() - new Date(fromCache.createdAt).getTime()
        : Number.POSITIVE_INFINITY
      // Only trust the handoff cache for ~30 minutes after place-order.
      if (fromCache && cacheAgeMs >= 0 && cacheAgeMs < 30 * 60 * 1000) {
        setOrder(fromCache)
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('splaro-last-order-id')
        }
        setHydrated(true)
        return
      }

      setHydrated(true)
    }

    void resolveOrder()
    return () => {
      cancelled = true
    }
  }, [accessKey, orderId, paymentPending])

  useEffect(() => {
    if (!hydrated) return
    const brand = 'SPLARO'
    if (!order) {
      document.title = `Order not found | ${brand}`
      return
    }
    document.title = `${orderConfirmedDocumentTitle(order.invoiceNumber || order.id)} | ${brand}`
  }, [hydrated, order])

  useEffect(() => {
    if (!hydrated || !order || paymentPending) {
      setShowDispatch(false)
      return
    }
    const key = order.id || orderId
    // Only celebrate when returning from a fresh checkout / payment handoff.
    const pending = isDispatchPending(key) || isDispatchPending(orderId)
    setShowDispatch(pending && !wasDispatchSeen(key))
  }, [hydrated, order, orderId, paymentPending])

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

  if (order && showDispatch && !paymentPending) {
    return (
      <main className="checkout-shell">
        <section className="checkout-container">
          <OrderDispatchCeremony
            orderId={order.id}
            invoiceNumber={order.invoiceNumber ?? null}
            customerName={order.customer.name}
            onComplete={() => setShowDispatch(false)}
          />
        </section>
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

            {whatsappUrl !== '#' ? (
              <motion.div
                className="checkout-whatsapp-card"
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...checkoutMotionTransition(reducedMotion, 0.42), delay: reducedMotion ? 0 : 0.16 }}
              >
                <div className="checkout-whatsapp-card__info">
                  <p className="checkout-whatsapp-card__title">দ্রুত নিশ্চিত করতে WhatsApp-এ মেসেজ পাঠান</p>
                  <p className="checkout-whatsapp-card__copy">
                    অর্ডারের সকল তথ্য মেসেজে সাজানো রয়েছে। নিচের বাটনে ক্লিক করে WhatsApp-এ Send চাপুন।
                  </p>
                </div>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="checkout-btn checkout-btn--whatsapp"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span>Confirm via WhatsApp</span>
                </a>
              </motion.div>
            ) : null}

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
              {liveHint ? (
                <p className="checkout-subtitle" aria-live="polite">
                  Updated just now
                </p>
              ) : null}
            </motion.div>
            <div className="checkout-success__actions">
              {whatsappUrl !== '#' ? (
                <motion.a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="checkout-btn checkout-btn--whatsapp"
                  {...pressMotion}
                  transition={checkoutMotionTransition(reducedMotion, 0.18)}
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  WhatsApp
                </motion.a>
              ) : null}
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
                {order.items.map((item, index) => (
                  <div key={`${item.productId}-${item.variantId ?? 'base'}-${item.size ?? ''}-${index}`} className="checkout-item checkout-item--confirmation">
                    <div className="checkout-item__thumb checkout-item__thumb--lg">
                      <Image src={item.image} alt={item.name} fill sizes="72px" className="object-cover object-center" />
                      <span className="checkout-item__qty-badge">{item.quantity}</span>
                    </div>
                    <div className="checkout-item__meta">
                      <p className="checkout-item__name">{item.name}</p>
                      <p className="checkout-item__detail">
                        {item.size ? `Size ${displaySizeLabel(item.size)}` : `Qty ${item.quantity}`}
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
