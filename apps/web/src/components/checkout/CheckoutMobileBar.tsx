'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { motion, useReducedMotion } from '@/lib/motion/react'
import { formatBDT } from '@/lib/utils/currency'
import { checkoutMotionTransition, checkoutTapSpring } from '@/lib/checkout/checkout-motion'

interface CheckoutMobileBarProps {
  itemCount: number
  totalBdt: number
  submitting: boolean
  disabled?: boolean
}

export function CheckoutMobileBar({
  itemCount,
  totalBdt,
  submitting,
  disabled = false,
}: CheckoutMobileBarProps) {
  const reduced = useReducedMotion()
  const barRef = useRef<HTMLDivElement>(null)
  const keyboardOffsetRef = useRef(0)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const pressMotion = reduced || submitting || disabled ? {} : { whileTap: checkoutTapSpring }

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    let frame = 0
    const syncToVisibleViewport = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const bar = barRef.current
        if (!bar) return

        const visibleBottom = viewport.offsetTop + viewport.height
        const currentOffset = keyboardOffsetRef.current
        const coveredByKeyboard = bar.getBoundingClientRect().bottom - visibleBottom
        const nextOffset = Math.max(0, Math.round(currentOffset + coveredByKeyboard))
        if (Math.abs(nextOffset - currentOffset) <= 1) return

        keyboardOffsetRef.current = nextOffset
        setKeyboardOffset(nextOffset)
      })
    }

    syncToVisibleViewport()
    viewport.addEventListener('resize', syncToVisibleViewport)
    viewport.addEventListener('scroll', syncToVisibleViewport)
    document.addEventListener('focusin', syncToVisibleViewport)
    document.addEventListener('focusout', syncToVisibleViewport)
    window.addEventListener('orientationchange', syncToVisibleViewport)

    return () => {
      window.cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', syncToVisibleViewport)
      viewport.removeEventListener('scroll', syncToVisibleViewport)
      document.removeEventListener('focusin', syncToVisibleViewport)
      document.removeEventListener('focusout', syncToVisibleViewport)
      window.removeEventListener('orientationchange', syncToVisibleViewport)
    }
  }, [])

  const dismissKeyboard = () => {
    const active = document.activeElement
    if (
      active instanceof HTMLElement &&
      active.matches('input, textarea, select, [contenteditable="true"]')
    ) {
      active.blur()
    }
  }

  return (
    <div
      ref={barRef}
      className="checkout-mobile-bar lg:hidden"
      style={{ '--checkout-keyboard-offset': `${keyboardOffset}px` } as CSSProperties}
    >
      <div className="checkout-mobile-bar__meta">
        <p className="checkout-mobile-bar__label">
          Total · {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </p>
        <p className="checkout-mobile-bar__price">{formatBDT(totalBdt)}</p>
      </div>
      <motion.button
        type="submit"
        form="checkout-main-form"
        disabled={submitting || disabled}
        className="checkout-btn checkout-btn--primary"
        onClick={dismissKeyboard}
        {...pressMotion}
        transition={checkoutMotionTransition(reduced, 0.18)}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
            Placing…
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Place order
          </>
        )}
      </motion.button>
    </div>
  )
}
