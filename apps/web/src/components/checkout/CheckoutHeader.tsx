import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

interface CheckoutHeaderProps {
  userName?: string | undefined
  isSignedIn: boolean
}

export function CheckoutHeader({ userName, isSignedIn }: CheckoutHeaderProps) {
  return (
    <div className="checkout-header checkout-glass-panel">
      <div>
        <div className="checkout-header__meta">
          <p className="checkout-eyebrow">Secure checkout</p>
          <span className="checkout-secure-pill">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
            SSL protected
          </span>
        </div>
        <h1 className="checkout-title">Complete your order</h1>
        <p className="checkout-subtitle">
          {isSignedIn && userName ? (
            <>
              Signed in as <strong>{userName}</strong> · Saved details applied
            </>
          ) : (
            <>
              Account required ·{' '}
              <Link href="/signup?next=/checkout" className="checkout-subtitle__link">
                Create account
              </Link>{' '}
              or{' '}
              <Link href="/login?next=/checkout" className="checkout-subtitle__link">
                sign in
              </Link>
            </>
          )}
        </p>
      </div>
      <Link href="/shop" className="checkout-btn checkout-btn--ghost checkout-btn--compact">
        <ArrowLeft className="h-4 w-4" />
        Back to shop
      </Link>
    </div>
  )
}
