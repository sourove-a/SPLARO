'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import {
  Building2,
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
import { useAdminStore } from '@/store/adminStore'
import {
  buildPaymentOptions,
  isDigitalPayment,
  isPaymentAvailable,
} from '@/lib/checkout/payments'
import {
  getCheckoutFormDefaults,
  loadCheckoutCustomerDraft,
} from '@/lib/checkout/customer-draft'
import { BD_DISTRICTS } from '@/lib/checkout/bd-districts'
import { getThanasForDistrict } from '@/lib/checkout/bd-thanas'
import { CHECKOUT_SIGNUP_PATH } from '@/lib/checkout/checkout-auth'
import {
  checkoutFormSchema,
  type CheckoutFormValues,
} from '@/lib/checkout/checkout-schema'
import { formatBdPhoneInput, isValidBdMobile, normalizeBdPhone } from '@/lib/checkout/phone'
import { clearStagedCheckoutItems, consumeStagedCheckoutItems } from '@/lib/cart/checkout-intent'
import { saveOrderLocally, type StoredOrder } from '@/lib/orders'
import { buildOrderConfirmationPath } from '@/lib/invoice-url'
import { products } from '@/data/storefront'
import {
  DELIVERY_FEE_BDT,
  DIGITAL_PAYMENT_DISCOUNT_RATE,
} from '@/lib/utils/currency'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { useClientMounted } from '@/hooks/useClientMounted'
import { getStoredAttribution } from '@/lib/analytics/attribution'
import { notifyOrderPaymentEvent } from '@/lib/api/order-events'
import { fetchAccountProfile } from '@/lib/api/account'
import { startBkashCheckout, startNagadCheckout, startSslCommerzCheckout } from '@/lib/api/payments'
import { trackInitiateCheckout, trackPurchase } from '@/lib/analytics/meta-pixel'
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

function buildDeliveryAddress(address: string, thana: string, city: string): string {
  const street = address.trim()
  const parts = [street, thana.trim(), city.trim()].filter(Boolean)
  return parts.join(', ')
}

export default function CheckoutPageClient() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const authHydrated = useAuthStore((state) => state._hydrated)
  const paymentSettings = useAdminStore((state) => state.payments)
  const { items, subtotal, clearCart, replaceItems } = useCartStore()
  const cartHydrated = useCartStore((state) => state._hydrated)
  const { shipping } = useStorefrontSettings()
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
  const [authGateReady, setAuthGateReady] = useState(false)
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
    if (!cartHydrated || items.length > 0) return
    const staged = consumeStagedCheckoutItems()
    if (staged?.length) replaceItems(staged)
  }, [cartHydrated, items.length, replaceItems])

  useEffect(() => {
    if (!authHydrated) return
    if (!user) {
      router.replace(CHECKOUT_SIGNUP_PATH)
      return
    }
    setAuthGateReady(true)
  }, [authHydrated, user, router])

  useEffect(() => {
    fetchPromoAvailability()
      .then(({ hasActivePromo: active }) => {
        setHasActivePromo(active)
      })
      .catch(() => {
        setHasActivePromo(false)
      })
      .finally(() => {
        setPromoChecked(true)
      })
  }, [])

  useEffect(() => {
    if (showPromoStep) return
    setCouponCode('')
    setCouponDiscount(0)
    setCouponMessage('')
    setFreeShipping(false)
    setCouponApplied(false)
  }, [showPromoStep])

  const delivery =
    freeShipping ||
    subtotal === 0 ||
    (freeDeliveryThreshold > 0 && subtotal >= freeDeliveryThreshold)
      ? 0
      : DELIVERY_FEE_BDT
  const digitalDiscount = isDigitalPayment(payment)
    ? Math.round(subtotal * DIGITAL_PAYMENT_DISCOUNT_RATE)
    : 0
  const discount = digitalDiscount + couponDiscount
  const totalBdt = Math.max(0, Math.round(subtotal + delivery - discount))

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  )

  useEffect(() => {
    if (items.length === 0) return
    trackInitiateCheckout({ value: totalBdt, numItems: itemCount })
  }, [items.length, totalBdt, itemCount])

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

  useEffect(() => {
    if (isPaymentAvailable(payment, paymentSettings)) return
    setValue('payment', 'Cash on Delivery')
  }, [payment, paymentSettings, setValue])

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

    const phoneField = formEl.querySelector<HTMLElement>('[data-checkout-field="phone"]')
    if (errors.phone && phoneField) {
      phoneField.scrollIntoView({ behavior: 'smooth', block: 'center' })
      phoneField.querySelector<HTMLElement>('input')?.focus({ preventScroll: true })
      return
    }

    const firstInvalid = formEl.querySelector<HTMLElement>(
      '[data-checkout-field][data-invalid="true"], input:invalid, select:invalid, textarea:invalid',
    )
    firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

    const normalizedPhone = normalizeBdPhone(form.phone)
    const deliveryAddress = buildDeliveryAddress(form.address, form.thana, form.city)

    setSubmitting(true)
    setSubmitError('')

    const orderItems: CartItem[] = items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId)
      const next: CartItem = {
        productId: item.productId,
        quantity: item.quantity,
        name: item.name,
        price: item.price,
        image: item.image,
        slug: item.slug,
        size: item.size ?? product?.sizes[0] ?? 'M',
        color: item.color ?? product?.colors[0] ?? '#111111',
      }
      if (item.variantId) next.variantId = item.variantId
      return next
    })

    try {
      const attribution = getStoredAttribution()
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: orderItems,
          customer: {
            name: form.name,
            email: form.email,
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
          ...(attribution
            ? {
                attribution: {
                  utmSource: attribution.utmSource,
                  utmMedium: attribution.utmMedium,
                  utmCampaign: attribution.utmCampaign,
                  utmContent: attribution.utmContent,
                  utmTerm: attribution.utmTerm,
                  fbclid: attribution.fbclid,
                  referrer: attribution.referrer,
                  trafficSource: attribution.trafficSource,
                  landingPage: attribution.landingPage,
                },
              }
            : {}),
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
      trackPurchase({ orderId: saved.id, value: totalBdt, numItems: itemCount })
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
          clearStagedCheckoutItems()
          clearCart()
          window.location.href = ssl.gatewayUrl
          return
        } catch (err) {
          if (saved.invoiceNumber) {
            void notifyOrderPaymentEvent({
              invoiceNumber: saved.invoiceNumber,
              status: 'failed',
              gateway: 'SSLCommerz',
            })
          }
          setSubmitError(err instanceof Error ? err.message : 'Unable to start card payment')
          return
        }
      }

      if (form.payment === 'bKash' || form.payment === 'Nagad') {
        if (form.payment === 'bKash' && !saved.invoiceNumber) {
          setSubmitError('Order invoice missing — cannot start bKash. Retry or contact support.')
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
                    orderId: saved.id,
                    amount: totalBdt,
                  })
                ).redirectUrl
          clearStagedCheckoutItems()
          clearCart()
          window.location.href = redirectUrl
          return
        } catch (err) {
          if (saved.invoiceNumber) {
            void notifyOrderPaymentEvent({
              invoiceNumber: saved.invoiceNumber,
              status: 'failed',
              gateway: form.payment,
            })
          }
          setSubmitError(err instanceof Error ? err.message : `Unable to start ${form.payment} payment`)
          return
        }
      }

      clearStagedCheckoutItems()
      clearCart()
      router.replace(buildOrderConfirmationPath(saved))
      return
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!authGateReady) {
    return (
      <CheckoutShell withAmbient={false}>
        <section className="checkout-container">
          <div className="checkout-glass-panel checkout-auth-gate">
            <p className="checkout-eyebrow">Secure checkout</p>
            <h1 className="checkout-title">Preparing your checkout</h1>
            <p className="checkout-subtitle">Please sign in or create an account to continue.</p>
          </div>
        </section>
      </CheckoutShell>
    )
  }

  return (
    <CheckoutShell>
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
            <CheckoutSection className="checkout-section checkout-section-card" delay={0}>
              <div className="checkout-section__head">
                <span className="checkout-section__badge">1</span>
                <div>
                  <h2>Delivery details</h2>
                  <p className="checkout-section__sub checkout-section__sub--inline">
                    Where should we send your order?
                  </p>
                </div>
              </div>
              <div className="checkout-fields">
                <CheckoutField
                  label="Full name"
                  icon={UserRound}
                  clientReady={clientReady}
                  filled={Boolean(name.trim())}
                  fieldId="checkout-name"
                  {...(errors.name?.message ? { error: errors.name.message } : {})}
                >
                  <input
                    id="checkout-name"
                    {...register('name', { onChange: clearSubmitError })}
                    data-checkout-field="name"
                    data-invalid={errors.name ? 'true' : undefined}
                    className={`checkout-input ${errors.name ? 'checkout-input--invalid' : ''}`}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </CheckoutField>
                <CheckoutField
                  label="Email address"
                  icon={Mail}
                  clientReady={clientReady}
                  filled={Boolean(email.trim())}
                  fieldId="checkout-email"
                  {...(errors.email?.message ? { error: errors.email.message } : {})}
                >
                  <input
                    id="checkout-email"
                    type="email"
                    {...register('email', { onChange: clearSubmitError })}
                    data-checkout-field="email"
                    data-invalid={errors.email ? 'true' : undefined}
                    className={`checkout-input ${errors.email ? 'checkout-input--invalid' : ''}`}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </CheckoutField>
                <CheckoutField
                  label="Phone number"
                  icon={Phone}
                  clientReady={clientReady}
                  filled={isValidBdMobile(phone)}
                  fieldId="checkout-phone"
                  {...(errors.phone?.message
                    ? { error: errors.phone.message }
                    : { hint: 'Local format — starts with 01' })}
                >
                  <div data-checkout-field="phone" data-invalid={errors.phone ? 'true' : undefined}>
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field }) => (
                        <CheckoutPhoneInput
                          value={field.value}
                          invalid={Boolean(errors.phone)}
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
                    filled={Boolean(city)}
                    fieldId="checkout-city"
                    {...(errors.city?.message ? { error: errors.city.message } : {})}
                  >
                    <select
                      id="checkout-city"
                      {...register('city', {
                        onChange: (event) => {
                          const nextCity = event.target.value
                          const thanas = getThanasForDistrict(nextCity)
                          setValue('thana', thanas[0] ?? '', { shouldValidate: true })
                          clearSubmitError()
                        },
                      })}
                      data-checkout-field="city"
                      data-invalid={errors.city ? 'true' : undefined}
                      className={`checkout-input checkout-input--select ${errors.city ? 'checkout-input--invalid' : ''}`}
                      autoComplete="address-level2"
                    >
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
                    filled={Boolean(thana)}
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
                    >
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
                  hint="House, road, area, landmark"
                  clientReady={clientReady}
                  filled={Boolean(address.trim())}
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
                  />
                </CheckoutField>
              </div>
            </CheckoutSection>

            {showPromoStep ? (
              <CheckoutSection className="checkout-section checkout-section-card" delay={0.06}>
                <div className="checkout-section__head">
                  <span className="checkout-section__badge">2</span>
                  <div>
                    <h2>Promo code</h2>
                    <p className="checkout-section__sub checkout-section__sub--inline">
                      Optional — apply before placing your order.
                    </p>
                  </div>
                </div>
                <div className="checkout-coupon">
                  <div className="checkout-coupon__field">
                    <FileText className="checkout-coupon__icon h-4 w-4" strokeWidth={2.1} aria-hidden />
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

            <CheckoutSection className="checkout-section checkout-section-card" delay={0.08}>
              <div className="checkout-section__head">
                <span className="checkout-section__badge">{showPromoStep ? '3' : '2'}</span>
                <div>
                  <h2>Payment method</h2>
                  <p className="checkout-section__sub checkout-section__sub--inline">
                    Choose how you&apos;d like to pay.
                  </p>
                </div>
              </div>
              <div className="checkout-payments">
                {paymentOptions.map((option) => {
                  const available = isPaymentAvailable(option.id, paymentSettings)
                  return (
                    <CheckoutPaymentCard
                      key={option.id}
                      option={option}
                      selected={payment}
                      disabled={!available}
                      {...(!available
                        ? { disabledReason: 'Not available — contact support to enable' }
                        : {})}
                      onSelect={(id) => {
                        setValue('payment', id, { shouldValidate: true })
                        setPaymentEngaged(true)
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
    </CheckoutShell>
  )
}
