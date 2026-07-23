'use client'

import Link from 'next/link'
import { ArrowLeft, UserRound } from 'lucide-react'
import { motion, useReducedMotion } from '@/lib/motion/react'
import { CHECKOUT_LOGIN_PATH } from '@/lib/checkout/checkout-auth'
import { checkoutChromeMotion, checkoutEnterTransition } from '@/lib/checkout/checkout-motion'

interface CheckoutHeaderProps {
  isSignedIn: boolean
}

export function CheckoutHeader({ isSignedIn }: CheckoutHeaderProps) {
  const reduced = useReducedMotion()

  return (
    <motion.header
      className="checkout-header"
      {...checkoutChromeMotion(reduced)}
      transition={checkoutEnterTransition(reduced, 0.06)}
    >
      <Link href="/shop" className="checkout-header__back">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        <span>Shop</span>
      </Link>
      <h1 className="checkout-title">Checkout</h1>
      {!isSignedIn ? (
        <Link href={CHECKOUT_LOGIN_PATH} className="checkout-header__signin">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          Sign in
        </Link>
      ) : (
        <span className="checkout-header__spacer" aria-hidden />
      )}
    </motion.header>
  )
}
