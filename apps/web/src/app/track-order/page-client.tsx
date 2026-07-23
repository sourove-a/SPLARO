'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  Package,
  Phone,
  Shield,
  Truck,
} from 'lucide-react'
import { displayOrderCode } from '@splaro/config'
import { formatBDT } from '@/lib/utils/currency'
import { formatBdPhoneInput, getBdPhoneError } from '@/lib/checkout/phone'
import {
  openOrderInvoice,
  trackOrdersByPhone,
  type StoredOrder,
  type TrackOrdersResult,
} from '@/lib/orders'
import { cn } from '@/lib/utils/cn'
import { useStorefrontAuthConfig } from '@/hooks/useStorefrontAuthConfig'

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
  return displayOrderCode(order.invoiceNumber, order.id)
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
  if (
    status === 'in_transit' ||
    status === 'out_for_delivery' ||
    status === 'picked_up'
  ) {
    return 3
  }
  if (status === 'shipped' || status === 'courier_booked') return 2
  if (status === 'packed' || status === 'processing') return 1
  const stage = order.tracking?.stage?.toLowerCase() ?? ''
  if (stage.includes('deliver') && !stage.includes('out')) return 4
  if (
    stage.includes('transit') ||
    stage.includes('out_for') ||
    stage.includes('picked')
  ) {
    return 3
  }
  if (stage.includes('ship') || stage.includes('courier')) return 2
  if (stage.includes('pack') || stage.includes('process')) return 1
  return 0
}

function getStatusLabel(order: StoredOrder) {
  if (isCancelled(order)) return 'Cancelled'
  const status = (order.status ?? '').toLowerCase()
  if (status === 'delivered') return 'Delivered'
  if (status === 'out_for_delivery') return 'Out for Delivery'
  if (status === 'in_transit' || status === 'picked_up') return 'In Transit'
  if (status === 'shipped' || status === 'courier_booked') return 'Shipped'
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
  const courierEta = order.tracking?.estimatedDelivery
  if (courierEta) {
    const parsed = new Date(courierEta)
    if (!Number.isNaN(parsed.getTime())) return `Est. ${formatOrderDate(parsed.toISOString())}`
  }
  return 'Usually 2–4 days'
}

function itemCount(order: StoredOrder) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0)
}

function itemSummary(order: StoredOrder) {
  const names = order.items.map((item) => item.name).filter(Boolean)
  if (!names.length) return 'Your order'
  if (names.length === 1) return names[0]
  return `${names[0]} +${names.length - 1} more`
}

function statusTone(order: StoredOrder): 'active' | 'delivered' | 'cancelled' | 'neutral' {
  if (isCancelled(order)) return 'cancelled'
  if (isDelivered(order)) return 'delivered'
  return 'active'
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
          <span className="track-eyebrow-badge">Current</span>
          <h2 className="track-active-card__title">{orderNumber(order)}</h2>
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
            className="track-btn track-btn--glass"
            onClick={() => setExpanded((value) => !value)}
          >
            Details
            <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
          </button>
          <button
            type="button"
            className="track-btn track-btn--glass"
            onClick={() => openOrderInvoice(order)}
          >
            <FileText className="h-4 w-4" />
            Invoice
          </button>
          {order.tracking?.url ? (
            <a
              href={order.tracking.url}
              target="_blank"
              rel="noreferrer"
              className="track-btn track-btn--glass"
            >
              <Truck className="h-4 w-4" />
              Courier
            </a>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="track-active-card__details">
          <div className="track-detail-grid">
            <div>
              <p className="track-detail-label">Name</p>
              <p className="track-detail-value">{order.customer.name}</p>
            </div>
            <div>
              <p className="track-detail-label">Phone</p>
              <p className="track-detail-value">{order.customer.phone}</p>
            </div>
            <div>
              <p className="track-detail-label">Address</p>
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
              <p className="track-history-row__id">{orderNumber(order)}</p>
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
          className="track-btn track-btn--glass track-btn--compact"
          onClick={() => openOrderInvoice(order)}
        >
          Invoice
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  )
}

type TrackOrderClientProps = {
  initialPhone?: string
  initialInvoice?: string
  initialKey?: string
}

export default function TrackOrderClient({
  initialPhone = '',
  initialInvoice = '',
  initialKey = '',
}: TrackOrderClientProps) {
  const router = useRouter()
  const { phoneOtpEnabled } = useStorefrontAuthConfig()
  const [phone, setPhone] = useState(() => formatBdPhoneInput(initialPhone))
  const [otpCode, setOtpCode] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null)
  const [result, setResult] = useState<TrackOrdersResult | null>(null)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const didPrefillSearch = useRef(false)
  const didKeyRedirect = useRef(false)

  // Signed email / WhatsApp links: open confirmation instantly (no phone typing).
  useEffect(() => {
    if (didKeyRedirect.current) return
    const invoice = initialInvoice.trim()
    const key = initialKey.trim()
    if (!invoice || !key) return
    didKeyRedirect.current = true
    router.replace(
      `/order-confirmation/${encodeURIComponent(invoice)}?key=${encodeURIComponent(key)}`,
    )
  }, [initialInvoice, initialKey, router])

  const runSearch = useCallback(
    async (nextPhone: string) => {
      const trimmedPhone = nextPhone.trim()
      const phoneError = getBdPhoneError(trimmedPhone)
      if (phoneError) {
        setSearched(true)
        setResult(null)
        setError(phoneError)
        return
      }

      setLoading(true)
      setSearched(true)
      setError(null)

      // Phone-only lookup — returns all orders for this checkout number.
      const payload = await trackOrdersByPhone(trimmedPhone)
      if (!payload.ok) {
        setResult(null)
        if (payload.requiresOtp && phoneOtpEnabled) {
          setOtpStep(true)
          setError('Enter the code sent to your phone.')
        } else {
          setError(payload.error)
        }
      } else if (!payload.data.orders.length) {
        setResult(null)
        setError('No orders found for this phone number.')
      } else {
        setOtpStep(false)
        setResult(payload.data)
      }

      setLoading(false)
    },
    [phoneOtpEnabled],
  )

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
        setError(body.error ?? 'Could not send code')
        return
      }
      if (body.devCode) setDevOtpHint(body.devCode)
      setOtpStep(true)
    } catch {
      setError('Could not send code')
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
        setError(body.error ?? 'Invalid code')
        setLoading(false)
        return
      }
      await runSearch(trimmedPhone)
    } catch {
      setError('Verification failed')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (didPrefillSearch.current) return
    if (!initialPhone.trim()) return
    didPrefillSearch.current = true
    void runSearch(formatBdPhoneInput(initialPhone))
  }, [initialPhone, runSearch])

  const historyOrders = useMemo(() => {
    if (!result) return []
    if (result.previous.length) return result.previous
    return result.orders.filter((order) => order.id !== result.active?.id)
  }, [result])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (phoneOtpEnabled && otpStep) {
      void verifyOtpAndSearch()
      return
    }
    void runSearch(phone)
  }

  const hasResults = Boolean(result?.orders?.length)

  return (
    <main className={cn('track-page', hasResults && 'track-page--filled')}>
      <section className="track-shell">
        <div className="track-shell__glow" aria-hidden />
        <div className="track-glass">
          <header className="track-header track-header--visual">
            <div className="track-mark" aria-hidden>
              <span className="track-mark__ring" />
              <span className="track-mark__soft" />
              <Package className="track-mark__icon" strokeWidth={1.55} />
            </div>
            <h1 className="track-title font-serif">Track</h1>
            <div className="track-route" aria-hidden>
              <span className="track-route__dot track-route__dot--on" />
              <span className="track-route__line" />
              <span className="track-route__dot" />
              <span className="track-route__line" />
              <span className="track-route__dot" />
              <span className="track-route__line" />
              <Truck className="track-route__truck" strokeWidth={1.7} />
            </div>
          </header>

          <form className="track-form track-form--phone-only" onSubmit={handleSubmit}>
            <label className="track-input track-input--phone">
              <Phone className="track-input__icon" aria-hidden />
              <span className="sr-only">Phone number</span>
              <input
                required
                type="tel"
                name="phone"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                onChange={(event) => setPhone(formatBdPhoneInput(event.target.value))}
                placeholder="01XXXXXXXXX"
                aria-label="Phone number"
                disabled={phoneOtpEnabled && otpStep}
              />
            </label>

            {phoneOtpEnabled && otpStep ? (
              <label className="track-input">
                <Shield className="track-input__icon" aria-hidden />
                <span className="sr-only">Verification code</span>
                <input
                  required
                  inputMode="numeric"
                  name="otp"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  aria-label="Verification code"
                  maxLength={6}
                />
              </label>
            ) : null}

            <button
              type="submit"
              className="track-btn track-btn--primary track-btn--submit track-btn--icon"
              disabled={loading || otpSending}
              aria-label={
                loading || otpSending
                  ? 'Searching'
                  : phoneOtpEnabled && otpStep
                    ? 'Verify'
                    : 'Track order'
              }
            >
              {loading || otpSending ? (
                <span className="track-btn__pulse" aria-hidden />
              ) : (
                <ArrowRight className="h-5 w-5" aria-hidden />
              )}
            </button>

            {phoneOtpEnabled ? (
              <button
                type="button"
                className="track-btn track-btn--glass track-btn--otp"
                onClick={() => void sendOtp()}
                disabled={otpSending || !phone.trim()}
              >
                {otpStep ? 'Resend' : 'OTP'}
              </button>
            ) : null}
          </form>

          {phoneOtpEnabled && devOtpHint ? (
            <p className="track-dev-hint">Dev code: {devOtpHint}</p>
          ) : null}

          {result?.active ? (
            <section className="track-section" aria-label="Current order">
              <ActiveOrderCard order={result.active} />
            </section>
          ) : null}

          {result && historyOrders.length > 0 ? (
            <section className="track-history" aria-label="Previous orders">
              <div className="track-history__head">
                <h2 className="track-history__title">Previous</h2>
                <p className="track-history__count">{historyOrders.length}</p>
              </div>
              <div className="track-history__list">
                {historyOrders.map((order) => (
                  <HistoryRow key={order.id} order={order} />
                ))}
              </div>
            </section>
          ) : null}

          {result && !result.active && result.orders.length > 0 && historyOrders.length === 0 ? (
            <section className="track-history" aria-label="Orders">
              <div className="track-history__head">
                <h2 className="track-history__title">Orders</h2>
                <p className="track-history__count">{result.orders.length}</p>
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
              <p className="track-empty__title">{error}</p>
            </div>
          ) : null}

          <footer className="track-footer">
            <Link href="/contact">Need help?</Link>
          </footer>
        </div>
      </section>
    </main>
  )
}
