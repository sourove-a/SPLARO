'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, Mail, Phone, UserRound } from 'lucide-react'
import { AnimatePresence, motion } from '@/lib/motion/react'
import { AuthField } from '@/components/auth/AuthField'
import { AuthModeSwitch } from '@/components/auth/AuthModeSwitch'
import { AuthSubmitButton } from '@/components/auth/AuthSubmitButton'
import {
  authFadeSlide,
  authFormMotion,
  authMotionTransition,
  useAuthShowMotion,
} from '@/lib/auth/auth-motion'
import { authFetch } from '@/lib/auth/auth-fetch'
import { invalidateAuthSessionReconcile } from '@/lib/api/session'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-destination'
import {
  buildSignupPhonePath,
  isSignupPhoneQuery,
} from '@/lib/auth/signup-phone-path'
import { loadCheckoutCustomerDraft } from '@/lib/checkout/customer-draft'
import { formatBdPhoneInput, getBdPhoneError, normalizeBdPhone } from '@/lib/checkout/phone'
import { useAuthStore } from '@/store/authStore'
import { useAuthGoogleBridge } from '@/components/auth/auth-google-bridge'
import { AuthGoogleGlassFooter } from '@/components/auth/AuthGoogleGlassFooter'
import { useStorefrontAuthConfig } from '@/hooks/useStorefrontAuthConfig'

type AuthMode = 'login' | 'signup'
type AuthStep = 'form' | 'google-phone'

function useAuthMode(): AuthMode {
  const pathname = usePathname()
  return pathname === '/signup' ? 'signup' : 'login'
}

function useAuthCopy(mode: AuthMode) {
  return useMemo(
    () =>
      mode === 'login'
        ? { title: 'Sign in', subtitle: 'Welcome back.' }
        : { title: 'Create account', subtitle: 'One account for orders and your bag.' },
    [mode],
  )
}

export function AuthExperience() {
  const { phoneOtpEnabled } = useStorefrontAuthConfig()
  const mode = useAuthMode()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') ?? '/account'
  const phoneQuery = isSignupPhoneQuery(searchParams.get('phone'))
  const copy = useAuthCopy(mode)
  const showMotion = useAuthShowMotion()
  const fadeSlide = authFadeSlide(!showMotion)
  const formMotion = authFormMotion(!showMotion)
  const motionTransition = authMotionTransition(!showMotion, 0.22)
  const formTransition = authMotionTransition(!showMotion, 0.24)

  const signIn = useAuthStore((state) => state.signIn)
  const signUp = useAuthStore((state) => state.signUp)
  const signOut = useAuthStore((state) => state.signOut)
  const user = useAuthStore((state) => state.user)
  const authHydrated = useAuthStore((state) => state._hydrated)
  const { setStep: setGoogleStep, registerGoogleHandler, setGoogleError } = useAuthGoogleBridge()

  // Single source of truth — incomplete Google signup always shows the phone step.
  const showPhoneStep = Boolean(user?.needsPhone)
  const step: AuthStep = showPhoneStep ? 'google-phone' : 'form'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [successCopy, setSuccessCopy] = useState('')
  const [googleName, setGoogleName] = useState(
    () => useAuthStore.getState().user?.name ?? '',
  )
  const [phoneTaken, setPhoneTaken] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpDevHint, setOtpDevHint] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const phoneInputRef = useRef<HTMLInputElement | null>(null)

  // Login ↔ signup share AuthExperience. Never wipe an in-progress phone step.
  useEffect(() => {
    if (useAuthStore.getState().user?.needsPhone) return
    setError('')
    setRedirecting(false)
    setSuccessCopy('')
    setGoogleStep('form')
    setOtpCode('')
    setOtpSent(false)
    setOtpDevHint('')
    setGoogleError('')
  }, [mode, setGoogleStep, setGoogleError])

  // Already signed in — skip login/signup UI (except incomplete Google phone step).
  useEffect(() => {
    if (!authHydrated || !user || user.needsPhone) return
    const destination = resolvePostAuthDestination(nextPath, mode)
    setSuccessCopy('Already signed in — taking you there…')
    setRedirecting(true)
    safeClientNavigate(router, destination, 'replace')
  }, [authHydrated, user, nextPath, mode, router])

  useEffect(() => {
    if (mode !== 'login') return
    router.prefetch('/forgot-password')
  }, [mode, router])

  // Bridge + greeting stay in sync with needsPhone (hydrate / Google / One Tap).
  useEffect(() => {
    if (!user?.needsPhone) {
      setGoogleStep('form')
      return
    }
    setGoogleName(user.name || '')
    setGoogleStep('google-phone')
  }, [user?.needsPhone, user?.name, setGoogleStep])

  // Stale ?phone=1 after complete/cancel — drop query so UI isn't stuck.
  useEffect(() => {
    if (!phoneQuery || !authHydrated || user?.needsPhone) return
    if (mode !== 'signup') return
    const dest =
      nextPath && nextPath !== '/account'
        ? `/signup?next=${encodeURIComponent(nextPath)}`
        : '/signup'
    safeClientNavigate(router, dest, 'replace')
  }, [phoneQuery, authHydrated, user?.needsPhone, mode, nextPath, router])

  // Account already carries a phone (missing Customer row, not missing number) —
  // prefill so the user confirms instead of retyping it.
  useEffect(() => {
    if (!showPhoneStep) return
    const existing = user?.phone?.trim()
    if (!existing) return
    setPhone((current) => current || formatBdPhoneInput(existing))
  }, [showPhoneStep, user?.phone])

  // Soft-focus after paint — autoFocus can white-flash mobile keyboards.
  useEffect(() => {
    if (!showPhoneStep) return
    const id = window.requestAnimationFrame(() => {
      phoneInputRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(id)
  }, [showPhoneStep])

  useEffect(() => {
    if (nextPath !== '/checkout' || mode !== 'signup' || showPhoneStep) return
    const draft = loadCheckoutCustomerDraft()
    if (draft.name) setName(draft.name)
    if (draft.email) setEmail(draft.email)
    if (draft.phone) setPhone(formatBdPhoneInput(draft.phone))
  }, [mode, nextPath, showPhoneStep])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: identifier.trim(), password }),
      })
      const payload = (await response.json()) as {
        user?: { id: string; name: string; email: string; phone: string; needsPhone?: boolean }
        error?: string
      }

      if (!response.ok || !payload.user) {
        setError(payload.error ?? 'Unable to sign in.')
        return
      }

      invalidateAuthSessionReconcile()
      signIn(payload.user)

      if (payload.user.needsPhone) {
        setGoogleName(payload.user.name)
        setPhone('')
        setGoogleStep('google-phone')
        safeClientNavigate(router, buildSignupPhonePath(nextPath), 'replace')
        return
      }

      const destination = resolvePostAuthDestination(nextPath, 'login')
      setSuccessCopy('Signed in — taking you there…')
      setRedirecting(true)
      safeClientNavigate(router, destination, 'replace')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const finishAuth = useCallback(
    (authed: { id?: string; name: string; email: string; phone: string }, authMode: AuthMode) => {
      invalidateAuthSessionReconcile()
      setGoogleStep('form')
      if (authMode === 'signup') {
        signUp(authed)
        window.localStorage.setItem(
          'splaro-customer',
          JSON.stringify({
            name: authed.name,
            email: authed.email,
            phone: authed.phone,
          }),
        )
        setSuccessCopy(`Welcome, ${authed.name.split(' ')[0]}!`)
      } else {
        signIn(authed)
        setSuccessCopy('Signed in — taking you there…')
      }
      const destination = resolvePostAuthDestination(nextPath, authMode)
      setRedirecting(true)
      safeClientNavigate(router, destination, 'replace')
    },
    [nextPath, router, setGoogleStep, signIn, signUp],
  )

  const handleGoogle = useCallback(
    async (credential: string) => {
      setError('')
      setGoogleError('')
      try {
        const response = await authFetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ credential }),
        })
        const payload = (await response.json()) as {
          user?: { id: string; name: string; email: string; phone: string; needsPhone?: boolean }
          needsPhone?: boolean
          error?: string
        }

        if (!response.ok || !payload.user) {
          const message = payload.error ?? 'Google sign-in failed.'
          setError(message)
          setGoogleError(message)
          return
        }

        // Drop in-flight /api/auth/me that started before this cookie existed.
        invalidateAuthSessionReconcile()
        signIn(payload.user)

        if (payload.needsPhone || payload.user.needsPhone) {
          setGoogleName(payload.user.name)
          setPhone('')
          setOtpCode('')
          setOtpSent(false)
          setOtpDevHint('')
          setGoogleStep('google-phone')
          // Durable URL so remount / soft-nav still lands on phone step.
          const phonePath = buildSignupPhonePath(nextPath)
          if (typeof window !== 'undefined') {
            const here = `${window.location.pathname}${window.location.search}`
            if (here !== phonePath) {
              safeClientNavigate(router, phonePath, 'replace')
            }
          }
          return
        }

        finishAuth(payload.user, mode)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error. Please try again.'
        setError(message)
        setGoogleError(message)
      }
    },
    [finishAuth, mode, nextPath, router, setGoogleError, setGoogleStep, signIn],
  )

  useEffect(() => {
    registerGoogleHandler(handleGoogle)
    return () => registerGoogleHandler(null)
  }, [handleGoogle, registerGoogleHandler])

  const handleSendOtp = async () => {
    const phoneError = getBdPhoneError(phone)
    if (phoneError) {
      setError(phoneError)
      return
    }
    setError('')
    setSendingOtp(true)
    try {
      const normalized = normalizeBdPhone(phone)
      const response = await authFetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: normalized }),
      })
      const payload = (await response.json()) as { sent?: boolean; devCode?: string; error?: string }
      if (!response.ok || !payload.sent) {
        setError(payload.error ?? 'Could not send verification code.')
        setSendingOtp(false)
        return
      }
      setOtpSent(true)
      if (payload.devCode) setOtpDevHint(payload.devCode)
      setSendingOtp(false)
    } catch {
      setError('Network error. Please try again.')
      setSendingOtp(false)
    }
  }

  const handleCompleteGooglePhone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const phoneError = getBdPhoneError(phone)
    if (phoneError) {
      setError(phoneError)
      return
    }
    if (phoneOtpEnabled && !otpCode.trim()) {
      setError('Enter the verification code sent to your phone.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const response = await authFetch('/api/auth/complete-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: normalizeBdPhone(phone),
          ...(phoneOtpEnabled ? { code: otpCode.trim() } : {}),
        }),
      })
      const payload = (await response.json()) as {
        user?: { id: string; name: string; email: string; phone: string }
        error?: string
        code?: string
      }

      if (!response.ok || !payload.user) {
        setError(payload.error ?? 'Could not complete signup.')
        // The number belongs to another account — offer a way out instead of
        // leaving the shopper stuck on a step they cannot pass.
        setPhoneTaken(payload.code === 'phone_taken')
        return
      }

      finishAuth(payload.user, 'signup')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const phoneError = getBdPhoneError(phone)
    if (phoneError) {
      setError(phoneError)
      return
    }
    if (signupPassword.length < 8 || !/[A-Za-z]/.test(signupPassword) || !/\d/.test(signupPassword)) {
      setError('Password must be at least 8 characters and include a letter and a number.')
      return
    }
    setLoading(true)

    try {
      const response = await authFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: normalizeBdPhone(phone),
          password: signupPassword,
        }),
      })
      const payload = (await response.json()) as {
        user?: { id: string; name: string; email: string; phone: string }
        error?: string
      }

      if (!response.ok || !payload.user) {
        setError(payload.error ?? 'Unable to create account.')
        return
      }

      invalidateAuthSessionReconcile()
      signUp(payload.user)
      window.localStorage.setItem(
        'splaro-customer',
        JSON.stringify({
          name: payload.user.name,
          email: payload.user.email,
          phone: payload.user.phone,
        }),
      )
      setSuccessCopy(`Welcome, ${payload.user.name.split(' ')[0]}!`)
      setRedirecting(true)
      safeClientNavigate(router, resolvePostAuthDestination(nextPath, 'signup'), 'replace')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loginFields = (
    <>
      <AuthField
        required
        type="text"
        value={identifier}
        onChange={(event) => setIdentifier(event.target.value)}
        placeholder="Phone number or email"
        autoComplete="username"
        trailing={
          <span className="auth-field__icon-chip">
            <UserRound className="h-4 w-4" strokeWidth={2.1} />
          </span>
        }
      />
      <AuthField
        required
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        autoComplete="current-password"
      />

      <div className="auth-form__row">
        <Link
          href="/forgot-password"
          className="auth-link auth-link--muted"
          prefetch
          onClick={(event) => {
            event.preventDefault()
            safeClientNavigate(router, '/forgot-password')
          }}
        >
          Forgot password?
        </Link>
      </div>

      {error && mode === 'login' ? <p className="auth-form__error">{error}</p> : null}

      <AuthSubmitButton loading={loading} loadingLabel="Signing in…">
        Sign in
      </AuthSubmitButton>

      <AuthGoogleGlassFooter placement="in-card" />
    </>
  )

  const signupFields = (
    <>
      <AuthField
        required
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Full name"
        autoComplete="name"
        trailing={
          <span className="auth-field__icon-chip">
            <UserRound className="h-4 w-4" strokeWidth={2.1} />
          </span>
        }
      />
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
      <AuthField
        required
        type="tel"
        inputMode="numeric"
        value={phone}
        onChange={(event) => setPhone(formatBdPhoneInput(event.target.value))}
        placeholder="01XXXXXXXXX"
        autoComplete="tel-national"
        trailing={
          <span className="auth-field__icon-chip">
            <Phone className="h-4 w-4" strokeWidth={2.1} />
          </span>
        }
      />
      <AuthField
        required
        type="password"
        value={signupPassword}
        onChange={(event) => setSignupPassword(event.target.value)}
        placeholder="Password (min 8 characters)"
        autoComplete="new-password"
        minLength={8}
      />

      {error && mode === 'signup' ? <p className="auth-form__error">{error}</p> : null}

      <AuthSubmitButton loading={loading} loadingLabel="Creating account…">
        Create account
      </AuthSubmitButton>

      <AuthGoogleGlassFooter placement="in-card" />

      <p className="auth-card__legal">
        By creating an account, you agree to our{' '}
        <Link href="/terms" className="auth-link auth-link--legal">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="auth-link auth-link--legal">
          Privacy Policy
        </Link>
        .
      </p>
    </>
  )

  const leavePhoneStep = async (destination: string) => {
    setError('')
    await signOut()
    setPhone('')
    setOtpCode('')
    setOtpSent(false)
    setOtpDevHint('')
    setGoogleName('')
    setPhoneTaken(false)
    setGoogleStep('form')
    setGoogleError('')
    invalidateAuthSessionReconcile()
    safeClientNavigate(router, destination, 'replace')
  }

  const handleCancelGooglePhone = () => leavePhoneStep('/signup')

  /** The number is on another account — drop this half-made session and sign in there. */
  const handleSignInInstead = () =>
    leavePhoneStep(
      nextPath && nextPath !== '/account'
        ? `/login?next=${encodeURIComponent(nextPath)}`
        : '/login',
    )

  const googlePhoneFields = (
    <>
      <p className="auth-card__subtitle auth-card__subtitle--phone-step">
        Hi {googleName.split(' ')[0] || user?.name?.split(' ')[0] || 'there'} — one last step. Add
        your Bangladesh mobile so we can confirm orders and delivery.
      </p>
      <p className="auth-form__hint">Use 01XXXXXXXXX (11 digits).</p>
      <AuthField
        required
        type="tel"
        inputMode="numeric"
        inputRef={phoneInputRef}
        value={phone}
        onChange={(event) => {
          setPhone(formatBdPhoneInput(event.target.value))
          // Typing a different number clears the "belongs to another account" branch.
          if (phoneTaken) setPhoneTaken(false)
        }}
        placeholder="01XXXXXXXXX"
        autoComplete="tel-national"
        trailing={
          <span className="auth-field__icon-chip">
            <Phone className="h-4 w-4" strokeWidth={2.1} />
          </span>
        }
      />
      {phoneOtpEnabled ? (
        <>
          <button
            type="button"
            className="auth-link auth-link--muted auth-otp-send"
            onClick={() => void handleSendOtp()}
            disabled={sendingOtp || loading}
          >
            {sendingOtp ? 'Sending code…' : otpSent ? 'Resend verification code' : 'Send verification code'}
          </button>
          {otpDevHint ? <p className="auth-form__dev-hint">Dev code: {otpDevHint}</p> : null}
          <AuthField
            required
            type="text"
            inputMode="numeric"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            autoComplete="one-time-code"
          />
        </>
      ) : null}
      {error ? <p className="auth-form__error">{error}</p> : null}
      {phoneTaken ? (
        <div className="auth-form__recovery">
          <p className="auth-form__hint">
            Already ordered with this number? Sign in to that account instead.
          </p>
          <div className="auth-form__recovery-actions">
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className="auth-link"
              onClick={(event) => {
                event.preventDefault()
                void handleSignInInstead()
              }}
            >
              Sign in to that account
            </Link>
            <Link href="/forgot-password" className="auth-link auth-link--muted">
              Forgot password?
            </Link>
          </div>
        </div>
      ) : null}
      <AuthSubmitButton loading={loading} loadingLabel="Saving…">
        Save phone & continue
      </AuthSubmitButton>
      <button
        type="button"
        className="auth-link auth-link--muted auth-google-phone-cancel"
        onClick={() => void handleCancelGooglePhone()}
        disabled={loading}
      >
        Use a different account
      </button>
    </>
  )

  const heading = (
    <>
      <h1 className="auth-card__title">{copy.title}</h1>
      <p className="auth-card__subtitle">{copy.subtitle}</p>
    </>
  )

  const successPanel = (
    <>
      <span className="auth-success__icon" aria-hidden="true">
        <Check className="h-5 w-5" strokeWidth={2.4} />
      </span>
      <p className="auth-success__title">{successCopy}</p>
      <p className="auth-success__hint">One moment…</p>
    </>
  )

  const renderForm = (
    fields: React.ReactNode,
    formKey: string,
    onSubmit: (event: FormEvent<HTMLFormElement>) => void,
  ) => {
    // Phone step: no enter/exit motion — GIS teardown + AnimatePresence wait
    // previously left an empty (white) card on first Google signup.
    if (showMotion && formKey !== 'google-phone') {
      return (
        <motion.form
          key={formKey}
          onSubmit={onSubmit}
          className="auth-form"
          {...formMotion}
          transition={formTransition}
        >
          {fields}
        </motion.form>
      )
    }

    return (
      <form key={formKey} onSubmit={onSubmit} className="auth-form auth-form--stable">
        {fields}
      </form>
    )
  }

  const bodyContent = redirecting ? (
    showMotion ? (
      <motion.div
        key="auth-success"
        className="auth-success"
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 1 }}
        transition={motionTransition}
        aria-live="polite"
      >
        {successPanel}
      </motion.div>
    ) : (
      <div className="auth-success" aria-live="polite">
        {successPanel}
      </div>
    )
  ) : showPhoneStep ? (
    renderForm(googlePhoneFields, 'google-phone', handleCompleteGooglePhone)
  ) : mode === 'login' ? (
    renderForm(loginFields, 'login', handleLogin)
  ) : (
    renderForm(signupFields, 'signup', handleSignup)
  )

  return (
    <div className="auth-card" data-auth-step={step}>
      {showPhoneStep ? null : <AuthModeSwitch nextPath={nextPath} />}

      {showPhoneStep ? (
        <div className="auth-card__heading" aria-live="polite">
          <h1 className="auth-card__title">Finish with your phone</h1>
        </div>
      ) : (
        <div className="auth-card__heading" aria-live="polite">
          {showMotion ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={mode} {...fadeSlide} transition={motionTransition}>
                {heading}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div>{heading}</div>
          )}
        </div>
      )}

      <div className="auth-card__body">
        {showMotion && !showPhoneStep && !redirecting ? (
          <AnimatePresence mode="wait" initial={false}>
            {bodyContent}
          </AnimatePresence>
        ) : (
          bodyContent
        )}
      </div>
    </div>
  )
}
