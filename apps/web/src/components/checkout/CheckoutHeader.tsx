'use client'

import Link from 'next/link'
import { ArrowLeft, ShieldCheck, UserRound } from 'lucide-react'
import { motion, useReducedMotion } from '@/lib/motion/react'
import { CHECKOUT_LOGIN_PATH } from '@/lib/checkout/checkout-auth'
import { checkoutChromeMotion, checkoutEnterTransition } from '@/lib/checkout/checkout-motion'

interface CheckoutHeaderProps {
  userName?: string | undefined
  isSignedIn: boolean
}

export function CheckoutHeader({ userName, isSignedIn }: CheckoutHeaderProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className="checkout-header checkout-glass-panel"
      {...checkoutChromeMotion(reduced)}
      transition={checkoutEnterTransition(reduced, 0.04)}
    >
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
              Welcome back, <strong>{userName}</strong>
              <span className="checkout-subtitle__quiet"> · Details filled in</span>
            </>
          ) : (
            <>
              <span className="checkout-subtitle__lead">Pay COD as guest — no account needed.</span>
              <span className="checkout-subtitle__quiet">
                {' '}
                <Link href={CHECKOUT_LOGIN_PATH} className="checkout-signin-link">
                  <UserRound className="h-3 w-3" aria-hidden />
                  Sign in
                </Link>{' '}
                for saved details &amp; online pay.
              </span>
            </>
          )}
        </p>
      </div>
      <Link href="/shop" className="checkout-btn checkout-btn--ghost checkout-btn--compact">
        <ArrowLeft className="h-4 w-4" />
        Back to shop
      </Link>
    </motion.div>
  )
}
