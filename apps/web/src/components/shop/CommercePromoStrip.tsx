'use client'

import Link from 'next/link'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { DIGITAL_PAYMENT_DISCOUNT_RATE } from '@/lib/utils/currency'

export function CommercePromoStrip() {
  const settings = useStorefrontSettings()
  const pct = Math.round(DIGITAL_PAYMENT_DISCOUNT_RATE * 100)
  const digitalEnabled =
    settings.payments.bkash || settings.payments.nagad || settings.payments.sslcommerz

  if (pct <= 0 && !digitalEnabled) return null

  const methods = [
    settings.payments.bkash && 'bKash',
    settings.payments.nagad && 'Nagad',
    settings.payments.sslcommerz && 'Card',
  ].filter(Boolean)

  const message =
    pct > 0
      ? `Save ${pct}% on entire order with digital payment`
      : methods.length
        ? `Pay securely with ${methods.join(', ')}`
        : null

  if (!message) return null

  return (
    <div className="commerce-promo-strip" role="status">
      <div className="commerce-promo-strip__inner">
        <p className="commerce-promo-strip__text">{message}</p>
        <Link href="/shop" className="commerce-promo-strip__link">
          Shop now
        </Link>
      </div>
    </div>
  )
}
