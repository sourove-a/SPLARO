import Link from 'next/link'
import { formatBDT } from '@/lib/utils/currency'
import { CartTrustSignals } from './CartTrustSignals'

interface CartSummaryProps {
  subtotal: number
  onClose?: () => void
  continueHref?: string
}

export function CartSummary({ subtotal, onClose, continueHref = '/collections' }: CartSummaryProps) {
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

      <Link
        href="/checkout"
        {...(onClose ? { onClick: onClose } : {})}
        className="glass-action glass-action-dark flex w-full justify-center"
      >
        Proceed to Checkout
      </Link>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="mt-2.5 w-full py-2 text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-luxury-gray transition-colors hover:text-luxury-black"
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
