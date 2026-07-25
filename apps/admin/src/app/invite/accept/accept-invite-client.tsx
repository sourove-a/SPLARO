'use client'

import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { AdminLoginShell } from '@/components/login/AdminLoginShell'
import { setAdminApiToken } from '@/lib/auth/api-token'

type InvitePreview = {
  emailMasked?: string
  role?: string
  firstName?: string
  expiresAt?: string
}

export default function AcceptInviteClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''

  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setPreviewError('Missing invite token — open the link from your email')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/auth/invite/${encodeURIComponent(token)}`)
        const data = (await res.json()) as InvitePreview & { error?: string }
        if (cancelled) return
        if (!res.ok) {
          setPreviewError(data.error ?? 'Invalid or expired invite')
          return
        }
        setPreview(data)
        if (data.firstName) setFirstName(data.firstName)
      } catch {
        if (!cancelled) setPreviewError('Unable to load invite')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) {
      setError('Missing invite token')
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
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        }),
      })
      const data = (await res.json()) as { error?: string; apiToken?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not accept invite')
        setLoading(false)
        return
      }
      if (data.apiToken) setAdminApiToken(data.apiToken)
      router.replace('/dashboard')
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <AdminLoginShell>
      <div className="admin-auth-card__brand">
        <p className="admin-auth-card__eyebrow">Commerce Operating System</p>
        <h1 className="admin-auth-card__title">Accept invite</h1>
        <p className="admin-auth-card__subtitle">
          {preview
            ? `Set a password for ${preview.emailMasked ?? 'your account'}${preview.role ? ` · ${preview.role}` : ''}`
            : 'Verify your invite and create a password'}
        </p>
      </div>

      {previewError ? (
        <div className="admin-auth-form">
          <div className="admin-auth-error" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {previewError}
          </div>
          <Link href="/login" className="admin-auth-submit" style={{ textDecoration: 'none' }}>
            Go to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="admin-auth-form">
          <label className="admin-auth-field">
            <span className="admin-auth-label">First name</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="admin-auth-input"
              placeholder="Your name"
              style={{ paddingLeft: 16 }}
            />
          </label>

          <label className="admin-auth-field">
            <span className="admin-auth-label">Password</span>
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

          <button type="submit" disabled={loading || !preview} className="admin-auth-submit">
            {loading ? (
              <Loader2 className="admin-auth-submit__spinner h-4 w-4" strokeWidth={2.5} />
            ) : null}
            {loading ? 'Activating…' : 'Activate account'}
          </button>
        </form>
      )}

      <div className="admin-auth-footer">
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
        Invite expires in 48 hours
      </div>
    </AdminLoginShell>
  )
}
