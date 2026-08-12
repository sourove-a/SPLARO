'use client'

import { Loader2 } from 'lucide-react'

interface AuthSubmitButtonProps {
  loading: boolean
  loadingLabel: string
  children: React.ReactNode
  type?: 'submit' | 'button'
  disabled?: boolean
}

/**
 * Plain <button> — Framer motion opacity/hover on submit previously fought
 * auth CSS and could flash a white blank pill (white text on white bg).
 */
export function AuthSubmitButton({
  loading,
  loadingLabel,
  children,
  type = 'submit',
  disabled = false,
}: AuthSubmitButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className="auth-submit auth-submit--primary"
      data-no-press
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <Loader2 className="auth-submit__spinner h-4 w-4" strokeWidth={2.2} aria-hidden />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <span>{children}</span>
      )}
    </button>
  )
}
