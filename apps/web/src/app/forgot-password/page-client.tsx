'use client'

import { type FormEvent, useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { AuthField } from '@/components/auth/AuthField'
import { AuthShell } from '@/components/auth/AuthShell'

export default function ForgotPasswordPageClient() {
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
      <div className="auth-card">
        <h1 className="auth-card__title">Forgot your password?</h1>
        <p className="auth-card__subtitle">
          Enter the email linked to your SPLARO account. We&apos;ll send a reset link if it exists.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
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

          {error ? <p className="auth-form__error">{error}</p> : null}
          {message ? <p className="auth-form__success">{message}</p> : null}

          <button type="submit" className="auth-submit auth-submit--primary" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p className="auth-card__legal">
          Remember your password?{' '}
          <Link href="/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
