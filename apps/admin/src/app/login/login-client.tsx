'use client'

import type { ClipboardEvent, FormEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ClipboardPaste,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { AdminLoginShell } from '@/components/login/AdminLoginShell'
import { setAdminApiToken } from '@/lib/auth/api-token'

const motionEase = [0.16, 1, 0.3, 1] as const

/** Mirrors TOKEN_TTL_MS in AdminLoginTokenService — display only. */
const LOGIN_TOKEN_TTL_MS = 10 * 60 * 1000

type Step = 'email' | 'token' | 'password'

function normalizeTokenInput(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
}

/**
 * Pull the code out of whatever was pasted — the bare token, the "Token: XXXX-XXXX"
 * line, or the whole Telegram message copied by hand.
 */
function extractLoginToken(pasted: string): string {
  const text = pasted.trim().toUpperCase()

  const labelled = text.match(/TOKEN[:\s]+([A-Z0-9]{4})[-\s]?([A-Z0-9]{4})\b/)
  if (labelled) return `${labelled[1]}${labelled[2]}`

  const hyphenated = text.match(/\b([A-Z0-9]{4})-([A-Z0-9]{4})\b/)
  if (hyphenated) return `${hyphenated[1]}${hyphenated[2]}`

  const compact = normalizeTokenInput(text)
  // Only trust an unlabelled blob when it is exactly the code, never a prefix of prose.
  return text.replace(/[^A-Z0-9]/g, '').length === 8 ? compact : ''
}

function formatTokenDisplay(value: string): string {
  const raw = normalizeTokenInput(value)
  if (raw.length <= 4) return raw
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Owns its own 1s tick so the page component never re-renders once a second —
 * the step forms stay stable while the admin is reading the code.
 */
function TokenExpiryHint({ expiresAt }: { expiresAt: number | null }) {
  const [msLeft, setMsLeft] = useState(() => (expiresAt ? expiresAt - Date.now() : 0))

  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setMsLeft(expiresAt - Date.now())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [expiresAt])

  if (!expiresAt) {
    return <p className="admin-auth-hint">Paste the code and it signs you in instantly.</p>
  }

  return (
    <p className="admin-auth-hint">
      {msLeft <= 0
        ? 'This code expired — tap Resend token for a fresh one.'
        : `Paste the code and it signs you in instantly. Expires in ${formatCountdown(msLeft)}.`}
    </p>
  )
}

export default function AdminLoginPage() {
  const searchParams = useSearchParams()
  const requestedNext = searchParams.get('next')
  const next = requestedNext?.startsWith('/dashboard') ? requestedNext : '/dashboard'
  const tokenInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const verifyInFlight = useRef(false)
  const prefersReducedMotion = useReducedMotion()
  const [motionReady, setMotionReady] = useState(false)
  const showMotion = motionReady && !prefersReducedMotion

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null)
  /** One-time codes: never auto-fire the same value twice (paste + effect + Enter). */
  const autoSubmittedRef = useRef<string | null>(null)

  // Enter-only. An exit animation gated behind AnimatePresence mode="wait" cannot
  // finish while the tab is hidden (rAF is paused) — and this flow sends the admin
  // to Telegram mid-step, which froze the card on the previous form.
  const panelMotion = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
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

  const requestLoginToken = async (targetEmail: string) => {
    const res = await fetch('/api/auth/request-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail }),
    })
    const data = (await res.json()) as {
      error?: string
      email?: string
      method?: 'telegram' | 'password'
      tokenSent?: boolean
    }
    if (!res.ok) {
      throw new Error(data.error ?? 'Could not send Telegram token. Try again in a moment.')
    }
    autoSubmittedRef.current = null
    setTokenExpiresAt(Date.now() + LOGIN_TOKEN_TTL_MS)
    return {
      method: data.method === 'password' ? ('password' as const) : ('telegram' as const),
      email: data.email?.trim() || targetEmail.trim().toLowerCase(),
    }
  }

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // One round trip: the API resolves the method and sends the code in the
      // same call, so a Telegram admin reaches the code field ~250ms sooner.
      const resolved = await requestLoginToken(email)
      setEmail(resolved.email)
      if (resolved.method === 'telegram') {
        setStep('token')
        setToken('')
      } else {
        setStep('password')
        setPassword('')
        setPasswordVisible(false)
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
    // Single in-flight verify — the auto-submit effect and the Verify button can
    // both reach here for the same keystroke, and the code only works once.
    if (verifyInFlight.current) return
    verifyInFlight.current = true
    autoSubmittedRef.current = normalized

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), token: normalized }),
      })
      const data = (await res.json()) as { error?: string; message?: string; apiToken?: string }
      if (!res.ok) {
        setError(data.error ?? data.message ?? 'Invalid or expired token. Tap Resend token.')
        setToken('')
        setLoading(false)
        verifyInFlight.current = false
        window.setTimeout(() => tokenInputRef.current?.focus(), 0)
        return
      }
      if (data.apiToken) setAdminApiToken(data.apiToken)
      setSignedIn(true)
      // Hard navigate — soft replace can race middleware live-session probe and
      // drop the user back on /login with a confusing error.
      window.location.assign(next)
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
      verifyInFlight.current = false
    }
  }

  // Complete code in the field → verify immediately. Paste, type, or OTP autofill
  // all land here, so there is one submit path instead of three.
  useEffect(() => {
    if (step !== 'token') return
    const normalized = normalizeTokenInput(token)
    if (normalized.length < 8) return
    if (loading || verifyInFlight.current) return
    if (autoSubmittedRef.current === normalized) return
    void submitToken(normalized)
    // submitToken is recreated every render; token/step/loading drive the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, step, loading])

  const handleTokenSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitToken(token)
  }

  /** One tap: read the clipboard and verify without a manual paste. */
  const handlePasteFromClipboard = async () => {
    if (loading || verifyInFlight.current) return
    try {
      const text = await navigator.clipboard.readText()
      const extracted = extractLoginToken(text)
      if (extracted.length !== 8) {
        setError('No 8-character code found on the clipboard. Copy it from Telegram and try again.')
        tokenInputRef.current?.focus()
        return
      }
      setError(null)
      setToken(extracted)
    } catch {
      setError('Clipboard is blocked by the browser — paste into the field instead.')
      tokenInputRef.current?.focus()
    }
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
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = (await res.json()) as { error?: string; message?: string; apiToken?: string }
      if (!res.ok) {
        setError(data.error ?? data.message ?? 'Invalid email or password')
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

  // Accepts the bare code or the whole Telegram message; the auto-submit effect
  // (guarded against double-fire) verifies as soon as 8 characters are in.
  const handleTokenPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const extracted = extractLoginToken(event.clipboardData.getData('text'))
    if (extracted.length === 8) {
      event.preventDefault()
      setToken(extracted)
      setError(null)
    }
  }

  const backToEmail = () => {
    setStep('email')
    setError(null)
    setToken('')
    setPassword('')
    setPasswordVisible(false)
    setTokenExpiresAt(null)
    autoSubmittedRef.current = null
  }

  const stepCopy =
    step === 'email'
      ? {
          title: 'Welcome back',
          subtitle: 'Enter your work email. SPLARO will choose your secure sign-in method.',
        }
      : step === 'token'
        ? {
            title: 'Check Telegram',
            subtitle: 'Enter the 8-character code sent to your linked personal chat.',
          }
        : {
            title: 'Enter your password',
            subtitle: 'Manager and Editor accounts continue with their account password.',
          }

  const emailFields = (
    <>
      <label className="admin-auth-field">
        <span className="admin-auth-label">Work email</span>
        <div className="admin-auth-field__wrap">
          <span className="admin-auth-field__icon-chip" aria-hidden>
            <Mail className="h-4 w-4" strokeWidth={2} />
          </span>
          <input
            required
            type="email"
            autoComplete="username"
            autoFocus
            inputMode="email"
            placeholder="name@splaro.co"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="admin-auth-input"
          />
        </div>
      </label>

      <p className="admin-auth-hint">
        No method choice needed. Account policy selects Telegram code or password after email check.
      </p>

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
        {loading ? 'Checking access…' : 'Continue securely'}
      </button>
    </>
  )

  const tokenFields = (
    <>
      <div className="admin-auth-method-result admin-auth-method-result--telegram">
        <span className="admin-auth-method-result__icon" aria-hidden>
          <Send className="h-4 w-4" strokeWidth={2} />
        </span>
        <span>
          <strong>Telegram verification</strong>
          <small>Owner and Admin access</small>
        </span>
      </div>

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
            className="admin-auth-input admin-auth-input--token"
            spellCheck={false}
            autoCapitalize="characters"
            disabled={signedIn}
          />
        </div>
        <TokenExpiryHint expiresAt={tokenExpiresAt} />
      </label>

      <div className="admin-auth-token-actions">
        <button
          type="button"
          onClick={() => void handlePasteFromClipboard()}
          disabled={loading || signedIn}
          className="admin-auth-back"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Paste code
        </button>
        <button
          type="button"
          onClick={() => void handleResendToken()}
          disabled={loading || signedIn}
          className="admin-auth-back"
        >
          {loading && !signedIn ? 'Sending…' : 'Resend token'}
        </button>
      </div>

      {error ? (
        <div className="admin-auth-error" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading || signedIn || normalizeTokenInput(token).length < 8}
        className="admin-auth-submit"
      >
        {loading || signedIn ? (
          <Loader2 className="admin-auth-submit__spinner h-4 w-4" strokeWidth={2.5} />
        ) : (
          <Lock className="h-4 w-4" strokeWidth={2.5} />
        )}
        {signedIn ? 'Opening dashboard…' : loading ? 'Verifying…' : 'Verify and enter'}
      </button>

      <button
        type="button"
        onClick={backToEmail}
        disabled={signedIn}
        className="admin-auth-back"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Change email
      </button>
    </>
  )

  const passwordFields = (
    <>
      <div className="admin-auth-method-result admin-auth-method-result--password">
        <span className="admin-auth-method-result__icon" aria-hidden>
          <Lock className="h-4 w-4" strokeWidth={2} />
        </span>
        <span>
          <strong>Password verification</strong>
          <small>Manager and Editor access</small>
        </span>
      </div>

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
            type={passwordVisible ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="admin-auth-input"
            minLength={8}
          />
          <button
            type="button"
            className="admin-auth-password-toggle"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            title={passwordVisible ? 'Hide password' : 'Show password'}
          >
            {passwordVisible ? (
              <EyeOff className="h-4 w-4" strokeWidth={2} />
            ) : (
              <Eye className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
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
        <div className="admin-auth-progress" aria-label={`Sign-in step ${step === 'email' ? 1 : 2} of 2`}>
          <span className="admin-auth-progress__label">
            {step === 'email' ? '01 · Identity' : '02 · Verification'}
          </span>
          <span className="admin-auth-progress__track" aria-hidden>
            <i />
            <i className={step === 'email' ? undefined : 'is-active'} />
          </span>
        </div>
        {showMotion ? (
          <motion.div key={step} {...panelMotion} transition={panelTransition}>
            <h1 className="admin-auth-card__title">{stepCopy.title}</h1>
            <p className="admin-auth-card__subtitle">{stepCopy.subtitle}</p>
          </motion.div>
        ) : (
          <div>
            <h1 className="admin-auth-card__title">{stepCopy.title}</h1>
            <p className="admin-auth-card__subtitle">{stepCopy.subtitle}</p>
          </div>
        )}
      </div>

      {activeForm}

      <div className="admin-auth-footer">
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
        {step === 'email'
          ? 'Adaptive sign-in · role policy protected'
          : step === 'token'
            ? 'Personal Telegram · one-time code'
            : 'Encrypted password · protected session'}
      </div>
    </AdminLoginShell>
  )
}
