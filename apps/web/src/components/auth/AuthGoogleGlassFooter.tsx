'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useAuthGoogleBridge } from '@/components/auth/auth-google-bridge'
import { useStorefrontAuthConfig } from '@/hooks/useStorefrontAuthConfig'

const BAKED_GOOGLE =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
  ''

export function AuthGoogleGlassFooter({ placement = 'in-card' }: { placement?: 'in-card' }) {
  const googleHostRef = useRef<HTMLDivElement>(null)
  /** 0 until measured — avoids mounting GIS at a stale width (right-side gap in the pill). */
  const [googleButtonWidth, setGoogleButtonWidth] = useState(0)
  const {
    googleSignInEnabled,
    googleClientId: runtimeGoogleClientId,
    loaded: configLoaded,
  } = useStorefrontAuthConfig()
  const { step, googleLoading, googleError, setGoogleError, runGoogleSignIn } =
    useAuthGoogleBridge()
  const googleClientId = runtimeGoogleClientId || BAKED_GOOGLE
  const configured = Boolean(googleClientId)

  useEffect(() => {
    const host = googleHostRef.current
    if (!host) return
    const updateWidth = () => {
      // GIS width is integer px; round so the pill matches the Sign in button edge.
      const width = Math.max(200, Math.min(400, Math.round(host.getBoundingClientRect().width)))
      setGoogleButtonWidth((prev) => (prev === width ? prev : width))
    }
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(host)
    return () => observer.disconnect()
  }, [configured])

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

  if (step === 'google-phone') return null
  // Hide ONLY when config confirms disabled AND no client id exists (baked or runtime).
  // Never unmount a visible button — flash-then-vanish is worse than a brief loading state.
  if (configLoaded && !googleSignInEnabled && !googleClientId) return null

  return (
    <div
      className={cn(
        'auth-google-glass-footer',
        placement === 'in-card' && 'auth-google-glass-footer--in-card',
      )}
    >
      <div className="auth-google__divider" aria-hidden>
        <span />
        <span>or</span>
        <span />
      </div>

      {googleError ? <p className="auth-google-glass__error">{googleError}</p> : null}

      {configured ? (
        <div
          ref={googleHostRef}
          className={cn(
            'auth-google-glass__native',
            googleLoading && 'auth-google-glass__native--loading',
            googleButtonWidth <= 0 && 'auth-google-glass__native--measuring',
          )}
        >
          {googleButtonWidth > 0 ? (
            <GoogleLogin
              // Remount when width changes — GIS ignores prop updates and leaves a right gap.
              key={googleButtonWidth}
              onSuccess={handleCredential}
              onError={() => setGoogleError('Google sign-in was cancelled or failed.')}
              type="standard"
              theme="outline"
              size="large"
              text="continue_with"
              shape="pill"
              logo_alignment="center"
              width={googleButtonWidth}
              locale="en"
              ux_mode="popup"
            />
          ) : null}
          {googleLoading ? (
            <span className="auth-google-glass__loading-cover" aria-live="polite">
              <Loader2 className="auth-google-glass__spinner" strokeWidth={2.2} aria-hidden />
              Signing in…
            </span>
          ) : null}
        </div>
      ) : (
        <p className="auth-google-glass__error">Google sign-in is not configured yet.</p>
      )}
    </div>
  )
}
