'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatBDT } from '@/lib/utils/currency'
import { getCheckoutEntryPath } from '@/lib/checkout/checkout-auth'
import { useAuthStore } from '@/store/authStore'
import { CartTrustSignals } from './CartTrustSignals'

interface CartSummaryProps {
  subtotal: number
  onClose?: () => void
  continueHref?: string
}

export function CartSummary({ subtotal, onClose, continueHref = '/collections' }: CartSummaryProps) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [navigating, setNavigating] = useState(false)

  const handleCheckout = () => {
    if (navigating) return
    setNavigating(true)
    onClose?.()
    window.setTimeout(() => {
      router.push(getCheckoutEntryPath(Boolean(user)))
    }, 300)
  }

  return (
    <div className="border-t border-black/5 bg-white/55 px-6 py-5 backdrop-blur-2xl">
      <CartTrustSignals />

      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-sm font-semibold uppercase tracking-[0.12em] text-luxury-gray">
          Subtotal
        </span>
        <span className="text-lg font-black text-luxury-black">{formatBDT(subtotal)}</span>
      </div>
      <p className="mb-4 text-xs text-luxury-gray/75">
        Shipping and taxes are calculated at checkout.
      </p>

      <button
        type="button"
        onClick={handleCheckout}
        disabled={navigating}
        className="glass-action glass-action-dark cart-checkout-btn flex w-full justify-center"
      >
        {navigating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
            Opening checkout…
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
          className="mt-2.5 w-full py-2 text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-luxury-gray transition-colors hover:text-luxury-black disabled:opacity-50"
        >
          Continue Shopping
        </button>
      ) : (
        <Link
          href={continueHref}
          className="mt-2.5 block w-full py-2 text-center text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-luxury-gray transition-colors hover:text-luxury-black"
        >
          Continue Shopping
        </Link>
      )}
    </div>
  )
}
