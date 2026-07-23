'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatBDT } from '@/lib/utils/currency'
import { getCheckoutEntryPath } from '@/lib/checkout/checkout-auth'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'

interface CartSummaryProps {
  subtotal: number
  onClose?: () => void
  continueHref?: string
}

export function CartSummary({ subtotal, onClose, continueHref = '/shop' }: CartSummaryProps) {
  const router = useRouter()
  const [navigating, setNavigating] = useState(false)

  const handleCheckout = () => {
    if (navigating) return
    setNavigating(true)
    const checkoutPath = getCheckoutEntryPath()
    router.prefetch(checkoutPath)
    onClose?.()
    safeClientNavigate(router, checkoutPath)
  }

  return (
    <div className="cart-summary">
      <div className="cart-summary__row">
        <span className="cart-summary__label">Subtotal</span>
        <span className="cart-summary__value">{formatBDT(subtotal)}</span>
      </div>
      <p className="cart-summary__note">Shipping and taxes are calculated at checkout.</p>

      <button
        type="button"
        onClick={handleCheckout}
        disabled={navigating}
        className="cart-summary__checkout"
      >
        {navigating ? (
          <>
            <Loader2 className="cart-summary__spinner" strokeWidth={2} aria-hidden />
            Opening…
          </>
        ) : (
          'Proceed to Checkout'
        )}
      </button>

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          disabled={navigating}
          className="cart-summary__continue"
        >
          Continue Shopping
        </button>
      ) : (
        <Link href={continueHref} className="cart-summary__continue">
          Continue Shopping
        </Link>
      )}
    </div>
  )
}
