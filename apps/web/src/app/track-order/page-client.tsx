'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  Package,
  Phone,
  RotateCcw,
  Shield,
  Truck,
} from 'lucide-react'
import { formatBDT } from '@/lib/utils/currency'
import {
  openOrderInvoice,
  trackOrdersByPhone,
  type StoredOrder,
  type TrackOrdersResult,
} from '@/lib/orders'
import { cn } from '@/lib/utils/cn'
import { isStorefrontPhoneOtpEnabled } from '@/lib/storefront/phone-otp'

const PHONE_OTP_ENABLED = isStorefrontPhoneOtpEnabled()

const TRACK_STAGES = [
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
] as const

function formatPaymentLabel(method: string) {
  const labels: Record<string, string> = {
    CASH_ON_DELIVERY: 'Cash on Delivery',
    BKASH: 'bKash',
    NAGAD: 'Nagad',
    SSLCommerz: 'SSLCommerz',
    SSLCOMMERZ: 'SSLCommerz',
  }
  return labels[method] ?? method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function orderNumber(order: StoredOrder) {
  return order.invoiceNumber ?? order.id
}

function isCancelled(order: StoredOrder) {
  return (order.status ?? '').toLowerCase() === 'cancelled'
}

function isDelivered(order: StoredOrder) {
  return (order.status ?? '').toLowerCase() === 'delivered'
}

function getTrackStageIndex(order: StoredOrder): number {
  if (isCancelled(order)) return -1
  const status = (order.status ?? '').toLowerCase()
  if (status === 'delivered') return 4
  if (status === 'in_transit') return 3
  if (status === 'shipped') return 2
  if (status === 'packed' || status === 'processing') return 1
  const stage = order.tracking?.stage?.toLowerCase() ?? ''
  if (stage.includes('deliver')) return 4
  if (stage.includes('transit') || stage.includes('out')) return 3
  if (stage.includes('ship')) return 2
  if (stage.includes('pack')) return 1
  return 0
}

function getStatusLabel(order: StoredOrder) {
  if (isCancelled(order)) return 'Cancelled'
  const status = (order.status ?? '').toLowerCase()
  if (status === 'delivered') return 'Delivered'
  if (status === 'in_transit') return 'Out for Delivery'
  if (status === 'shipped') return 'Shipped'
  if (status === 'packed') return 'Packed'
  if (status === 'processing') return 'Processing'
  if (status === 'confirmed' || status === 'pending') return 'Confirmed'
  return order.tracking?.stage ?? 'Processing'
}

function formatOrderDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function estimatedDeliveryLabel(order: StoredOrder) {
  if (isDelivered(order)) return `Delivered ${formatOrderDate(order.updatedAt ?? order.createdAt)}`
  if (isCancelled(order)) return 'Order cancelled'
  const eta = new Date(order.createdAt)
  eta.setDate(eta.getDate() + 3)
  return `Est. ${formatOrderDate(eta.toISOString())}`
}

function itemCount(order: StoredOrder) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0)
}

function itemSummary(order: StoredOrder) {
  const names = order.items.map((item) => item.name).filter(Boolean)
  if (!names.length) return 'Items from your order'
  if (names.length === 1) return names[0]
  return `${names[0]} +${names.length - 1} more`
}

function statusTone(order: StoredOrder): 'active' | 'delivered' | 'cancelled' | 'neutral' {
  if (isCancelled(order)) return 'cancelled'
  if (isDelivered(order)) return 'delivered'
  if (!isDelivered(order) && !isCancelled(order)) return 'active'
  return 'neutral'
}

function ProgressTracker({ order }: { order: StoredOrder }) {
  const activeIndex = getTrackStageIndex(order)

  return (
    <div className="track-progress" aria-label="Delivery progress">
      {TRACK_STAGES.map((stage, index) => {
        const done = activeIndex >= 0 && index <= activeIndex
        const current = index === activeIndex

        return (
          <div key={stage} className="track-progress__step">
            <div className="track-progress__rail">
              <span
                className={cn(
                  'track-progress__node',
                  done && 'track-progress__node--done',
                  current && 'track-progress__node--current',
                )}
              >
                {done && !current ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
                {current ? <Truck className="h-3 w-3" strokeWidth={2.25} /> : null}
              </span>
              {index < TRACK_STAGES.length - 1 ? (
                <span
                  className={cn(
                    'track-progress__line',
                    index < activeIndex && 'track-progress__line--done',
                  )}
                />
              ) : null}
            </div>
            <span
              className={cn(
                'track-progress__label',
                current && 'track-progress__label--current',
              )}
            >
              {stage}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function StatusPill({ order }: { order: StoredOrder }) {
  const tone = statusTone(order)
  return (
    <span className={cn('track-status-pill', `track-status-pill--${tone}`)}>
      {getStatusLabel(order)}
    </span>
  )
}

function ThumbnailStack({ order }: { order: StoredOrder }) {
  const thumbs = order.items.slice(0, 3)
  return (
    <div className="track-thumbs" aria-hidden>
      {thumbs.map((item, index) => (
        <div
          key={`${item.productId}-${item.variantId ?? 'base'}-${index}`}
          className="track-thumbs__item"
          style={{ zIndex: thumbs.length - index }}
        >
          {item.image ? (
            <Image
              src={item.image}
              alt=""
              width={44}
              height={44}
              className="track-thumbs__img"
              unoptimized
            />
          ) : (
            <Package className="h-4 w-4 text-[#8b9099]" />
          )}
        </div>
      ))}
    </div>
  )
}

function ActiveOrderCard({ order }: { order: StoredOrder }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <article className="track-active-card">
      <div className="track-active-card__top">
        <div className="track-active-card__intro">
          <span className="track-eyebrow-badge">Active order</span>
          <h2 className="track-active-card__title">Order {orderNumber(order)}</h2>
          <p className="track-active-card__meta">
            {formatOrderDateTime(order.createdAt)}
            <span className="track-dot" />
            {itemCount(order)} {itemCount(order) === 1 ? 'item' : 'items'}
            <span className="track-dot" />
            {formatPaymentLabel(order.customer.payment)}
          </p>
        </div>
        <div className="track-active-card__status-block">
          <StatusPill order={order} />
          <p className="track-active-card__status-copy">
            {getStatusLabel(order) === 'Out for Delivery'
              ? 'Your order is on the way to you.'
              : 'We are preparing your SPLARO order with care.'}
          </p>
          <p className="track-active-card__eta">{estimatedDeliveryLabel(order)}</p>
        </div>
      </div>

      <ProgressTracker order={order} />

      <div className="track-active-card__footer">
        <div className="track-active-card__summary">
          <ThumbnailStack order={order} />
          <div>
            <p className="track-active-card__items">{itemSummary(order)}</p>
            <p className="track-active-card__total">{formatBDT(order.total)}</p>
          </div>
        </div>
        <div className="track-active-card__actions">
          <button
            type="button"
            className="track-btn track-btn--primary"
            onClick={() => setExpanded((value) => !value)}
          >
            Track details
            <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
          </button>
          <button
            type="button"
            className="track-btn track-btn--secondary"
            onClick={() => openOrderInvoice(order)}
          >
            <FileText className="h-4 w-4" />
            View invoice
          </button>
          {order.tracking?.url ? (
            <a
              href={order.tracking.url}
              target="_blank"
              rel="noreferrer"
              className="track-btn track-btn--ghost"
            >
              <Truck className="h-4 w-4" />
              Courier link
            </a>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="track-active-card__details">
          <div className="track-detail-grid">
            <div>
              <p className="track-detail-label">Customer</p>
              <p className="track-detail-value">{order.customer.name}</p>
            </div>
            <div>
              <p className="track-detail-label">Phone</p>
              <p className="track-detail-value">{order.customer.phone}</p>
            </div>
            <div>
              <p className="track-detail-label">Delivery address</p>
              <p className="track-detail-value">
                {order.customer.address}, {order.customer.city}
              </p>
            </div>
            <div>
              <p className="track-detail-label">Payment</p>
              <p className="track-detail-value">{formatPaymentLabel(order.customer.payment)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function HistoryRow({ order }: { order: StoredOrder }) {
  return (
    <article className="track-history-row">
      <div className="track-history-row__main">
        <div className="track-history-row__icon">
          <Package className="h-4 w-4" />
        </div>
        <div className="track-history-row__content">
          <div className="track-history-row__head">
            <div>
              <p className="track-history-row__id">Order {orderNumber(order)}</p>
              <p className="track-history-row__date">{formatOrderDateTime(order.createdAt)}</p>
            </div>
            <StatusPill order={order} />
          </div>
          <div className="track-history-row__body">
            <ThumbnailStack order={order} />
            <div className="track-history-row__copy">
              <p className="track-history-row__items">{itemSummary(order)}</p>
              <p className="track-history-row__meta">
                {itemCount(order)} {itemCount(order) === 1 ? 'item' : 'items'}
                <span className="track-dot" />
                {formatPaymentLabel(order.customer.payment)}
                <span className="track-dot" />
                {estimatedDeliveryLabel(order)}
              </p>
            </div>
            <p className="track-history-row__total">{formatBDT(order.total)}</p>
          </div>
        </div>
      </div>
      <div className="track-history-row__actions">
        <button
          type="button"
          className="track-btn track-btn--ghost track-btn--compact"
          onClick={() => openOrderInvoice(order)}
        >
          View details
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        {!isCancelled(order) ? (
          <Link href="/shop" className="track-btn track-btn--ghost track-btn--compact">
            <RotateCcw className="h-3.5 w-3.5" />
            Reorder
          </Link>
        ) : null}
      </div>
    </article>
  )
}

export default function TrackOrderClient() {
  const searchParams = useSearchParams()
  const [phone, setPhone] = useState('')
  const [orderNumberInput, setOrderNumberInput] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null)
  const [result, setResult] = useState<TrackOrdersResult | null>(null)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runSearch = useCallback(async (nextPhone: string, nextOrder?: string) => {
    const trimmedPhone = nextPhone.trim()
    if (!trimmedPhone) return

    setLoading(true)
    setSearched(true)
    setError(null)

    const payload = await trackOrdersByPhone(trimmedPhone, nextOrder?.trim())
    if (!payload.ok) {
      setResult(null)
      if (payload.requiresOtp && PHONE_OTP_ENABLED) {
        setOtpStep(true)
        setError('Verify your phone with the code we send to view orders.')
      } else {
        setError(payload.error)
      }
    } else if (!payload.data.orders.length) {
      setResult(null)
      setError('No orders found for this phone number. Check the number and try again.')
    } else {
      setOtpStep(false)
      setResult(payload.data)
    }

    setLoading(false)
  }, [])

  const sendOtp = async () => {
    const trimmedPhone = phone.trim()
    if (!trimmedPhone) return
    setOtpSending(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmedPhone }),
      })
      const body = (await res.json()) as { error?: string; devCode?: string }
      if (!res.ok) {
        setError(body.error ?? 'Could not send verification code')
        return
      }
      if (body.devCode) setDevOtpHint(body.devCode)
      setOtpStep(true)
    } catch {
      setError('Could not send verification code')
    } finally {
      setOtpSending(false)
    }
  }

  const verifyOtpAndSearch = async () => {
    const trimmedPhone = phone.trim()
    if (!trimmedPhone || !otpCode.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: trimmedPhone, code: otpCode.trim() }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'Invalid verification code')
        setLoading(false)
        return
      }
      await runSearch(trimmedPhone, orderNumberInput)
    } catch {
      setError('Verification failed')
      setLoading(false)
    }
  }

  useEffect(() => {
    const queryPhone = searchParams.get('phone') ?? ''
    const queryOrder =
      searchParams.get('id') ??
      searchParams.get('order') ??
      searchParams.get('invoice') ??
      ''
    if (queryPhone) setPhone(queryPhone)
    if (queryOrder) setOrderNumberInput(queryOrder)
    if (queryPhone) void runSearch(queryPhone, queryOrder)
  }, [searchParams, runSearch])

  const historyOrders = useMemo(() => {
    if (!result) return []
    if (result.previous.length) return result.previous
    return result.orders.filter((order) => order.id !== result.active?.id)
  }, [result])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (PHONE_OTP_ENABLED && otpStep) {
      void verifyOtpAndSearch()
      return
    }
    void runSearch(phone, orderNumberInput)
  }

  return (
    <main className="track-page">
      <section className="track-shell">
        <div className="track-glass">
          <header className="track-header">
            <p className="track-eyebrow">Track order</p>
            <h1 className="track-title font-serif">Find your SPLARO orders</h1>
            <p className="track-subtitle">
              {PHONE_OTP_ENABLED
                ? 'Enter the phone number used at checkout. We will send a verification code to protect your order history.'
                : 'Enter the phone number used at checkout to view your active and previous orders.'}
            </p>
          </header>

          <form className="track-form" onSubmit={handleSubmit}>
            <label className="track-input">
              <Phone className="track-input__icon" />
              <span className="sr-only">Phone number used at checkout</span>
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number used at checkout"
                disabled={PHONE_OTP_ENABLED && otpStep}
              />
            </label>
            {PHONE_OTP_ENABLED && otpStep ? (
              <label className="track-input">
                <Shield className="track-input__icon" />
                <span className="sr-only">Verification code</span>
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  placeholder="6-digit verification code"
                  maxLength={6}
                />
              </label>
            ) : (
              <label className="track-input">
                <FileText className="track-input__icon" />
                <span className="sr-only">Order number optional</span>
                <input
                  value={orderNumberInput}
                  onChange={(event) => setOrderNumberInput(event.target.value)}
                  placeholder="Order number (optional) e.g. SPL-1001"
                />
              </label>
            )}
            <button type="submit" className="track-btn track-btn--primary track-btn--submit" disabled={loading || otpSending}>
              {loading || otpSending
                ? 'Please wait…'
                : PHONE_OTP_ENABLED && otpStep
                  ? 'Verify & track'
                  : 'Track orders'}
              {!loading && !otpSending ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
            {PHONE_OTP_ENABLED ? (
              otpStep ? (
                <button
                  type="button"
                  className="track-btn track-btn--ghost"
                  onClick={() => void sendOtp()}
                  disabled={otpSending}
                >
                  Resend code
                </button>
              ) : (
                <button
                  type="button"
                  className="track-btn track-btn--ghost"
                  onClick={() => void sendOtp()}
                  disabled={otpSending || !phone.trim()}
                >
                  Send verification code
                </button>
              )
            ) : null}
          </form>

          {PHONE_OTP_ENABLED && devOtpHint ? (
            <p className="track-subtitle text-amber-700">Dev code: {devOtpHint}</p>
          ) : null}

          <p className="track-trust">
            <Shield className="h-4 w-4" />
            {PHONE_OTP_ENABLED
              ? 'Phone verification keeps your order history private.'
              : 'All orders linked to this phone number are available here.'}
          </p>

          {result?.active ? <ActiveOrderCard order={result.active} /> : null}

          {result && historyOrders.length > 0 ? (
            <section className="track-history">
              <div className="track-history__head">
                <div>
                  <p className="track-eyebrow">Previous orders</p>
                  <h2 className="track-history__title">Your saved order history</h2>
                  <p className="track-history__subtitle">
                    Showing all orders linked to {phone.trim() || 'your phone number'}
                  </p>
                </div>
                <p className="track-history__count">{historyOrders.length} saved</p>
              </div>
              <div className="track-history__list">
                {historyOrders.map((order) => (
                  <HistoryRow key={order.id} order={order} />
                ))}
              </div>
            </section>
          ) : null}

          {result && !result.active && result.orders.length > 0 && historyOrders.length === 0 ? (
            <section className="track-history">
              <div className="track-history__head">
                <div>
                  <p className="track-eyebrow">Order history</p>
                  <h2 className="track-history__title">Your saved orders</h2>
                </div>
              </div>
              <div className="track-history__list">
                {result.orders.map((order) => (
                  <HistoryRow key={order.id} order={order} />
                ))}
              </div>
            </section>
          ) : null}

          {searched && !loading && error ? (
            <div className="track-empty">
              <p className="track-empty__title">No orders found</p>
              <p className="track-empty__text">{error}</p>
            </div>
          ) : null}

          <footer className="track-footer">
            <p>
              <Shield className="h-4 w-4" />
              Your data is protected. We never share your information.
            </p>
            <Link href="/contact">Need help? Contact support</Link>
          </footer>
        </div>
      </section>
    </main>
  )
}
