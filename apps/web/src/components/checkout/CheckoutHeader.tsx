import Link from 'next/link'
import { ArrowLeft, ShieldCheck, UserRound } from 'lucide-react'
import { CHECKOUT_LOGIN_PATH } from '@/lib/checkout/checkout-auth'

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
              Guest checkout — no account needed for Cash on Delivery.{' '}
              <Link href={CHECKOUT_LOGIN_PATH} className="checkout-signin-link">
                <UserRound className="h-3 w-3" aria-hidden />
                Sign in
              </Link>{' '}
              for saved details &amp; online payment.
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
