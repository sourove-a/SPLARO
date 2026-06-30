'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Building2,
  FileText,
  Lock,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react'
import { type CartItem, useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useAdminStore } from '@/store/adminStore'
import {
  buildPaymentOptions,
  isDigitalPayment,
  isPaymentAvailable,
  type PaymentMethod,
} from '@/lib/checkout/payments'
import {
  getCheckoutFormDefaults,
  loadCheckoutCustomerDraft,
} from '@/lib/checkout/customer-draft'
import { BD_DISTRICTS } from '@/lib/checkout/bd-districts'
import { getThanasForDistrict } from '@/lib/checkout/bd-thanas'
import { CHECKOUT_SIGNUP_PATH } from '@/lib/checkout/checkout-auth'
import {
  formatBdPhoneInput,
  getBdPhoneError,
  isValidBdMobile,
  normalizeBdPhone,
} from '@/lib/checkout/phone'
import { clearStagedCheckoutItems, consumeStagedCheckoutItems } from '@/lib/cart/checkout-intent'
import { saveOrderLocally, type StoredOrder } from '@/lib/orders'
import { buildOrderConfirmationPath } from '@/lib/invoice-url'
import { products } from '@/data/storefront'
import {
  DELIVERY_FEE_BDT,
  DIGITAL_PAYMENT_DISCOUNT_RATE,
  formatBDT,
} from '@/lib/utils/currency'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { useClientMounted } from '@/hooks/useClientMounted'
import { getStoredAttribution } from '@/lib/analytics/attribution'
import { notifyOrderPaymentEvent } from '@/lib/api/order-events'
import { trackInitiateCheckout, trackPurchase } from '@/lib/analytics/meta-pixel'
import {
  CheckoutField,
  CheckoutHeader,
  CheckoutMobileBar,
  CheckoutOrderSummary,
  CheckoutPhoneInput,
  CheckoutShell,
  CheckoutSteps,
} from '@/components/checkout'

interface CheckoutForm {
  name: string
  email: string
  phone: string
  address: string
  city: string
  thana: string
  payment: PaymentMethod
}

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

  const [form, setForm] = useState<CheckoutForm>(getCheckoutFormDefaults)
  const [activeStep, setActiveStep] = useState(1)
  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponMessage, setCouponMessage] = useState('')
  const [freeShipping, setFreeShipping] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [couponsEnabled, setCouponsEnabled] = useState(false)
  const [couponApplying, setCouponApplying] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [authGateReady, setAuthGateReady] = useState(false)

  const thanaOptions = useMemo(() => getThanasForDistrict(form.city), [form.city])

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
    fetch('/api/coupons/active')
      .then((res) => res.json())
      .then((payload: { enabled?: boolean }) => setCouponsEnabled(Boolean(payload.enabled)))
      .catch(() => setCouponsEnabled(false))
  }, [])

  const delivery =
    freeShipping ||
    subtotal === 0 ||
    (freeDeliveryThreshold > 0 && subtotal >= freeDeliveryThreshold)
      ? 0
      : DELIVERY_FEE_BDT
  const digitalDiscount = isDigitalPayment(form.payment)
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
    setForm((current) => ({ ...current, ...loadCheckoutCustomerDraft() }))
  }, [])

  useEffect(() => {
    if (!authHydrated || !user) return

    setForm((current) => ({
      ...current,
      name: user.name || current.name,
      email: user.email || current.email,
      phone: user.phone ? formatBdPhoneInput(user.phone) : current.phone,
      address: current.address,
      city: current.city,
      thana: current.thana,
    }))
  }, [authHydrated, user])

  useEffect(() => {
    if (isPaymentAvailable(form.payment, paymentSettings)) return
    setForm((current) => ({ ...current, payment: 'Cash on Delivery' }))
  }, [form.payment, paymentSettings])

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
        setCouponMessage(payload.message ?? 'Invalid coupon code')
        return
      }

      setCouponDiscount(payload.discount ?? 0)
      setFreeShipping(Boolean(payload.freeShipping))
      setCouponMessage(payload.message ?? 'Coupon applied')
    } catch {
      setCouponDiscount(0)
      setFreeShipping(false)
      setCouponMessage('Could not validate coupon right now. Please try again.')
    } finally {
      setCouponApplying(false)
    }
  }

  const deliveryProgress =
    freeDeliveryThreshold > 0 && subtotal > 0 && delivery > 0
      ? Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100))
      : null

  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || items.length === 0) return

    const phoneValidationError = getBdPhoneError(form.phone)
    if (phoneValidationError) {
      setPhoneError(phoneValidationError)
      setSubmitError('Please fix your phone number before placing the order.')
      return
    }

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
          couponCode: couponCode.trim() || undefined,
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
        if (saved.invoiceNumber) {
          void notifyOrderPaymentEvent({
            invoiceNumber: saved.invoiceNumber,
            status: 'started',
            gateway: 'SSLCommerz',
          })
        }
        const payResponse = await fetch('/api/payments/sslcommerz/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: saved.id, amount: totalBdt, phone: normalizedPhone }),
        })
        const payPayload = (await payResponse.json()) as { gatewayUrl?: string; error?: string }
        if (payPayload.gatewayUrl) {
          clearStagedCheckoutItems()
          clearCart()
          window.location.href = payPayload.gatewayUrl
          return
        }
        if (!payResponse.ok) {
          if (saved.invoiceNumber) {
            void notifyOrderPaymentEvent({
              invoiceNumber: saved.invoiceNumber,
              status: 'failed',
              gateway: 'SSLCommerz',
            })
          }
          setSubmitError(payPayload.error ?? 'Unable to start card payment')
          return
        }
      }

      if (form.payment === 'bKash' || form.payment === 'Nagad') {
        const provider = form.payment === 'bKash' ? 'bkash' : 'nagad'
        if (saved.invoiceNumber) {
          void notifyOrderPaymentEvent({
            invoiceNumber: saved.invoiceNumber,
            status: 'started',
            gateway: form.payment,
          })
        }
        const payResponse = await fetch(`/api/payments/${provider}/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: saved.id, phone: normalizedPhone }),
        })
        const payPayload = (await payResponse.json()) as {
          redirectUrl?: string
          gatewayUrl?: string
          error?: string
        }
        const redirectUrl = payPayload.redirectUrl ?? payPayload.gatewayUrl
        if (redirectUrl) {
          clearStagedCheckoutItems()
          clearCart()
          window.location.href = redirectUrl
          return
        }
        if (!payResponse.ok) {
          if (saved.invoiceNumber) {
            void notifyOrderPaymentEvent({
              invoiceNumber: saved.invoiceNumber,
              status: 'failed',
              gateway: form.payment,
            })
          }
          setSubmitError(payPayload.error ?? `Unable to start ${form.payment} payment`)
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

        <CheckoutSteps activeStep={activeStep} />

        <div className="checkout-layout">
          <form id="checkout-main-form" onSubmit={placeOrder} className="checkout-form checkout-glass-panel">
            <section className="checkout-section checkout-section-card">
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
                <CheckoutField label="Full name" icon={UserRound} clientReady={clientReady}>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => {
                      setForm({ ...form, name: event.target.value })
                      setActiveStep(Math.max(activeStep, 2))
                    }}
                    className="checkout-input"
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </CheckoutField>
                <CheckoutField label="Email address" icon={Mail} clientReady={clientReady}>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className="checkout-input"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </CheckoutField>
                <CheckoutField
                  label="Phone number"
                  icon={Phone}
                  clientReady={clientReady}
                  {...(phoneError ? { error: phoneError } : { hint: 'Local format — starts with 01' })}
                >
                  <CheckoutPhoneInput
                    value={form.phone}
                    invalid={Boolean(phoneError)}
                    clientReady={clientReady}
                    onChange={(phone) => {
                      setForm({ ...form, phone })
                      if (phoneError && isValidBdMobile(phone)) {
                        setPhoneError('')
                      }
                    }}
                    onBlur={() => {
                      if (!form.phone) return
                      setPhoneError(getBdPhoneError(form.phone) ?? '')
                    }}
                  />
                </CheckoutField>
                <div className="checkout-fields checkout-fields--pair">
                  <CheckoutField label="District" icon={Building2} clientReady={clientReady}>
                    <select
                      required
                      value={form.city}
                      onChange={(event) => {
                        const city = event.target.value
                        const thanas = getThanasForDistrict(city)
                        setForm({ ...form, city, thana: thanas[0] ?? '' })
                      }}
                      className="checkout-input checkout-input--select"
                      autoComplete="address-level2"
                    >
                      {BD_DISTRICTS.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  </CheckoutField>
                  <CheckoutField label="Thana / Upazila" icon={Building2} clientReady={clientReady}>
                    <select
                      required
                      value={form.thana}
                      onChange={(event) => setForm({ ...form, thana: event.target.value })}
                      className="checkout-input checkout-input--select"
                      autoComplete="address-level3"
                    >
                      {thanaOptions.map((thana) => (
                        <option key={thana} value={thana}>
                          {thana}
                        </option>
                      ))}
                    </select>
                  </CheckoutField>
                </div>
                <CheckoutField label="Delivery address" icon={MapPin} full hint="House, road, area, landmark" clientReady={clientReady}>
                  <textarea
                    required
                    value={form.address}
                    onChange={(event) => {
                      setForm({ ...form, address: event.target.value })
                      setActiveStep(Math.max(activeStep, 2))
                    }}
                    className="checkout-input checkout-input--area"
                    placeholder="House, road, area"
                    autoComplete="street-address"
                  />
                </CheckoutField>
              </div>
            </section>

            {couponsEnabled ? (
              <section className="checkout-section checkout-section-card">
                <div className="checkout-section__head">
                  <span className="checkout-section__badge">2</span>
                  <div>
                    <h2>Coupon code</h2>
                    <p className="checkout-section__sub checkout-section__sub--inline">
                      Have a promo? Apply it before payment.
                    </p>
                  </div>
                </div>
                <div className="checkout-coupon">
                  <div className="checkout-coupon__field">
                    <FileText className="checkout-coupon__icon h-4 w-4" strokeWidth={2.1} aria-hidden />
                    <input
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                      className="checkout-input checkout-input--coupon"
                      placeholder="SPLARO10"
                    />
                  </div>
                  <button
                    type="button"
                    className="checkout-btn checkout-btn--ghost checkout-btn--coupon"
                    onClick={applyCoupon}
                    disabled={couponApplying || !couponCode.trim()}
                  >
                    {couponApplying ? 'Applying...' : 'Apply'}
                  </button>
                </div>
                {couponMessage ? (
                  <p
                    className={`checkout-coupon-message ${couponDiscount > 0 || freeShipping ? 'checkout-coupon-message--success' : 'checkout-coupon-message--error'}`}
                  >
                    {couponMessage}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="checkout-section checkout-section-card">
              <div className="checkout-section__head">
                <span className="checkout-section__badge">{couponsEnabled ? '3' : '2'}</span>
                <div>
                  <h2>Payment method</h2>
                  <p className="checkout-section__sub checkout-section__sub--inline">
                    Choose your preferred payment option.
                  </p>
                </div>
              </div>
              <div className="checkout-payments">
                {paymentOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`checkout-payment ${option.priority ? 'checkout-payment--featured' : ''} ${form.payment === option.id ? 'checkout-payment--active' : ''}`}
                    onClick={() => {
                      setForm({ ...form, payment: option.id })
                      setActiveStep(Math.max(activeStep, 3))
                    }}
                  >
                    <div className="checkout-payment__main">
                      {option.logo ? (
                        <div className="checkout-payment__logo">
                          <Image src={option.logo} alt={option.label} width={72} height={28} unoptimized className="h-6 w-auto object-contain" />
                        </div>
                      ) : (
                        <span className="checkout-payment__icon">
                          <Truck className="h-5 w-5" strokeWidth={2} />
                        </span>
                      )}
                      <div>
                        <p className="checkout-payment__label">{option.label}</p>
                        <p className="checkout-payment__hint">{option.hint}</p>
                      </div>
                    </div>
                    <span className="checkout-payment__radio" aria-hidden />
                  </button>
                ))}
              </div>
            </section>

            <div className="checkout-trust">
              <span><ShieldCheck className="h-3.5 w-3.5" /> Secure checkout</span>
              <span><RefreshCw className="h-3.5 w-3.5" /> Easy returns</span>
              <span><Lock className="h-3.5 w-3.5" /> Privacy protected</span>
            </div>

            {submitError ? <p className="auth-form__error">{submitError}</p> : null}

            <button
              type="submit"
              disabled={items.length === 0 || submitting}
              className="checkout-btn checkout-btn--primary checkout-btn--full checkout-desktop-submit"
              onClick={() => setActiveStep(3)}
            >
              <Lock className="h-4 w-4" />
              {submitting ? 'Placing order...' : `Place order · ${formatBDT(totalBdt)}`}
            </button>
          </form>

          <CheckoutOrderSummary
            items={items}
            itemCount={itemCount}
            subtotal={subtotal}
            delivery={delivery}
            discount={discount}
            totalBdt={totalBdt}
            payment={form.payment}
            deliveryProgress={deliveryProgress}
            freeDeliveryThreshold={freeDeliveryThreshold}
          />
        </div>
      </section>

      {items.length > 0 ? (
        <CheckoutMobileBar itemCount={itemCount} totalBdt={totalBdt} submitting={submitting} />
      ) : null}
    </CheckoutShell>
  )
}
