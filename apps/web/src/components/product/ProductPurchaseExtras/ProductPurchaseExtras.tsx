'use client'

import { useMemo } from 'react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { buildPaymentOptions } from '@/lib/checkout/payments'
import { DIGITAL_PAYMENT_DISCOUNT_RATE, formatBDT } from '@/lib/utils/currency'
import type { ProductDetailData } from '@/types/product'

interface ProductPurchaseExtrasProps {
  product: ProductDetailData
  price: number
  variant?: 'highlights' | 'delivery' | 'trust' | 'payments'
}

function materialLine(product: ProductDetailData): string | null {
  const parts: string[] = []
  if (product.fabricContent?.trim()) parts.push(product.fabricContent.trim())
  if (product.fitType?.trim()) parts.push(`${product.fitType.trim()} fit`)
  if (product.occasion?.trim()) parts.push(product.occasion.trim())
  return parts.length ? parts.join(' · ') : null
}

export function ProductPurchaseExtras({ product, price, variant }: ProductPurchaseExtrasProps) {
  const { shipping, payments } = useStorefrontSettings()

  const highlights = useMemo(() => materialLine(product), [product])

  const deliveryLine = useMemo(() => {
    const dhaka = Math.round(shipping.dhakaDeliveryCharge)
    const outside = Math.round(shipping.outsideDhakaCharge)
    const threshold = Math.round(shipping.freeDeliveryThreshold)
    const segments = [`Dhaka ${formatBDT(dhaka)}`, `Outside ${formatBDT(outside)}`]
    if (threshold > 0) {
      segments.push(
        price >= threshold
          ? 'Free delivery on this order'
          : `Free over ${formatBDT(threshold)}`,
      )
    }
    return segments.join(' · ')
  }, [price, shipping])

  const paymentOptions = useMemo(() => buildPaymentOptions(payments), [payments])
  const digitalEnabled = payments.bkash || payments.nagad || payments.sslcommerz
  const digitalPct =
    DIGITAL_PAYMENT_DISCOUNT_RATE > 0 ? Math.round(DIGITAL_PAYMENT_DISCOUNT_RATE * 100) : 0

  if (variant === 'highlights') {
    if (!highlights) return null
    return <p className="pp-info__highlights">{highlights}</p>
  }

  if (variant === 'delivery') {
    return <p className="pp-info__delivery">{deliveryLine}</p>
  }

  if (variant === 'trust') {
    return null
  }

  if (variant === 'payments') {
    if (!paymentOptions.length) return null
    return (
      <div className="pp-info__payments" aria-label="Accepted payment methods">
        {paymentOptions.map((option) => (
          <span key={option.id} className="pp-info__payment-chip">
            {option.logo ? (
              <img
                src={option.logo}
                alt=""
                width={16}
                height={16}
                className="pp-info__payment-logo"
                loading="lazy"
                decoding="async"
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
