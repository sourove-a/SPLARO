'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import {
  Building2,
  AlertCircle,
  FileText,
  Lock,
  MapPin,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { type CartItem, useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import {
  buildPaymentOptions,
  DEFAULT_PAYMENT_VISIBILITY,
  effectivePaymentVisibility,
  isDigitalPayment,
  isPaymentAvailable,
} from '@/lib/checkout/payments'
import {
  getCheckoutFormDefaults,
  loadCheckoutCustomerDraft,
} from '@/lib/checkout/customer-draft'
import { BD_DISTRICTS } from '@/lib/checkout/bd-districts'
import { getThanasForDistrict } from '@/lib/checkout/bd-thanas'
import {
  checkoutFormSchema,
  type CheckoutFormValues,
} from '@/lib/checkout/checkout-schema'
import { formatBdPhoneInput, isValidBdMobile, normalizeBdPhone } from '@/lib/checkout/phone'
import { clearStagedCheckoutItems, consumeStagedCheckoutItems } from '@/lib/cart/checkout-intent'
import { saveOrderLocally, type StoredOrder } from '@/lib/orders'
import { buildOrderConfirmationPath } from '@/lib/invoice-url'
import {
  DIGITAL_PAYMENT_DISCOUNT_RATE,
} from '@/lib/utils/currency'
import { computeDeliveryFeeBdt } from '@/lib/checkout/shipping'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { useClientMounted } from '@/hooks/useClientMounted'
import { attributionForOrder, getStoredAttribution } from '@/lib/analytics/attribution'
import { notifyOrderPaymentEvent } from '@/lib/api/order-events'
import { fetchAccountProfile } from '@/lib/api/account'
import { startBkashCheckout, startNagadCheckout, startSslCommerzCheckout } from '@/lib/api/payments'
import {
  trackInitiateCheckout,
  trackPurchase,
  trackSelectPayment,
} from '@/lib/analytics/meta-pixel'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'
import {
  CheckoutField,
  CheckoutHeader,
  CheckoutMobileBar,
  CheckoutOrderSummary,
  CheckoutPaymentCard,
  CheckoutPhoneInput,
  CheckoutSection,
  CheckoutShell,
  CheckoutSteps,
  CheckoutSubmitPanel,
} from '@/components/checkout'
import {
  deliveryFieldProgress,
  getCheckoutProgressLine,
  getCheckoutStepStatuses,
  getCheckoutSteps,
  isDeliveryComplete,
} from '@/lib/checkout/checkout-validation'
import { fetchPromoAvailability } from '@/lib/checkout/promo-availability'
import {
  OrderDispatchCeremony,
  markDispatchPending,
} from '@/components/order/OrderDispatchCeremony'

function buildDeliveryAddress(address: string, thana: string, city: string): string {
  const street = address.trim()
  const parts = [street, thana.trim(), city.trim()].filter(Boolean)
  return parts.join(', ')
}

function withPendingPayment(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}payment=pending`
}

type DispatchCeremonyState = {
  orderId: string
  invoiceNumber?: string | null
  customerName: string
  href: string
}

const ORDER_LOCK_KEY = 'splaro-last-order-id'
const ORDER_LOCK_TTL_MS = 60_000
const CHECKOUT_IDEMPOTENCY_KEY = 'splaro-checkout-idempotency'

function getCheckoutIdempotencyKey(): string {
  const existing = window.sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_KEY)?.trim()
  if (existing) return existing
  const key =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.sessionStorage.setItem(CHECKOUT_IDEMPOTENCY_KEY, key)
  return key
}

function clearCheckoutIdempotencyKey() {
  window.sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_KEY)
}

/** Clear bag + mark pending so confirmation can play the ceremony after gateway return. */
function redirectToPaymentGateway(orderId: string, gatewayUrl: string, clearCart: () => void) {
  clearStagedCheckoutItems()
  clearCart()
  clearCheckoutIdempotencyKey()
  markDispatchPending(orderId)
  window.location.href = gatewayUrl
}

function readRecentOrderLock(): { id: string; ts: number } | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(ORDER_LOCK_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { id?: string; ts?: number }
    if (parsed?.id && typeof parsed.ts === 'number') {
      return { id: parsed.id, ts: parsed.ts }
    }
  } catch {
    const legacy = raw.trim()
    if (legacy) return { id: legacy, ts: 0 }
  }
  return null
}

function setRecentOrderLock(id: string) {
  window.sessionStorage.setItem(ORDER_LOCK_KEY, JSON.stringify({ id, ts: Date.now() }))
}

function clearRecentOrderLock() {
  window.sessionStorage.removeItem(ORDER_LOCK_KEY)
}

function isRecentOrderLockActive(): boolean {
  const lock = readRecentOrderLock()
  if (!lock) return false
  if (Date.now() - lock.ts > ORDER_LOCK_TTL_MS) {
    clearRecentOrderLock()
    return false
  }
  return true
}

export default function CheckoutPageClient() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const authHydrated = useAuthStore((state) => state._hydrated)
  const storefrontSettings = useStorefrontSettings()
  const paymentSettings = effectivePaymentVisibility(
    storefrontSettings.payments ?? DEFAULT_PAYMENT_VISIBILITY,
  )
  const { items, subtotal, clearCart, replaceItems } = useCartStore()
  const cartHydrated = useCartStore((state) => state._hydrated)
  const { shipping } = storefrontSettings
  const clientReady = useClientMounted()
  const freeDeliveryThreshold = shipping.freeDeliveryThreshold

  const paymentOptions = useMemo(
    () => buildPaymentOptions(paymentSettings),
    [paymentSettings],
  )

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    trigger,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: getCheckoutFormDefaults(),
    mode: 'onTouched',
  })

  const [name, email, phone, address, city, thana, payment] = watch([
    'name',
    'email',
    'phone',
    'address',
    'city',
    'thana',
    'payment',
  ])

  const [paymentEngaged, setPaymentEngaged] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponMessage, setCouponMessage] = useState('')
  const [freeShipping, setFreeShipping] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [hasActivePromo, setHasActivePromo] = useState(false)
  const [promoChecked, setPromoChecked] = useState(false)
  const [couponApplying, setCouponApplying] = useState(false)
  const [couponApplied, setCouponApplied] = useState(false)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)
  const [dispatchCeremony, setDispatchCeremony] = useState<DispatchCeremonyState | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const deliveryFields = useMemo(
    () => ({ name, email, phone, address, city, thana }),
    [name, email, phone, address, city, thana],
  )

  const deliveryComplete = useMemo(
    () => isDeliveryComplete(deliveryFields),
    [deliveryFields],
  )
  const showPromoStep = promoChecked && hasActivePromo
  const checkoutSteps = useMemo(() => getCheckoutSteps(showPromoStep), [showPromoStep])
  const stepStatuses = useMemo(
    () => getCheckoutStepStatuses(deliveryComplete, paymentEngaged, submitting, showPromoStep),
    [deliveryComplete, paymentEngaged, submitting, showPromoStep],
  )
  const progressPercent = useMemo(
    () => getCheckoutProgressLine(deliveryComplete, deliveryFieldProgress(deliveryFields), showPromoStep),
    [deliveryComplete, deliveryFields, showPromoStep],
  )

  const thanaOptions = useMemo(() => getThanasForDistrict(city), [city])

  const clearSubmitError = () => {
    if (submitError) setSubmitError('')
  }

  useEffect(() => {
    if (!cartHydrated || items.length > 0 || dispatchCeremony) return
    const staged = consumeStagedCheckoutItems()
    if (staged?.length) {
      replaceItems(staged)
      return
    }
    if (typeof window !== 'undefined') {
      const pending = readRecentOrderLock()
      if (pending) {
        setPendingOrderId(pending.id)
        return
      }
    }
    safeClientNavigate(router, '/cart', 'replace')
  }, [cartHydrated, dispatchCeremony, items.length, replaceItems, router])

  useEffect(() => {
    // Defer promo probe — place-order path does not need it; keep first paint free.
    let cancelled = false
    const run = () => {
      if (cancelled) return
      fetchPromoAvailability()
        .then(({ hasActivePromo: active }) => {
          if (!cancelled) setHasActivePromo(active)
        })
        .catch(() => {
          if (!cancelled) setHasActivePromo(false)
        })
        .finally(() => {
          if (!cancelled) setPromoChecked(true)
        })
    }
    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleId = idleWindow.requestIdleCallback(run, { timeout: 2500 })
    } else {
      timer = setTimeout(run, 400)
    }
    return () => {
      cancelled = true
      if (idleId != null) idleWindow.cancelIdleCallback?.(idleId)
      if (timer != null) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (showPromoStep) return
    setCouponCode('')
    setCouponDiscount(0)
    setCouponMessage('')
    setFreeShipping(false)
    setCouponApplied(false)
  }, [showPromoStep])

  const delivery = computeDeliveryFeeBdt(subtotal, city, shipping, {
    freeShipping,
  })
  const digitalDiscount = isDigitalPayment(payment)
    ? Math.round(subtotal * DIGITAL_PAYMENT_DISCOUNT_RATE)
    : 0
  const discount = digitalDiscount + couponDiscount
  const totalBdt = Math.max(0, Math.round(subtotal + delivery - discount))

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  )
  const analyticsItems = useMemo(
    () =>
      items.map((item) => ({
        id: item.variantId ?? item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        ...(item.size || item.color
          ? { variant: [item.size, item.color].filter(Boolean).join(' / ') }
          : {}),
      })),
    [items],
  )

  useEffect(() => {
    if (items.length === 0) return
    trackInitiateCheckout({ value: totalBdt, numItems: itemCount, items: analyticsItems })
  }, [items.length, totalBdt, itemCount, analyticsItems])

  useEffect(() => {
    reset({ ...getCheckoutFormDefaults(), ...loadCheckoutCustomerDraft() })
  }, [reset])

  useEffect(() => {
    if (!authHydrated || !user) return

    let cancelled = false

    void (async () => {
      try {
        const data = await fetchAccountProfile()
        if (cancelled) return

        const draft = loadCheckoutCustomerDraft()
        const apiAddress = data.address

        reset((current) => ({
          ...current,
          name: user.name || current.name,
          email: user.email || current.email,
          phone: user.phone ? formatBdPhoneInput(user.phone) : current.phone,
          ...(apiAddress
            ? {
                address: apiAddress.address,
                city: apiAddress.district,
                thana: apiAddress.thana,
              }
            : {
                address: draft.address || current.address,
                city: draft.city || current.city,
                thana: draft.thana || current.thana,
              }),
        }))

        if (apiAddress) {
          window.localStorage.setItem(
            'splaro-customer',
            JSON.stringify({
              name: user.name,
              email: user.email,
              phone: user.phone,
              address: apiAddress.address,
              city: apiAddress.district,
              district: apiAddress.district,
              thana: apiAddress.thana,
            }),
          )
        }
      } catch {
        if (cancelled) return
        reset((current) => ({
          ...current,
          name: user.name || current.name,
          email: user.email || current.email,
          phone: user.phone ? formatBdPhoneInput(user.phone) : current.phone,
        }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authHydrated, user, reset])

  const isGuest = authHydrated && !user

  useEffect(() => {
    const guestDigital = isGuest && isDigitalPayment(payment)
    if (!guestDigital && isPaymentAvailable(payment, paymentSettings)) return
    const fallback =
      paymentOptions.find(
        (option) =>
          isPaymentAvailable(option.id, paymentSettings) &&
          !(isGuest && isDigitalPayment(option.id)),
      )?.id ?? 'Cash on Delivery'
    setValue('payment', fallback)
  }, [payment, paymentSettings, paymentOptions, setValue, isGuest])

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponApplying(true)
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), subtotal }),
      })
      const payload = (await response.json()) as {
        valid?: boolean
        discount?: number
        freeShipping?: boolean
        message?: string
      }

      if (!response.ok || !payload.valid) {
        setCouponDiscount(0)
        setFreeShipping(false)
        setCouponApplied(false)
        setCouponMessage(
          payload.message ??
            (response.status === 503
              ? 'Coupon service unavailable — continue without a code.'
              : 'Invalid or expired coupon code'),
        )
        return
      }

      setCouponDiscount(payload.discount ?? 0)
      setFreeShipping(Boolean(payload.freeShipping))
      setCouponApplied(true)
      setCouponMessage(payload.message ?? 'Coupon applied')
    } catch {
      setCouponDiscount(0)
      setFreeShipping(false)
      setCouponApplied(false)
      setCouponMessage('Coupon service unavailable — continue without a code.')
    } finally {
      setCouponApplying(false)
    }
  }

  const deliveryProgress =
    freeDeliveryThreshold > 0 && subtotal > 0 && delivery > 0
      ? Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100))
      : null

  const scrollToFirstInvalidField = () => {
    const formEl = formRef.current
    if (!formEl) return
    const scrollBehavior: ScrollBehavior =
      document.documentElement.getAttribute('data-os') === 'windows' ? 'auto' : 'smooth'

    const phoneField = formEl.querySelector<HTMLElement>('[data-checkout-field="phone"]')
    if (errors.phone && phoneField) {
      phoneField.scrollIntoView({ behavior: scrollBehavior, block: 'center' })
      phoneField.querySelector<HTMLElement>('input')?.focus({ preventScroll: true })
      return
    }

    const firstInvalid = formEl.querySelector<HTMLElement>(
      '[data-checkout-field][data-invalid="true"], input:invalid, select:invalid, textarea:invalid',
    )
    firstInvalid?.scrollIntoView({ behavior: scrollBehavior, block: 'center' })
    const focusable = firstInvalid?.querySelector<HTMLElement>('input, select, textarea')
    if (focusable) {
      focusable.focus({ preventScroll: true })
    } else {
      firstInvalid?.focus({ preventScroll: true })
    }
  }

  const onInvalid = () => {
    setSubmitError('Please complete all required fields.')
    requestAnimationFrame(() => scrollToFirstInvalidField())
  }

  const placeOrder = async (form: CheckoutFormValues) => {
    if (submitting || items.length === 0) return

    if (typeof window !== 'undefined' && isRecentOrderLockActive()) {
      const lock = readRecentOrderLock()
      setSubmitError(
        `Please wait a moment before placing another order${lock?.id ? ` (order ${lock.id})` : ''}.`,
      )
      return
    }

    const normalizedPhone = normalizeBdPhone(form.phone)
    const deliveryAddress = buildDeliveryAddress(form.address, form.thana, form.city)

    setSubmitting(true)
    setSubmitError('')

    const orderItems: CartItem[] = items.map((item) => {
      const next: CartItem = {
        productId: item.productId,
        quantity: item.quantity,
        name: item.name,
        price: item.price,
        image: item.image,
        slug: item.slug,
      }
      if (item.variantId) next.variantId = item.variantId
      if (item.size) next.size = item.size
      if (item.color) next.color = item.color
      return next
    })

    try {
      const orderAttribution = attributionForOrder(getStoredAttribution())
      const idempotencyKey = getCheckoutIdempotencyKey()
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          idempotencyKey,
          items: orderItems,
          customer: {
            name: form.name,
            email: form.email.trim(),
            phone: normalizedPhone,
            address: deliveryAddress,
            city: form.city,
          },
          payment: form.payment,
          couponCode: couponApplied && couponCode.trim() ? couponCode.trim() : undefined,
          subtotal,
          delivery,
          discount,
          total: totalBdt,
          ...(orderAttribution ? { attribution: orderAttribution } : {}),
        }),
      })

      const payload = (await response.json()) as {
        order?: StoredOrder & { payment?: { method: string }; invoiceNumber?: string }
        error?: string
      }

      if (!response.ok || !payload.order) {
        setSubmitError(payload.error ?? 'Unable to place order')
        return
      }

      const saved: StoredOrder = {
        id: payload.order.id,
        ...(payload.order.invoiceNumber ? { invoiceNumber: payload.order.invoiceNumber } : {}),
        ...(payload.order.invoiceAccessKey
          ? { invoiceAccessKey: payload.order.invoiceAccessKey }
          : {}),
        createdAt: payload.order.createdAt,
        customer: {
          ...form,
          payment: payload.order.payment?.method ?? form.payment,
        },
        items: orderItems,
        subtotal,
        delivery,
        discount,
        total: totalBdt,
        ...(payload.order.tracking ? { tracking: payload.order.tracking } : {}),
      }

      saveOrderLocally(saved)
      if (form.payment === 'Cash on Delivery') {
        trackPurchase({
          transactionId: saved.invoiceNumber ?? saved.id,
          verified: true,
          value: totalBdt,
          numItems: itemCount,
          shipping: delivery,
          items: analyticsItems,
          ...(couponApplied && couponCode.trim() ? { coupon: couponCode.trim() } : {}),
        })
      }
      window.localStorage.setItem(
        'splaro-customer',
        JSON.stringify({
          name: form.name,
          email: form.email,
          phone: normalizedPhone,
          address: form.address,
          city: form.city,
          thana: form.thana,
        }),
      )

      if (form.payment === 'SSLCommerz') {
        if (!saved.invoiceNumber) {
          setSubmitError('Order invoice missing — cannot start SSLCommerz. Retry or contact support.')
          return
        }
        if (saved.invoiceNumber) {
          void notifyOrderPaymentEvent({
            invoiceNumber: saved.invoiceNumber,
            status: 'started',
            gateway: 'SSLCommerz',
          })
        }
        try {
          const ssl = await startSslCommerzCheckout({
            invoiceNumber: saved.invoiceNumber,
            amount: totalBdt,
            customer: {
              name: form.name,
              email: form.email,
              phone: normalizedPhone,
              address: deliveryAddress,
              city: form.city,
            },
          })
          redirectToPaymentGateway(saved.id, ssl.gatewayUrl, clearCart)
          return
        } catch {
          if (saved.invoiceNumber) {
            void notifyOrderPaymentEvent({
              invoiceNumber: saved.invoiceNumber,
              status: 'failed',
              gateway: 'SSLCommerz',
            })
          }
          setRecentOrderLock(saved.id)
          safeClientNavigate(router, withPendingPayment(buildOrderConfirmationPath(saved)), 'replace')
          return
        }
      }

      if (form.payment === 'bKash' || form.payment === 'Nagad') {
        if (!saved.invoiceNumber) {
          setSubmitError(
            `Order invoice missing — cannot start ${form.payment}. Retry or contact support.`,
          )
          return
        }
        if (saved.invoiceNumber) {
          void notifyOrderPaymentEvent({
            invoiceNumber: saved.invoiceNumber,
            status: 'started',
            gateway: form.payment,
          })
        }
        try {
          const redirectUrl =
            form.payment === 'bKash'
              ? (
                  await startBkashCheckout({
                    invoiceNumber: saved.invoiceNumber!,
                    amount: totalBdt,
                  })
                ).redirectUrl
              : (
                  await startNagadCheckout({
                    invoiceNumber: saved.invoiceNumber!,
                    amount: totalBdt,
                  })
                ).redirectUrl
          redirectToPaymentGateway(saved.id, redirectUrl, clearCart)
          return
        } catch {
          if (saved.invoiceNumber) {
            void notifyOrderPaymentEvent({
              invoiceNumber: saved.invoiceNumber,
              status: 'failed',
              gateway: form.payment,
            })
          }
          setRecentOrderLock(saved.id)
          safeClientNavigate(router, withPendingPayment(buildOrderConfirmationPath(saved)), 'replace')
          return
        }
      }

      if (typeof window !== 'undefined') {
        clearRecentOrderLock()
      }

      const confirmHref = buildOrderConfirmationPath(saved)
      setDispatchCeremony({
        orderId: saved.id,
        invoiceNumber: saved.invoiceNumber ?? null,
        customerName: form.name,
        href: confirmHref,
      })
      clearStagedCheckoutItems()
      clearCart()
      clearCheckoutIdempotencyKey()
      return
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!dispatchCeremony?.href) return
    router.prefetch(dispatchCeremony.href)
  }, [dispatchCeremony, router])

  return (
    <CheckoutShell>
      {dispatchCeremony ? (
        <section className="checkout-container">
          <OrderDispatchCeremony
            orderId={dispatchCeremony.orderId}
            invoiceNumber={dispatchCeremony.invoiceNumber}
            customerName={dispatchCeremony.customerName}
            onComplete={() => {
              const { href } = dispatchCeremony
              setDispatchCeremony(null)
              safeClientNavigate(router, href, 'replace')
            }}
          />
        </section>
      ) : !cartHydrated ? (
        <section className="checkout-container">
          <div className="checkout-glass-panel checkout-glass-panel--center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-black/35" strokeWidth={2} />
            <p className="mt-4 text-sm font-black text-black/55">Loading your bag…</p>
          </div>
        </section>
      ) : items.length === 0 && pendingOrderId ? (
        <section className="checkout-container">
          <div className="checkout-glass-panel checkout-glass-panel--center max-w-lg mx-auto text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-amber-600" strokeWidth={2} />
            <h1 className="checkout-title mt-4">Complete your pending payment</h1>
            <p className="checkout-subtitle mt-2">
              Your last order is saved but payment did not finish. Open your confirmation page to
              pay or contact SPLARO support.
            </p>
            <div className="checkout-success__actions mt-6 justify-center">
              <Link
                href={`/order-confirmation/${pendingOrderId}?payment=pending`}
                className="checkout-btn checkout-btn--primary"
              >
                View pending order
              </Link>
              <button
                type="button"
                className="checkout-btn checkout-btn--ghost"
                onClick={() => {
                  clearRecentOrderLock()
                  clearCheckoutIdempotencyKey()
                  setPendingOrderId(null)
                  safeClientNavigate(router, '/shop', 'replace')
                }}
              >
                Start a new order
              </button>
            </div>
          </div>
        </section>
      ) : items.length === 0 ? (
        <section className="checkout-container">
          <div className="checkout-glass-panel checkout-glass-panel--center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-black/35" strokeWidth={2} />
            <p className="mt-4 text-sm font-black text-black/55">Redirecting to your bag…</p>
          </div>
        </section>
      ) : (
      <>
      <section className="checkout-container">
        <CheckoutHeader
          isSignedIn={authHydrated && !!user}
          userName={user?.name}
        />

        <CheckoutSteps
          stepStatuses={stepStatuses}
          progressPercent={progressPercent}
          steps={checkoutSteps}
        />

        <div className="checkout-layout">
          <form
            ref={formRef}
            id="checkout-main-form"
            onSubmit={handleSubmit(placeOrder, onInvalid)}
            className="checkout-form checkout-glass-panel"
            noValidate
          >
            <CheckoutSection className="checkout-section checkout-section-card" delay={0.14}>
              <div className="checkout-section__head">
                <span className="checkout-section__badge">1</span>
                <div className="checkout-section__titles">
                  <h2>Delivery details</h2>
                  <p className="checkout-section__sub">Where should we send this?</p>
                </div>
              </div>
              <div className="checkout-fields">
                <CheckoutField
                  label="Full name"
                  icon={UserRound}
                  clientReady={clientReady}
                  filled={Boolean(name.trim()) && !errors.name}
                  fieldId="checkout-name"
                  {...(errors.name?.message ? { error: errors.name.message } : {})}
                >
                  <input
                    id="checkout-name"
                    {...register('name', {
                      onChange: clearSubmitError,
                      onBlur: () => {
                        if (name.trim()) void trigger('name')
                      },
                    })}
                    data-checkout-field="name"
                    data-invalid={errors.name ? 'true' : undefined}
                    className={`checkout-input ${errors.name ? 'checkout-input--invalid' : ''}`}
                    placeholder="Your full name"
                    autoComplete="name"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? 'checkout-name-error' : undefined}
                  />
                </CheckoutField>
                <CheckoutField
                  label="Email (optional)"
                  icon={Mail}
                  clientReady={clientReady}
                  filled={Boolean(email.trim()) && !errors.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
                  fieldId="checkout-email"
                  {...(errors.email?.message ? { error: errors.email.message } : {})}
                >
                  <input
                    id="checkout-email"
                    type="email"
                    {...register('email', {
                      onChange: clearSubmitError,
                      onBlur: () => {
                        if (email.trim()) void trigger('email')
                      },
                    })}
                    data-checkout-field="email"
                    data-invalid={errors.email ? 'true' : undefined}
                    className={`checkout-input ${errors.email ? 'checkout-input--invalid' : ''}`}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'checkout-email-error' : undefined}
                  />
                </CheckoutField>
                <CheckoutField
                  label="Phone number"
                  icon={Phone}
                  clientReady={clientReady}
                  filled={isValidBdMobile(phone) && !errors.phone}
                  fieldId="checkout-phone"
                  {...(errors.phone?.message ? { error: errors.phone.message } : {})}
                >
                  <div data-checkout-field="phone" data-invalid={errors.phone ? 'true' : undefined}>
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field }) => (
                        <CheckoutPhoneInput
                          id="checkout-phone"
                          value={field.value}
                          invalid={Boolean(errors.phone)}
                          {...(errors.phone
                            ? { describedBy: 'checkout-phone-error' }
                            : {})}
                          clientReady={clientReady}
                          onChange={(nextPhone) => {
                            field.onChange(nextPhone)
                            clearSubmitError()
                          }}
                          onBlur={() => {
                            field.onBlur()
                            if (field.value) void trigger('phone')
                          }}
                        />
                      )}
                    />
                  </div>
                </CheckoutField>
                <div className="checkout-fields checkout-fields--pair">
                  <CheckoutField
                    label="District"
                    icon={Building2}
                    clientReady={clientReady}
                    filled={Boolean(city) && !errors.city}
                    fieldId="checkout-city"
                    {...(errors.city?.message ? { error: errors.city.message } : {})}
                  >
                    <select
                      id="checkout-city"
                      {...register('city', {
                        onChange: () => {
                          setValue('thana', '', { shouldValidate: true })
                          clearSubmitError()
                        },
                      })}
                      data-checkout-field="city"
                      data-invalid={errors.city ? 'true' : undefined}
                      className={`checkout-input checkout-input--select ${errors.city ? 'checkout-input--invalid' : ''}`}
                      autoComplete="address-level2"
                      aria-invalid={Boolean(errors.city)}
                      aria-describedby={errors.city ? 'checkout-city-error' : undefined}
                    >
                      <option value="">Select district</option>
                      {BD_DISTRICTS.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  </CheckoutField>
                  <CheckoutField
                    label="Thana / Upazila"
                    icon={Building2}
                    clientReady={clientReady}
                    filled={Boolean(thana) && !errors.thana}
                    fieldId="checkout-thana"
                    {...(errors.thana?.message ? { error: errors.thana.message } : {})}
                  >
                    <select
                      id="checkout-thana"
                      {...register('thana', { onChange: clearSubmitError })}
                      data-checkout-field="thana"
                      data-invalid={errors.thana ? 'true' : undefined}
                      className={`checkout-input checkout-input--select ${errors.thana ? 'checkout-input--invalid' : ''}`}
                      autoComplete="address-level3"
                      disabled={!city}
                      aria-invalid={Boolean(errors.thana)}
                      aria-describedby={errors.thana ? 'checkout-thana-error' : undefined}
                    >
                      <option value="">
                        {city ? 'Select thana' : 'Select district first'}
                      </option>
                      {thanaOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </CheckoutField>
                </div>
                <CheckoutField
                  label="Delivery address"
                  icon={MapPin}
                  full
                  clientReady={clientReady}
                  filled={Boolean(address.trim()) && !errors.address}
                  fieldId="checkout-address"
                  {...(errors.address?.message ? { error: errors.address.message } : {})}
                >
                  <textarea
                    id="checkout-address"
                    {...register('address', { onChange: clearSubmitError })}
                    data-checkout-field="address"
                    data-invalid={errors.address ? 'true' : undefined}
                    className={`checkout-input checkout-input--area ${errors.address ? 'checkout-input--invalid' : ''}`}
                    placeholder="House, road, area"
                    autoComplete="street-address"
                    aria-invalid={Boolean(errors.address)}
                    aria-describedby={errors.address ? 'checkout-address-error' : undefined}
                  />
                </CheckoutField>
              </div>
            </CheckoutSection>

            {showPromoStep ? (
              <CheckoutSection className="checkout-section checkout-section-card" delay={0.26}>
                <div className="checkout-section__head">
                  <span className="checkout-section__badge">2</span>
                  <div className="checkout-section__titles">
                    <h2>Promo code</h2>
                    <p className="checkout-section__sub">Optional — apply if you have one</p>
                  </div>
                </div>
                <div className="checkout-coupon">
                  <div className="checkout-coupon__field">
                    <span className="checkout-coupon__icon" aria-hidden>
                      <FileText className="checkout-coupon__glyph" strokeWidth={2.15} />
                    </span>
                    <input
                      value={couponCode}
                      onChange={(event) => {
                        setCouponCode(event.target.value.toUpperCase())
                        setCouponApplied(false)
                        setCouponDiscount(0)
                        setFreeShipping(false)
                        if (couponMessage) setCouponMessage('')
                      }}
                      className="checkout-input checkout-input--coupon"
                      placeholder="Enter promo code"
                      disabled={couponApplying}
                      aria-label="Promo code"
                    />
                  </div>
                  <button
                    type="button"
                    className="checkout-btn checkout-btn--ghost checkout-btn--coupon"
                    onClick={applyCoupon}
                    disabled={couponApplying || !couponCode.trim()}
                  >
                    {couponApplying ? 'Applying…' : 'Apply'}
                  </button>
                </div>
                {couponMessage ? (
                  <p
                    className={`checkout-coupon-message ${couponApplied ? 'checkout-coupon-message--success' : 'checkout-coupon-message--error'}`}
                    role="status"
                  >
                    {couponMessage}
                  </p>
                ) : null}
              </CheckoutSection>
            ) : null}

            <CheckoutSection className="checkout-section checkout-section-card" delay={0.38}>
              <div className="checkout-section__head">
                <span className="checkout-section__badge">{showPromoStep ? '3' : '2'}</span>
                <div className="checkout-section__titles">
                  <h2>Payment method</h2>
                  <p className="checkout-section__sub">Choose how you&apos;d like to pay</p>
                </div>
              </div>
              <div className="checkout-payments">
                {paymentOptions.map((option) => {
                  const available = isPaymentAvailable(option.id, paymentSettings)
                  const needsSignIn = isGuest && isDigitalPayment(option.id)
                  const disabledReason = !available
                    ? 'Not available — contact support to enable'
                    : needsSignIn
                      ? 'Sign in to pay online — Cash on Delivery works without an account'
                      : undefined
                  return (
                    <CheckoutPaymentCard
                      key={option.id}
                      option={option}
                      selected={payment}
                      disabled={!available || needsSignIn}
                      {...(disabledReason ? { disabledReason } : {})}
                      onSelect={(id) => {
                        setValue('payment', id, { shouldValidate: true })
                        setPaymentEngaged(true)
                        trackSelectPayment({
                          paymentType: id,
                          value: totalBdt,
                          numItems: itemCount,
                          items: analyticsItems,
                          ...(couponApplied && couponCode.trim()
                            ? { coupon: couponCode.trim() }
                            : {}),
                        })
                        clearSubmitError()
                      }}
                    />
                  )
                })}
              </div>
            </CheckoutSection>

            <div className="checkout-trust">
              <span><ShieldCheck className="h-3.5 w-3.5" /> Secure checkout</span>
              <span><RefreshCw className="h-3.5 w-3.5" /> Easy returns</span>
              <span><Lock className="h-3.5 w-3.5" /> Privacy protected</span>
            </div>

            <CheckoutSubmitPanel
              totalBdt={totalBdt}
              submitting={submitting}
              disabled={items.length === 0}
              {...(submitError ? { error: submitError } : {})}
              onSubmitIntent={() => setPaymentEngaged(true)}
            />
          </form>

          <CheckoutOrderSummary
            items={items}
            itemCount={itemCount}
            subtotal={subtotal}
            delivery={delivery}
            discount={discount}
            digitalDiscount={digitalDiscount}
            totalBdt={totalBdt}
            payment={payment}
            deliveryProgress={deliveryProgress}
            freeDeliveryThreshold={freeDeliveryThreshold}
          />
        </div>
      </section>

      {items.length > 0 ? (
        <CheckoutMobileBar
          itemCount={itemCount}
          totalBdt={totalBdt}
          submitting={submitting}
          disabled={items.length === 0}
        />
      ) : null}
      </>
      )}
    </CheckoutShell>
  )
}
