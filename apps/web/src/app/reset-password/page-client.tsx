'use client'

import { type FormEvent, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { AuthField } from '@/components/auth/AuthField'
import { AuthShell } from '@/components/auth/AuthShell'

export default function ResetPasswordPageClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!token) {
      setError('Invalid or missing reset token. Request a new link.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
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
        setError(data.error ?? 'Unable to reset password. The link may have expired.')
        return
      }

      setMessage(data.message ?? 'Password updated successfully. You can sign in now.')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <h1 className="auth-card__title">Reset your password</h1>
        <p className="auth-card__subtitle">Choose a new password for your SPLARO account.</p>

        <form onSubmit={handleSubmit} className="auth-form">
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

          {error ? <p className="auth-form__error">{error}</p> : null}
          {message ? <p className="auth-form__success">{message}</p> : null}

          <button type="submit" className="auth-submit auth-submit--primary" disabled={loading}>
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>

        <p className="auth-card__legal">
          {message ? (
            <Link href="/login" className="auth-link">
              Sign in
            </Link>
          ) : (
            <>
              Need a new link?{' '}
              <Link href="/forgot-password" className="auth-link">
                Request reset
              </Link>
            </>
          )}
        </p>
      </div>
    </AuthShell>
  )
}
