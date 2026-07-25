'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { AdminLoginShell } from '@/components/login/AdminLoginShell'

export default function ForgotPasswordClient() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not process reset request')
        setLoading(false)
        return
      }
      setDone(true)
      setLoading(false)
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <AdminLoginShell>
      <div className="admin-auth-card__brand">
        <p className="admin-auth-card__eyebrow">Commerce Operating System</p>
        <h1 className="admin-auth-card__title">{done ? 'Check your email' : 'Forgot password'}</h1>
        <p className="admin-auth-card__subtitle">
          {done
            ? 'If that email has staff access, a reset link was sent.'
            : 'Staff accounts only — Super Admin uses Telegram login.'}
        </p>
      </div>

      {done ? (
        <div className="admin-auth-form">
          <Link href="/login" className="admin-auth-submit" style={{ textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="admin-auth-form">
          <label className="admin-auth-field">
            <span className="admin-auth-label">Admin email</span>
            <div className="admin-auth-field__wrap">
              <span className="admin-auth-field__icon-chip" aria-hidden>
                <Mail className="h-4 w-4" strokeWidth={2} />
              </span>
              <input
                required
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="admin-auth-input"
              />
            </div>
          </label>

          {error ? (
            <div className="admin-auth-error" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <button type="submit" disabled={loading} className="admin-auth-submit">
            {loading ? (
              <Loader2 className="admin-auth-submit__spinner h-4 w-4" strokeWidth={2.5} />
            ) : null}
            {loading ? 'Sending…' : 'Send reset link'}
          </button>

          <Link href="/login" className="admin-auth-back">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </form>
      )}

      <div className="admin-auth-footer">
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
        Reset link expires in 1 hour
      </div>
    </AdminLoginShell>
  )
}
