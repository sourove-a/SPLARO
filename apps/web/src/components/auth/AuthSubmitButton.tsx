'use client'

import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { authHoverLift, authMotionTransition, authTapSpring, useAuthShowMotion } from '@/lib/auth/auth-motion'

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
  const showMotion = useAuthShowMotion()
  const pressMotion = showMotion && !loading ? { whileHover: authHoverLift, whileTap: authTapSpring } : {}

  const content = loading ? (
    <>
      <Loader2 className="auth-submit__spinner h-4 w-4" strokeWidth={2.2} />
      {loadingLabel}
    </>
  ) : (
    children
  )

  if (!showMotion) {
    return (
      <button
        type={type}
        disabled={disabled || loading}
        className="auth-submit auth-submit--primary"
      >
        {content}
      </button>
    )
  }

  return (
    <motion.button
      type={type}
      disabled={disabled || loading}
      className="auth-submit auth-submit--primary"
      {...pressMotion}
      transition={authMotionTransition(false, 0.18)}
    >
      {content}
    </motion.button>
  )
}
