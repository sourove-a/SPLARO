'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail, Phone, UserRound } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { AuthField } from '@/components/auth/AuthField'
import { AuthModeSwitch } from '@/components/auth/AuthModeSwitch'
import { loadCheckoutCustomerDraft } from '@/lib/checkout/customer-draft'
import { formatBdPhoneInput } from '@/lib/checkout/phone'
import { useAuthStore } from '@/store/authStore'

type AuthMode = 'login' | 'signup'

const motionEase = [0.16, 1, 0.3, 1] as const

function useAuthMode(): AuthMode {
  const pathname = usePathname()
  return pathname === '/signup' ? 'signup' : 'login'
}

function useAuthCopy(mode: AuthMode, nextPath: string) {
  return useMemo(() => {
    if (nextPath === '/checkout') {
      return mode === 'login'
        ? { title: 'Sign in', subtitle: 'Use your account to finish checkout faster.' }
        : { title: 'Create account', subtitle: 'Save your details for a quicker checkout.' }
    }
    return mode === 'login'
      ? { title: 'Sign in', subtitle: 'Welcome back.' }
      : { title: 'Create account', subtitle: 'One account for checkout, orders, and your saved bag.' }
  }, [mode, nextPath])
}

export function AuthExperience() {
  const mode = useAuthMode()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') ?? '/account'
  const copy = useAuthCopy(mode, nextPath)
  const reduceMotion = useReducedMotion()
  const fadeSlide = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
      }
  const formMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
      }
  const motionTransition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: motionEase }
  const formTransition = reduceMotion ? { duration: 0 } : { duration: 0.24, ease: motionEase }

  const signIn = useAuthStore((state) => state.signIn)
  const signUp = useAuthStore((state) => state.signUp)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setError('')
  }, [mode])

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
      const response = await fetch('/api/auth/login', {
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
      const destination = nextPath.startsWith('/') ? nextPath : '/account'
      router.replace(destination)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
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
      const destination = nextPath.startsWith('/') ? nextPath : '/account'
      router.replace(destination)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <LayoutGroup id="auth-card">
      <div className="auth-card">
        <AuthModeSwitch nextPath={nextPath} />

        <motion.div layout className="auth-card__heading" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              {...fadeSlide}
              transition={motionTransition}
            >
              <h1 className="auth-card__title">{copy.title}</h1>
              <p className="auth-card__subtitle">{copy.subtitle}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <div className="auth-card__body">
          <AnimatePresence mode="wait" initial={false}>
            {mode === 'login' ? (
              <motion.form
                key="login"
                layout
                onSubmit={handleLogin}
                className="auth-form"
                {...formMotion}
                transition={formTransition}
              >
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
                  <Link href="/forgot-password" className="auth-link auth-link--muted">
                    Forgot password?
                  </Link>
                </div>

                <AnimatePresence mode="wait">
                  {error && mode === 'login' ? (
                    <motion.p
                      key="error"
                      className="auth-form__error"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {error}
                    </motion.p>
                  ) : null}
                </AnimatePresence>

                <button type="submit" disabled={loading} className="auth-submit auth-submit--primary">
                  {loading ? (
                    <>
                      <Loader2 className="auth-submit__spinner h-4 w-4" strokeWidth={2.2} />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="signup"
                layout
                onSubmit={handleSignup}
                className="auth-form"
                {...formMotion}
                transition={formTransition}
              >
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

                <AnimatePresence mode="wait">
                  {error && mode === 'signup' ? (
                    <motion.p
                      key="error"
                      className="auth-form__error"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {error}
                    </motion.p>
                  ) : null}
                </AnimatePresence>

                <button type="submit" disabled={loading} className="auth-submit auth-submit--primary">
                  {loading ? (
                    <>
                      <Loader2 className="auth-submit__spinner h-4 w-4" strokeWidth={2.2} />
                      Creating account...
                    </>
                  ) : (
                    'Create account'
                  )}
                </button>

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
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </LayoutGroup>
  )
}
