'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { authHoverLift, authMotionTransition, authTapSpring } from '@/lib/auth/auth-motion'

interface AuthSubmitButtonProps {
  loading: boolean
  loadingLabel: string
  children: React.ReactNode
  type?: 'submit' | 'button'
  disabled?: boolean
}

export function AuthSubmitButton({
  loading,
  loadingLabel,
  children,
  type = 'submit',
  disabled = false,
}: AuthSubmitButtonProps) {
  const reduceMotion = useReducedMotion()
  const pressMotion = reduceMotion || loading ? {} : { whileHover: authHoverLift, whileTap: authTapSpring }

  return (
    <motion.button
      type={type}
      disabled={disabled || loading}
      className="auth-submit auth-submit--primary"
      {...pressMotion}
      transition={authMotionTransition(reduceMotion, 0.18)}
    >
      {loading ? (
        <>
          <Loader2 className="auth-submit__spinner h-4 w-4" strokeWidth={2.2} />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </motion.button>
  )
}
