'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { AdminLoginShell } from '@/components/login/AdminLoginShell'

export default function ResetPasswordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) {
      setError('Missing reset token — open the link from your email')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        setError(data.error ?? 'Invalid or expired reset link')
        setLoading(false)
        return
      }
      router.replace('/login')
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <AdminLoginShell>
      <div className="admin-auth-card__brand">
        <p className="admin-auth-card__eyebrow">Commerce Operating System</p>
        <h1 className="admin-auth-card__title">Set new password</h1>
        <p className="admin-auth-card__subtitle">Choose a password for your staff admin account</p>
      </div>

      <form onSubmit={handleSubmit} className="admin-auth-form">
        <label className="admin-auth-field">
          <span className="admin-auth-label">New password</span>
          <div className="admin-auth-field__wrap">
            <span className="admin-auth-field__icon-chip" aria-hidden>
              <Lock className="h-4 w-4" strokeWidth={2} />
            </span>
            <input
              required
              type="password"
              autoComplete="new-password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-auth-input"
              minLength={8}
            />
          </div>
        </label>

        <label className="admin-auth-field">
          <span className="admin-auth-label">Confirm password</span>
          <div className="admin-auth-field__wrap">
            <span className="admin-auth-field__icon-chip" aria-hidden>
              <Lock className="h-4 w-4" strokeWidth={2} />
            </span>
            <input
              required
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="admin-auth-input"
              minLength={8}
            />
          </div>
        </label>

        {error ? (
          <div className="admin-auth-error" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={loading || !token} className="admin-auth-submit">
          {loading ? (
            <Loader2 className="admin-auth-submit__spinner h-4 w-4" strokeWidth={2.5} />
          ) : null}
          {loading ? 'Saving…' : 'Update password'}
        </button>

        <Link href="/login" className="admin-auth-back">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </form>

      <div className="admin-auth-footer">
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
        Secure password reset
      </div>
    </AdminLoginShell>
  )
}
