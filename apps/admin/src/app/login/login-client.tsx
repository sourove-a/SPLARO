'use client'

import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ClipboardPaste,
  Loader2,
  Lock,
  Mail,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { AdminLoginShell } from '@/components/login/AdminLoginShell'
import { DEFAULT_ADMIN_EMAIL } from '@/lib/auth/admin-auth'
import { setAdminApiToken } from '@/lib/auth/api-token'

const LOGIN_EMAIL =
  process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL

const motionEase = [0.16, 1, 0.3, 1] as const

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
  const reduceMotion = useReducedMotion()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState(LOGIN_EMAIL)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenHint, setTokenHint] = useState<string | null>(null)

  const panelMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
      }
  const panelTransition = reduceMotion ? { duration: 0 } : { duration: 0.24, ease: motionEase }

  useEffect(() => {
    if (step === 'token') {
      const timer = window.setTimeout(() => tokenInputRef.current?.focus(), 120)
      return () => window.clearTimeout(timer)
    }
  }, [step])

  const requestLoginToken = async (targetEmail: string) => {
    const res = await fetch('/api/auth/request-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail }),
    })
    const data = (await res.json()) as { error?: string; tokenSent?: boolean }
    if (!res.ok) {
      throw new Error(data.error ?? 'No admin account found for this email')
    }
    setTokenHint('Login token sent to your Telegram. Tap Copy Token, then paste below.')
    return data
  }

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setTokenHint(null)

    try {
      await requestLoginToken(email)
      setStep('token')
      setToken('')
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  const handleResendToken = async () => {
    setLoading(true)
    setError(null)
    try {
      await requestLoginToken(email)
      setToken('')
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend token.')
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

  return (
    <AdminLoginShell>
      <div className="admin-auth-card__brand">
        <p className="admin-auth-card__eyebrow">Commerce Operating System</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} {...panelMotion} transition={panelTransition}>
            <h1 className="admin-auth-card__title">
              {step === 'email' ? 'Admin sign in' : 'Verify with Telegram'}
            </h1>
            <p className="admin-auth-card__subtitle">
              {step === 'email'
                ? 'Orders · Products · Finance · Courier · AI'
                : 'Secure one-time token via Telegram'}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === 'email' ? (
          <motion.form
            key="email"
            onSubmit={handleEmailSubmit}
            className="admin-auth-form"
            {...panelMotion}
            transition={panelTransition}
          >
            <label className="admin-auth-field">
              <span className="admin-auth-label">Admin email</span>
              <div className="admin-auth-field__wrap">
                <span className="admin-auth-field__icon-chip" aria-hidden>
                  <Mail className="h-4 w-4" strokeWidth={2} />
                </span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="splaro.bd@gmail.com"
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
              ) : (
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              )}
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </motion.form>
        ) : (
          <motion.form
            key="token"
            onSubmit={handleTokenSubmit}
            className="admin-auth-form"
            {...panelMotion}
            transition={panelTransition}
          >
            <div className="admin-auth-telegram">
              <p className="admin-auth-telegram__title">Check Telegram</p>
              <p className="admin-auth-telegram__text">
                {tokenHint ??
                  'Your one-time login token was sent to your linked SPLARO Telegram chat. Tap Copy Token in the bot message, then paste below.'}
              </p>
              <button
                type="button"
                onClick={() => void handleResendToken()}
                disabled={loading}
                className="admin-auth-telegram__btn"
              >
                <Send className="h-3 w-3" />
                {loading ? 'Sending…' : 'Resend token'}
              </button>
            </div>

            <div className="admin-auth-email-chip">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{email}</span>
            </div>

            <label className="admin-auth-field">
              <span className="admin-auth-label">Paste token</span>
              <div className="admin-auth-field__wrap">
                <span className="admin-auth-field__icon-chip" aria-hidden>
                  <ClipboardPaste className="h-4 w-4" strokeWidth={2} />
                </span>
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
              <p className="admin-auth-hint">Paste from Telegram — auto-login when complete</p>
            </label>

            {error ? (
              <div className="admin-auth-error" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || normalizeTokenInput(token).length < 8}
              className="admin-auth-submit"
            >
              {loading ? (
                <Loader2 className="admin-auth-submit__spinner h-4 w-4" strokeWidth={2.5} />
              ) : (
                <Lock className="h-4 w-4" strokeWidth={2.5} />
              )}
              {loading ? 'Signing in…' : 'Enter Commerce OS'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email')
                setError(null)
                setToken('')
              }}
              className="admin-auth-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Change email
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="admin-auth-footer">
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
        Telegram 2FA · One-time token · Audit logged
      </div>
    </AdminLoginShell>
  )
}
