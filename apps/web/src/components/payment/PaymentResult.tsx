'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { trackPurchase } from '@/lib/analytics/meta-pixel'

type PaymentResultKind = 'success' | 'failed' | 'cancelled'
type PaymentVerification = 'loading' | 'paid' | 'unpaid' | 'unavailable'

interface PaymentResultCopy {
  eyebrow: string
  title: string
  description: string
}

interface PaymentResultProps {
  kind: PaymentResultKind
  invoice?: string
  accessKey?: string
}

const COPY: Record<PaymentResultKind, PaymentResultCopy> = {
  success: {
    eyebrow: 'Payment response received',
    title: 'We are verifying your payment',
    description:
      'Your gateway returned successfully. Open the order page to see the verified payment state.',
  },
  failed: {
    eyebrow: 'Payment not completed',
    title: 'Your payment could not be confirmed',
    description:
      'No payment success has been recorded. Your order may remain pending; contact support if money was deducted.',
  },
  cancelled: {
    eyebrow: 'Payment cancelled',
    title: 'You left the payment process',
    description:
      'No payment success has been recorded. You can review the pending order or contact support.',
  },
}

const VERIFIED_COPY: PaymentResultCopy = {
  eyebrow: 'Payment verified',
  title: 'Your payment is confirmed',
  description: 'The verified gateway result is recorded against your SPLARO order.',
}

const PENDING_COPY: PaymentResultCopy = {
  eyebrow: 'Verification pending',
  title: 'Payment is not confirmed yet',
  description:
    'The gateway returned, but SPLARO has not verified a paid state. Check the order again shortly or contact support.',
}

function resolveCopy(
  kind: PaymentResultKind,
  verification: PaymentVerification,
): PaymentResultCopy {
  if (verification === 'paid') return VERIFIED_COPY
  if (verification === 'loading') return COPY.success
  if (kind === 'success') return PENDING_COPY
  return COPY[kind]
}

export function PaymentResult({ kind, invoice, accessKey }: PaymentResultProps) {
  const [verification, setVerification] = useState<PaymentVerification>(
    invoice && accessKey ? 'loading' : 'unavailable',
  )

  useEffect(() => {
    if (!invoice || !accessKey) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const verify = async (attempt: number) => {
      try {
        const response = await fetch(
          `/api/payments/status?invoiceNumber=${encodeURIComponent(invoice)}&key=${encodeURIComponent(accessKey)}`,
          { cache: 'no-store' },
        )
        const payload = (await response.json()) as {
          verified?: boolean
          paymentStatus?: string
          total?: number
          shipping?: number
          coupon?: string | null
          items?: Array<{
            id: string
            name: string
            price: number
            quantity: number
            variant?: string | null
          }>
        }
        if (!active) return
        if (response.ok && payload.verified === true && payload.paymentStatus === 'PAID') {
          setVerification('paid')
          trackPurchase({
            transactionId: invoice,
            verified: true,
            value: payload.total ?? 0,
            ...(typeof payload.shipping === 'number' ? { shipping: payload.shipping } : {}),
            items: (payload.items ?? []).map((item) => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              brand: 'SPLARO',
              ...(item.variant ? { variant: item.variant } : {}),
            })),
            ...(payload.coupon ? { coupon: payload.coupon } : {}),
          })
          return
        }
        if (response.ok && kind === 'success' && attempt < 3) {
          timer = setTimeout(() => void verify(attempt + 1), 1200)
          return
        }
        setVerification(response.ok ? 'unpaid' : 'unavailable')
      } catch {
        if (active) setVerification('unavailable')
      }
    }

    void verify(0)
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [accessKey, invoice, kind])

  const copy = resolveCopy(kind, verification)
  const orderHref = (() => {
    if (!invoice) return '/track-order'
    const params = new URLSearchParams()
    if (accessKey) params.set('key', accessKey)
    if (verification !== 'paid') params.set('payment', 'pending')
    const query = params.toString()
    return `/order-confirmation/${encodeURIComponent(invoice)}${query ? `?${query}` : ''}`
  })()

  return (
    <section className="checkout-container">
      <div className="checkout-success__hero checkout-glass-panel" aria-live="polite">
        <p className="checkout-eyebrow">{copy.eyebrow}</p>
        <h1 className="checkout-title">{copy.title}</h1>
        <p className="checkout-subtitle">{copy.description}</p>
        {invoice ? (
          <p className="checkout-subtitle">
            Order reference: <strong>{invoice}</strong>
          </p>
        ) : null}
        <div className="checkout-success__actions">
          <Link href={orderHref} className="checkout-btn checkout-btn--primary">
            {invoice ? 'View verified order state' : 'Track an order'}
          </Link>
          <Link href="/contact" className="checkout-btn checkout-btn--ghost">
            Contact support
          </Link>
        </div>
      </div>
    </section>
  )
}
