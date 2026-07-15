'use client'

import { useCallback, useRef } from 'react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { Loader2 } from 'lucide-react'
import { motion } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'
import { authMotionTransition, authTapSpring, useAuthShowMotion } from '@/lib/auth/auth-motion'
import { useAuthGoogleBridge } from '@/components/auth/auth-google-bridge'
import { useStorefrontAuthConfig } from '@/hooks/useStorefrontAuthConfig'

const BAKED_GOOGLE =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
  ''

function findGoogleHostButton(host: HTMLElement | null): HTMLElement | null {
  if (!host) return null
  return (
    host.querySelector<HTMLElement>('div[role="button"]') ??
    host.querySelector<HTMLElement>('iframe') ??
    host.querySelector<HTMLElement>('div[id^="container-"]')
  )
}

async function waitForGoogleHostButton(
  host: HTMLElement | null,
  attempts = 12,
  delayMs = 150,
): Promise<HTMLElement | null> {
  for (let i = 0; i < attempts; i += 1) {
    const btn = findGoogleHostButton(host)
    if (btn) return btn
    await new Promise((resolve) => window.setTimeout(resolve, delayMs))
  }
  return null
}

function GoogleMarkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="auth-google-glass__mark" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function AuthGoogleGlassFooter({ placement = 'in-card' }: { placement?: 'in-card' }) {
  const hiddenHostRef = useRef<HTMLDivElement>(null)
  const openingRef = useRef(false)
  const {
    googleSignInEnabled,
    googleClientId: runtimeGoogleClientId,
    loaded: configLoaded,
  } = useStorefrontAuthConfig()
  const { step, googleLoading, googleError, setGoogleError, runGoogleSignIn } = useAuthGoogleBridge()
  const showMotion = useAuthShowMotion()
  const tapTransition = authMotionTransition(!showMotion, 0.16)
  const pressMotion = showMotion && !googleLoading ? { whileTap: authTapSpring, whileHover: { opacity: 0.92 } } : {}
  const googleClientId = runtimeGoogleClientId || BAKED_GOOGLE
  const configured = Boolean(googleClientId)

  const handleCredential = useCallback(
    (response: CredentialResponse) => {
      if (!response.credential) {
        setGoogleError('Google sign-in was cancelled or failed.')
        return
      }
      void runGoogleSignIn(response.credential)
    },
    [runGoogleSignIn, setGoogleError],
  )

  const openGoogle = useCallback(() => {
    if (openingRef.current || googleLoading) return
    if (!configured) {
      setGoogleError('Google sign-in is not configured on the server yet. Use email or phone above.')
      return
    }
    setGoogleError('')
    openingRef.current = true
    void (async () => {
      try {
        const googleBtn = await waitForGoogleHostButton(hiddenHostRef.current)
        if (googleBtn) {
          googleBtn.click()
          return
        }
        setGoogleError(
          'Google sign-in could not load. Check your connection, disable ad blockers for splaro.co, then refresh.',
        )
      } finally {
        openingRef.current = false
      }
    })()
  }, [configured, googleLoading, setGoogleError])

  if (step === 'google-phone') return null
  // Hide ONLY when config confirms disabled AND no client id exists (baked or runtime).
  // Never unmount a visible button — flash-then-vanish is worse than a brief loading state.
  if (configLoaded && !googleSignInEnabled && !googleClientId) return null

  return (
    <div className={cn('auth-google-glass-footer', placement === 'in-card' && 'auth-google-glass-footer--in-card')}>
      <div className="auth-google__divider" aria-hidden>
        <span />
        <span>or</span>
        <span />
      </div>

      {showMotion ? (
        <motion.button
          type="button"
          className={cn('auth-google-glass__btn', googleLoading && 'auth-google-glass__btn--loading')}
          onClick={openGoogle}
          disabled={googleLoading}
          aria-label="Continue with Google"
          {...pressMotion}
          transition={tapTransition}
        >
          <span className="auth-google-glass__backdrop" aria-hidden />
          <span className="auth-google-glass__shine" aria-hidden />
          {googleLoading ? (
            <Loader2 className="auth-google-glass__spinner" strokeWidth={2.2} aria-hidden />
          ) : (
            <>
              <GoogleMarkIcon />
              <span className="auth-google-glass__btn-label">Continue with Google</span>
            </>
          )}
        </motion.button>
      ) : (
        <button
          type="button"
          className={cn('auth-google-glass__btn', googleLoading && 'auth-google-glass__btn--loading')}
          onClick={openGoogle}
          disabled={googleLoading}
          aria-label="Continue with Google"
        >
          <span className="auth-google-glass__backdrop" aria-hidden />
          <span className="auth-google-glass__shine" aria-hidden />
          {googleLoading ? (
            <Loader2 className="auth-google-glass__spinner" strokeWidth={2.2} aria-hidden />
          ) : (
            <>
              <GoogleMarkIcon />
              <span className="auth-google-glass__btn-label">Continue with Google</span>
            </>
          )}
        </button>
      )}

      {googleError ? <p className="auth-google-glass__error">{googleError}</p> : null}

      {configured ? (
        <div ref={hiddenHostRef} className="auth-google-glass__hidden" aria-hidden>
          <GoogleLogin
            onSuccess={handleCredential}
            onError={() => setGoogleError('Google sign-in was cancelled or failed.')}
            type="icon"
            theme="filled_black"
            size="large"
            shape="circle"
          />
        </div>
      ) : null}
    </div>
  )
}
