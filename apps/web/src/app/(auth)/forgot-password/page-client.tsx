'use client'

import { type FormEvent, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, Mail } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from '@/lib/motion/react'
import { AuthField } from '@/components/auth/AuthField'
import { AuthSubmitButton } from '@/components/auth/AuthSubmitButton'
import {
  authFadeSlide,
  authFormMotion,
  authMotionTransition,
} from '@/lib/auth/auth-motion'

export default function ForgotPasswordPageClient() {
  const reduceMotion = useReducedMotion()
  const fadeSlide = authFadeSlide(reduceMotion)
  const formMotion = authFormMotion(reduceMotion)
  const motionTransition = authMotionTransition(reduceMotion)
  const formTransition = authMotionTransition(reduceMotion, 0.24)

  const searchParams = useSearchParams()
  // Signup phone step sends ?identifier=; older links may still use ?email=.
  const [email, setEmail] = useState(
    () => searchParams.get('identifier')?.trim() || searchParams.get('email')?.trim() || '',
  )
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const sent = Boolean(message)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string }

      if (!response.ok) {
        setError(data.error ?? 'Unable to send reset link. Please try again.')
        return
      }

      setMessage(
        data.message ??
          'If that account exists, a reset link has been sent to its email address.',
      )
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <LayoutGroup id="auth-forgot">
      <div className="auth-card auth-card--recover">
        <motion.div layout className="auth-card__heading" aria-live="polite">
          <motion.div {...fadeSlide} transition={motionTransition} className="auth-recover__intro">
            <span className="auth-recover__seal" aria-hidden>
              <Mail className="auth-recover__seal-icon" strokeWidth={1.55} />
            </span>
            <h1 className="auth-card__title">Forgot your password?</h1>
            <p className="auth-card__subtitle">
              Enter your email or the phone number you order with — we&apos;ll send a reset
              link to the email on that account.
            </p>
          </motion.div>
        </motion.div>

        <div className="auth-card__body">
          <motion.form
            layout
            onSubmit={handleSubmit}
            className="auth-form auth-recover__form"
            {...formMotion}
            transition={formTransition}
          >
            <AuthField
              required
              type="text"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email or phone number"
              autoComplete="username"
              trailing={
                <span className="auth-field__icon-chip">
                  <Mail className="h-4 w-4" strokeWidth={2.1} />
                </span>
              }
            />

            <AnimatePresence mode="wait">
              {error ? (
                <motion.p
                  key="error"
                  className="auth-form__error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18 }}
                >
                  {error}
                </motion.p>
              ) : null}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {message ? (
                <motion.div
                  key="success"
                  className="auth-recover__sent"
                  role="status"
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
                  transition={{ duration: reduceMotion ? 0 : 0.22 }}
                >
                  <span className="auth-recover__sent-icon" aria-hidden>
                    <Check className="h-4 w-4" strokeWidth={2.4} />
                  </span>
                  <p className="auth-recover__sent-text">{message}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AuthSubmitButton loading={loading} loadingLabel="Sending...">
              {sent ? 'Resend link' : 'Send reset link'}
            </AuthSubmitButton>
          </motion.form>
        </div>

        <motion.p layout className="auth-card__legal" transition={motionTransition}>
          Remember your password?{' '}
          <Link href="/login" className="auth-link">
            Sign in
          </Link>
        </motion.p>
      </div>
    </LayoutGroup>
  )
}
