'use client'

import type { ClipboardEvent, FormEvent, KeyboardEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ClipboardPaste,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { AdminLoginShell } from '@/components/login/AdminLoginShell'
import { setAdminApiToken } from '@/lib/auth/api-token'

const motionEase = [0.16, 1, 0.3, 1] as const

type Step = 'email' | 'token' | 'password'

function normalizeTokenInput(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
}

function formatTokenDisplay(value: string): string {
  const raw = normalizeTokenInput(value)
  if (raw.length <= 4) return raw
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

export default function AdminLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedNext = searchParams.get('next')
  const next = requestedNext?.startsWith('/dashboard') ? requestedNext : '/dashboard'
  const tokenInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [motionReady, setMotionReady] = useState(false)
  const showMotion = motionReady && !prefersReducedMotion

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const panelMotion = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  }
  const panelTransition = { duration: 0.24, ease: motionEase }

  useEffect(() => {
    setMotionReady(true)
  }, [])

  useEffect(() => {
    if (step === 'token') {
      const timer = window.setTimeout(() => tokenInputRef.current?.focus(), 120)
      return () => window.clearTimeout(timer)
    }
    if (step === 'password') {
      const timer = window.setTimeout(() => passwordInputRef.current?.focus(), 120)
      return () => window.clearTimeout(timer)
    }
  }, [step])

  const resolveLoginMethod = async (targetEmail: string) => {
    const res = await fetch('/api/auth/login-method', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail }),
    })
    const data = (await res.json()) as { error?: string; method?: 'telegram' | 'password' }
    if (!res.ok || (data.method !== 'telegram' && data.method !== 'password')) {
      throw new Error(data.error ?? 'No admin account found for this email')
    }
    return data.method
  }

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
    return data
  }

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const method = await resolveLoginMethod(email)
      if (method === 'telegram') {
        await requestLoginToken(email)
        setStep('token')
        setToken('')
      } else {
        setStep('password')
        setPassword('')
      }
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
      router.replace(next)
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  const handleTokenSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitToken(token)
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json()) as { error?: string; apiToken?: string }
      if (!res.ok) {
        setError(data.error ?? 'Invalid email or password')
        setLoading(false)
        return
      }
      if (data.apiToken) setAdminApiToken(data.apiToken)
      router.replace(next)
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
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

  const backToEmail = () => {
    setStep('email')
    setError(null)
    setToken('')
    setPassword('')
  }

  const stepCopy =
    step === 'email'
      ? {
          title: 'Admin sign in',
          subtitle: 'Orders · Products · Finance · Courier · AI',
        }
      : step === 'token'
        ? {
            title: 'Enter login token',
            subtitle: 'Telegram one-time token for Super Admin',
          }
        : {
            title: 'Enter password',
            subtitle: 'Staff accounts use email + password',
          }

  const emailFields = (
    <>
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
        ) : (
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        )}
        {loading ? 'Checking…' : 'Continue'}
      </button>
    </>
  )

  const tokenFields = (
    <>
      <div className="admin-auth-email-chip">
        <Mail className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{email}</span>
      </div>

      <label className="admin-auth-field">
        <span className="admin-auth-label">Login token</span>
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
        <p className="admin-auth-hint">Paste 8-character token — auto-login when complete</p>
      </label>

      <button
        type="button"
        onClick={() => void handleResendToken()}
        disabled={loading}
        className="admin-auth-back"
      >
        {loading ? 'Sending…' : 'Resend token'}
      </button>

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

      <button type="button" onClick={backToEmail} className="admin-auth-back">
        <ArrowLeft className="h-3.5 w-3.5" />
        Change email
      </button>
    </>
  )

  const passwordFields = (
    <>
      <div className="admin-auth-email-chip">
        <Mail className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{email}</span>
      </div>

      <label className="admin-auth-field">
        <span className="admin-auth-label">Password</span>
        <div className="admin-auth-field__wrap">
          <span className="admin-auth-field__icon-chip" aria-hidden>
            <Lock className="h-4 w-4" strokeWidth={2} />
          </span>
          <input
            ref={passwordInputRef}
            required
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="admin-auth-input"
            minLength={8}
          />
        </div>
      </label>

      <div className="flex justify-end">
        <Link
          href={`/forgot-password?email=${encodeURIComponent(email)}`}
          className="admin-auth-back"
          style={{ marginTop: 0 }}
        >
          Forgot password?
        </Link>
      </div>

      {error ? (
        <div className="admin-auth-error" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <button type="submit" disabled={loading || password.length < 8} className="admin-auth-submit">
        {loading ? (
          <Loader2 className="admin-auth-submit__spinner h-4 w-4" strokeWidth={2.5} />
        ) : (
          <Lock className="h-4 w-4" strokeWidth={2.5} />
        )}
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <button type="button" onClick={backToEmail} className="admin-auth-back">
        <ArrowLeft className="h-3.5 w-3.5" />
        Change email
      </button>
    </>
  )

  const renderStepForm = (
    children: ReactNode,
    formKey: Step,
    onSubmit: (e: FormEvent<HTMLFormElement>) => void,
  ) => {
    if (showMotion) {
      return (
        <motion.form
          key={formKey}
          onSubmit={onSubmit}
          className="admin-auth-form"
          {...panelMotion}
          transition={panelTransition}
        >
          {children}
        </motion.form>
      )
    }

    return (
      <form key={formKey} onSubmit={onSubmit} className="admin-auth-form">
        {children}
      </form>
    )
  }

  const activeForm =
    step === 'email'
      ? renderStepForm(emailFields, 'email', handleEmailSubmit)
      : step === 'token'
        ? renderStepForm(tokenFields, 'token', handleTokenSubmit)
        : renderStepForm(passwordFields, 'password', handlePasswordSubmit)

  return (
    <AdminLoginShell>
      <div className="admin-auth-card__brand">
        <p className="admin-auth-card__eyebrow">Commerce Operating System</p>
        {showMotion ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} {...panelMotion} transition={panelTransition}>
              <h1 className="admin-auth-card__title">{stepCopy.title}</h1>
              <p className="admin-auth-card__subtitle">{stepCopy.subtitle}</p>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div>
            <h1 className="admin-auth-card__title">{stepCopy.title}</h1>
            <p className="admin-auth-card__subtitle">{stepCopy.subtitle}</p>
          </div>
        )}
      </div>

      {showMotion ? (
        <AnimatePresence mode="wait" initial={false}>
          {activeForm}
        </AnimatePresence>
      ) : (
        activeForm
      )}

      <div className="admin-auth-footer">
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
        Super Admin · Telegram · Staff · password
      </div>
    </AdminLoginShell>
  )
}
