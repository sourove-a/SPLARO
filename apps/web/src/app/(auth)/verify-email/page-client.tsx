'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'

export default function VerifyEmailPageClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your email…')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Missing verification link. Request a new one from your account.')
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/auth/email-verification/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string; email?: string }
        if (cancelled) return
        if (!res.ok) {
          setStatus('error')
          setMessage(data.error ?? 'Invalid or expired verification link')
          return
        }
        setStatus('ok')
        setMessage(data.email ? `Verified ${data.email}` : 'Email verified successfully')
      } catch {
        if (!cancelled) {
          setStatus('error')
          setMessage('Network error. Please try again.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="auth-card">
      <div className="auth-card__heading">
        <h1 className="auth-card__title">
          {status === 'loading' ? 'Verifying…' : status === 'ok' ? 'Email verified' : 'Link expired'}
        </h1>
        <p className="auth-card__subtitle">{message}</p>
      </div>
      <div className="auth-card__body" style={{ display: 'grid', gap: '1rem', placeItems: 'center', paddingTop: '0.5rem' }}>
        {status === 'loading' ? (
          <Loader2 className="h-8 w-8 animate-spin" strokeWidth={2} aria-hidden />
        ) : status === 'ok' ? (
          <CheckCircle2 className="h-10 w-10" strokeWidth={1.6} aria-hidden />
        ) : (
          <ShieldAlert className="h-10 w-10" strokeWidth={1.6} aria-hidden />
        )}
      </div>
      <p className="auth-card__legal">
        <Link href="/account" className="auth-link">
          Go to account
        </Link>
        {' · '}
        <Link href="/login" className="auth-link">
          Sign in
        </Link>
      </p>
    </div>
  )
}
