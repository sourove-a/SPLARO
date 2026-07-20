'use client'

import Image from 'next/image'
import { useMemo } from 'react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { buildPaymentOptions } from '@/lib/checkout/payments'
import { DIGITAL_PAYMENT_DISCOUNT_RATE } from '@/lib/utils/currency'
import type { ProductDetailData } from '@/types/product'

interface ProductPurchaseExtrasProps {
  product: ProductDetailData
  price: number
  variant?: 'highlights' | 'payments'
}

function materialLine(product: ProductDetailData): string | null {
  const parts: string[] = []
  if (product.fabricContent?.trim()) parts.push(product.fabricContent.trim())
  const fit = product.fitType?.trim()
  if (fit) parts.push(/\bfit\b/i.test(fit) ? fit : `${fit} fit`)
  if (product.occasion?.trim()) parts.push(product.occasion.trim())
  return parts.length ? parts.join(' · ') : null
}

export function ProductPurchaseExtras({ product, price: _price, variant }: ProductPurchaseExtrasProps) {
  const { payments } = useStorefrontSettings()

  const highlights = useMemo(() => materialLine(product), [product])

  const paymentOptions = useMemo(() => buildPaymentOptions(payments), [payments])
  const digitalEnabled = payments.bkash || payments.nagad || payments.sslcommerz
  const digitalPct =
    DIGITAL_PAYMENT_DISCOUNT_RATE > 0 ? Math.round(DIGITAL_PAYMENT_DISCOUNT_RATE * 100) : 0

  if (variant === 'highlights') {
    if (!highlights) return null
    return <p className="pp-info__highlights">{highlights}</p>
  }

  if (variant === 'payments') {
    if (!paymentOptions.length) return null
    return (
      <div className="pp-info__payments" aria-label="Accepted payment methods">
        {paymentOptions.map((option) => (
          <span key={option.id} className="pp-info__payment-chip">
            {option.logo ? (
              <Image
                src={option.logo}
                alt=""
                width={16}
                height={16}
                className="pp-info__payment-logo"
              />
            ) : null}
            <span>{option.id === 'Cash on Delivery' ? 'COD' : option.label}</span>
          </span>
        ))}
        {digitalEnabled && digitalPct > 0 ? (
          <span className="pp-info__payment-note">{digitalPct}% off on bKash / Nagad / card</span>
        ) : null}
      </div>
    )
  }

  return null
}
