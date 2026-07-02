'use client'

import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ClipboardPaste,
  Lock,
  Mail,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { SplaroAdminLogo } from '@/components/brand/SplaroAdminLogo'
import { AdminLoginShell } from '@/components/login/AdminLoginShell'
import { DEFAULT_ADMIN_EMAIL } from '@/lib/auth/admin-auth'
import { setAdminApiToken } from '@/lib/auth/api-token'

const LOGIN_EMAIL =
  process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL

const TELEGRAM_BOT =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') || 'splaro_bot'

type Step = 'email' | 'token'

function normalizeTokenInput(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
}

function formatTokenDisplay(value: string): string {
  const raw = normalizeTokenInput(value)
  if (raw.length <= 4) return raw
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

export default function AdminLoginPage() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'
  const tokenInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState(LOGIN_EMAIL)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (step === 'token') {
      const timer = window.setTimeout(() => tokenInputRef.current?.focus(), 120)
      return () => window.clearTimeout(timer)
    }
  }, [step])

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/request-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'No admin account found for this email')
        setLoading(false)
        return
      }
      setStep('token')
      setToken('')
      setLoading(false)
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  const submitToken = async (rawToken: string) => {
    const normalized = normalizeTokenInput(rawToken)
    if (normalized.length < 8) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: normalized }),
      })
      const data = (await res.json()) as { error?: string; apiToken?: string }
      if (!res.ok) {
        setError(data.error ?? 'Invalid or expired token')
        setLoading(false)
        return
      }
      if (data.apiToken) setAdminApiToken(data.apiToken)
      window.location.assign(next)
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  const handleTokenSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitToken(token)
  }

  const handleTokenPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text')
    const normalized = normalizeTokenInput(pasted)
    if (normalized.length >= 8) {
      event.preventDefault()
      setToken(normalized)
      void submitToken(normalized)
    }
  }

  const handleTokenKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && normalizeTokenInput(token).length >= 8) {
      event.preventDefault()
      void submitToken(token)
    }
  }

  const telegramUrl = `https://t.me/${TELEGRAM_BOT}`

  return (
    <AdminLoginShell>
      <div className="admin-auth-card__brand">
        <SplaroAdminLogo variant="login" priority />
        <p className="admin-auth-card__eyebrow">Commerce Operating System</p>
        <h1 className="admin-auth-card__title">
          {step === 'email' ? 'Welcome back' : 'Verify with Telegram'}
        </h1>
        <p className="admin-auth-card__subtitle">
          {step === 'email'
            ? 'Orders · Products · Finance · Courier · AI'
            : 'Secure one-time token from SPLARO Bot'}
        </p>
      </div>

      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="admin-auth-form">
          <label>
            <span className="admin-auth-label">Admin Email</span>
            <div className="admin-auth-field">
              <Mail className="admin-auth-field__icon" />
              <input
                required
                type="email"
                autoComplete="email"
                placeholder="admin@splaro.com.bd"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="admin-auth-input"
              />
            </div>
          </label>

          {error ? (
            <div className="admin-auth-error">
              <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
              {error}
            </div>
          ) : null}

          <button type="submit" disabled={loading} className="admin-auth-submit">
            <ArrowRight style={{ width: 15, height: 15 }} strokeWidth={2.5} />
            {loading ? 'Checking…' : 'Continue to Login'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleTokenSubmit} className="admin-auth-form">
          <div className="admin-auth-telegram">
            <p className="admin-auth-telegram__title">Step 1 — Get token</p>
            <p className="admin-auth-telegram__text">
              Open <strong>@{TELEGRAM_BOT}</strong> → send{' '}
              <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 6, fontFamily: 'monospace' }}>/login</code>{' '}
              → tap <strong>Copy Token</strong>
            </p>
            <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="admin-auth-telegram__btn">
              <Send style={{ width: 12, height: 12 }} />
              Open SPLARO Bot
            </a>
          </div>

          <div className="admin-auth-email-chip">
            <Mail style={{ width: 13, height: 13, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
          </div>

          <label>
            <span className="admin-auth-label">Step 2 — Paste Token</span>
            <div className="admin-auth-field">
              <ClipboardPaste className="admin-auth-field__icon" />
              <input
                ref={tokenInputRef}
                required
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                placeholder="XXXX-XXXX"
                value={formatTokenDisplay(token)}
                onChange={(e) => setToken(normalizeTokenInput(e.target.value))}
                onPaste={handleTokenPaste}
                onKeyDown={handleTokenKeyDown}
                className="admin-auth-input admin-auth-input--token"
              />
            </div>
            <p className="admin-auth-hint">Paste from bot — auto-login when token is complete</p>
          </label>

          {error ? (
            <div className="admin-auth-error">
              <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || normalizeTokenInput(token).length < 8}
            className="admin-auth-submit"
          >
            <Lock style={{ width: 15, height: 15 }} strokeWidth={2.5} />
            {loading ? 'Signing in…' : 'Enter Commerce OS'}
          </button>

          <button
            type="button"
            onClick={() => { setStep('email'); setError(null); setToken('') }}
            className="admin-auth-back"
          >
            <ArrowLeft style={{ width: 13, height: 13 }} />
            Change email
          </button>
        </form>
      )}

      <div className="admin-auth-footer">
        <ShieldCheck style={{ width: 13, height: 13 }} strokeWidth={2} />
        Telegram 2FA · One-time token · Audit logged
      </div>
    </AdminLoginShell>
  )
}
