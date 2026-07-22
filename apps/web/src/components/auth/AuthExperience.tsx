'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, Mail, Phone, UserRound } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion } from '@/lib/motion/react'
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
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-destination'
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
  const [step, setStep] = useState<AuthStep>('form')
  const [googleName, setGoogleName] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpDevHint, setOtpDevHint] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)

  useEffect(() => {
    setError('')
    setRedirecting(false)
    setSuccessCopy('')
    setStep('form')
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

  // Resume incomplete Google signup (phone still required).
  useEffect(() => {
    const pending = useAuthStore.getState().user
    if (!pending?.needsPhone) return
    setGoogleName(pending.name)
    setStep('google-phone')
    setGoogleStep('google-phone')
  }, [mode, setGoogleStep])

  useEffect(() => {
    if (nextPath !== '/checkout' || mode !== 'signup') return
    const draft = loadCheckoutCustomerDraft()
    if (draft.name) setName(draft.name)
    if (draft.email) setEmail(draft.email)
    if (draft.phone) setPhone(formatBdPhoneInput(draft.phone))
  }, [mode, nextPath])

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
        user?: { id: string; name: string; email: string; phone: string }
        error?: string
      }

      if (!response.ok || !payload.user) {
        setError(payload.error ?? 'Unable to sign in.')
        return
      }

      signIn(payload.user)
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

  const finishAuth = useCallback((user: { id?: string; name: string; email: string; phone: string }, authMode: AuthMode) => {
    if (authMode === 'signup') {
      signUp(user)
      window.localStorage.setItem(
        'splaro-customer',
        JSON.stringify({
          name: user.name,
          email: user.email,
          phone: user.phone,
        }),
      )
      setSuccessCopy(`Welcome, ${user.name.split(' ')[0]}!`)
    } else {
      signIn(user)
      setSuccessCopy('Signed in — taking you there…')
    }
    const destination = resolvePostAuthDestination(nextPath, authMode)
    setRedirecting(true)
    safeClientNavigate(router, destination, 'replace')
  }, [nextPath, router, signIn, signUp])

  const handleGoogle = useCallback(async (credential: string) => {
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

      signIn(payload.user)

      if (payload.needsPhone || payload.user.needsPhone) {
        setGoogleName(payload.user.name)
        setPhone('')
        setStep('google-phone')
        setGoogleStep('google-phone')
        return
      }

      finishAuth(payload.user, mode)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error. Please try again.'
      setError(message)
      setGoogleError(message)
    }
  }, [finishAuth, mode, setGoogleError, setGoogleStep, signIn])

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
      const response = await authFetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: phone.trim() }),
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
          phone: phone.trim(),
          ...(phoneOtpEnabled ? { code: otpCode.trim() } : {}),
        }),
      })
      const payload = (await response.json()) as {
        user?: { id: string; name: string; email: string; phone: string }
        error?: string
      }

      if (!response.ok || !payload.user) {
        setError(payload.error ?? 'Could not complete signup.')
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

  const handleCancelGooglePhone = async () => {
    setError('')
    await signOut()
    setPhone('')
    setOtpCode('')
    setOtpSent(false)
    setOtpDevHint('')
    setGoogleName('')
    setStep('form')
    setGoogleStep('form')
    setGoogleError('')
  }

  const googlePhoneFields = (
    <>
      <p className="auth-card__subtitle auth-card__subtitle--phone-step">
        Hi {googleName.split(' ')[0] || 'there'} — one last step. Add your Bangladesh mobile so we
        can confirm orders and delivery.
      </p>
      <p className="auth-form__hint">Use 01XXXXXXXXX (11 digits).</p>
      <AuthField
        required
        type="tel"
        inputMode="numeric"
        autoFocus
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
          {otpDevHint ? (
            <p className="auth-form__dev-hint">Dev code: {otpDevHint}</p>
          ) : null}
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
      <h1 className="auth-card__title">
        {step === 'google-phone' ? 'Your phone number' : copy.title}
      </h1>
      {step === 'form' ? <p className="auth-card__subtitle">{copy.subtitle}</p> : null}
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
    formKey: AuthMode,
    onSubmit: (event: FormEvent<HTMLFormElement>) => void,
  ) => {
    if (showMotion) {
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
      <form key={formKey} onSubmit={onSubmit} className="auth-form">
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
  ) : step === 'google-phone' ? (
    renderForm(googlePhoneFields, 'signup', handleCompleteGooglePhone)
  ) : mode === 'login' ? (
    renderForm(loginFields, 'login', handleLogin)
  ) : (
    renderForm(signupFields, 'signup', handleSignup)
  )

  return (
    <LayoutGroup id="auth-card">
      <div className="auth-card">
        {step === 'form' ? <AuthModeSwitch nextPath={nextPath} /> : null}

        {step === 'form' ? (
        <div className="auth-card__heading" aria-live="polite">
          {showMotion ? (
            <motion.div layout>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={mode} {...fadeSlide} transition={motionTransition}>
                  {heading}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          ) : (
            <div>{heading}</div>
          )}
        </div>
        ) : (
          <div className="auth-card__heading" aria-live="polite">
            <h1 className="auth-card__title">Finish with your phone</h1>
          </div>
        )}

        <div className="auth-card__body">
          {showMotion ? (
            <AnimatePresence mode="wait" initial={false}>
              {bodyContent}
            </AnimatePresence>
          ) : (
            bodyContent
          )}
        </div>
      </div>
    </LayoutGroup>
  )
}
