'use client'

import Image from 'next/image'
import { Truck } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import type { PaymentOption } from '@/lib/checkout/payments'
import type { PaymentMethod } from '@/lib/checkout/payments'
import { checkoutMotionTransition, checkoutTapSpring } from '@/lib/checkout/checkout-motion'

interface CheckoutPaymentCardProps {
  option: PaymentOption
  selected: PaymentMethod
  disabled?: boolean
  disabledReason?: string
  onSelect: (id: PaymentMethod) => void
}

export function CheckoutPaymentCard({
  option,
  selected,
  disabled = false,
  disabledReason,
  onSelect,
}: CheckoutPaymentCardProps) {
  const reduced = useReducedMotion()
  const isActive = !disabled && selected === option.id
  const pressMotion = reduced || disabled ? {} : { whileTap: checkoutTapSpring }

  return (
    <motion.button
      type="button"
      disabled={disabled}
      className={`checkout-payment ${option.priority ? 'checkout-payment--featured' : ''} ${isActive ? 'checkout-payment--active' : ''} ${disabled ? 'checkout-payment--disabled' : ''}`}
      onClick={() => {
        if (!disabled) onSelect(option.id)
      }}
      aria-pressed={isActive}
      aria-disabled={disabled}
      {...pressMotion}
      transition={checkoutMotionTransition(reduced, 0.18)}
      layout={!reduced}
    >
      <div className="checkout-payment__main">
        {option.logo ? (
          <div className="checkout-payment__logo">
            <Image
              src={option.logo}
              alt={option.label}
              width={72}
              height={28}
              unoptimized
              className="h-6 w-auto object-contain"
            />
          </div>
        ) : (
          <span className="checkout-payment__icon">
            <Truck className="h-5 w-5" strokeWidth={2} />
          </span>
        )}
        <div>
          <p className="checkout-payment__label">{option.label}</p>
          <p className="checkout-payment__hint">
            {disabled && disabledReason ? disabledReason : option.hint}
          </p>
        </div>
      </div>
      <span className="checkout-payment__radio" aria-hidden />
    </motion.button>
  )
}
