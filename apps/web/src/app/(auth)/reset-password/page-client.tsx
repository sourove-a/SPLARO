'use client'

import { type FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from '@/lib/motion/react'
import { AuthField } from '@/components/auth/AuthField'
import { AuthSubmitButton } from '@/components/auth/AuthSubmitButton'
import {
  authFadeSlide,
  authFormMotion,
  authMotionTransition,
} from '@/lib/auth/auth-motion'

export default function ResetPasswordPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const reduceMotion = useReducedMotion()
  const fadeSlide = authFadeSlide(reduceMotion)
  const formMotion = authFormMotion(reduceMotion)
  const motionTransition = authMotionTransition(reduceMotion)
  const formTransition = authMotionTransition(reduceMotion, 0.24)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!token) {
      setError('Invalid or missing reset token. Request a new link.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string }

      if (!response.ok) {
        setError(
          data.error ??
            'This reset link is invalid or was replaced. Request a new link from Forgot password.',
        )
        return
      }

      // Session cookie set by BFF — go straight to account, no second login.
      router.replace('/account')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <LayoutGroup id="auth-reset">
      <div className="auth-card">
        <motion.div layout className="auth-card__heading" aria-live="polite">
          <motion.div {...fadeSlide} transition={motionTransition}>
            <h1 className="auth-card__title">Reset your password</h1>
            <p className="auth-card__subtitle">Choose a new password. You&apos;ll be signed in right away.</p>
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
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              trailing={
                <span className="auth-field__icon-chip">
                  <Lock className="h-4 w-4" strokeWidth={2.1} />
                </span>
              }
            />
            <AuthField
              required
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
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

            <AuthSubmitButton loading={loading} loadingLabel="Updating...">
              Update password
            </AuthSubmitButton>
          </motion.form>
        </div>

        <motion.p layout className="auth-card__legal" transition={motionTransition}>
          Need a new link?{' '}
          <Link href="/forgot-password" className="auth-link">
            Request reset
          </Link>
        </motion.p>
      </div>
    </LayoutGroup>
  )
}
