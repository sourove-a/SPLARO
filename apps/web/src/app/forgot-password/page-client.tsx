'use client'

import { type FormEvent, useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { AuthField } from '@/components/auth/AuthField'
import { AuthShell } from '@/components/auth/AuthShell'
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

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

      setMessage(data.message ?? 'If an account exists, a reset link has been sent to your email.')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <LayoutGroup id="auth-forgot">
        <div className="auth-card">
          <motion.div layout className="auth-card__heading" aria-live="polite">
            <motion.div {...fadeSlide} transition={motionTransition}>
              <h1 className="auth-card__title">Forgot your password?</h1>
              <p className="auth-card__subtitle">
                Enter the email linked to your SPLARO account. We&apos;ll send a reset link if it
                exists.
              </p>
            </motion.div>
          </motion.div>

          <div className="auth-card__body">
            <motion.form
              layout
              onSubmit={handleSubmit}
              className="auth-form"
              {...formMotion}
              transition={formTransition}
            >
              <AuthField
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                autoComplete="email"
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
                  <motion.p
                    key="success"
                    className="auth-form__success"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18 }}
                  >
                    {message}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <AuthSubmitButton loading={loading} loadingLabel="Sending...">
                Send reset link
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
    </AuthShell>
  )
}
