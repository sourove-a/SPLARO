import { Lock } from 'lucide-react'
import { formatBDT } from '@/lib/utils/currency'

interface CheckoutMobileBarProps {
  itemCount: number
  totalBdt: number
  submitting: boolean
}

export function CheckoutMobileBar({ itemCount, totalBdt, submitting }: CheckoutMobileBarProps) {
  return (
    <div className="checkout-mobile-bar lg:hidden">
      <div>
        <p className="checkout-mobile-bar__label">
          Total · {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </p>
        <p className="checkout-mobile-bar__price">{formatBDT(totalBdt)}</p>
      </div>
      <button
        type="submit"
        form="checkout-main-form"
        disabled={submitting}
        className="checkout-btn checkout-btn--primary"
      >
        <Lock className="h-4 w-4" />
        {submitting ? 'Placing...' : 'Place order'}
      </button>
    </div>
  )
}
