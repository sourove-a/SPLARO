'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useAuthGoogleBridge } from '@/components/auth/auth-google-bridge'
import { useStorefrontAuthConfig } from '@/hooks/useStorefrontAuthConfig'
import { useGoogleOAuthOriginEligibility } from '@/hooks/useGoogleOAuthOriginEligibility'
import {
  copyTextToClipboard,
  detectInAppBrowser,
  openInExternalBrowser,
  type InAppBrowserInfo,
} from '@/lib/auth/in-app-browser'

const BAKED_GOOGLE =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
  ''

export function AuthGoogleGlassFooter({ placement = 'in-card' }: { placement?: 'in-card' }) {
  const googleHostRef = useRef<HTMLDivElement>(null)
  /** 0 until measured — avoids mounting GIS at a stale width (right-side gap in the pill). */
  const [googleButtonWidth, setGoogleButtonWidth] = useState(0)
  const [inApp, setInApp] = useState<InAppBrowserInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const {
    googleSignInEnabled,
    googleClientId: runtimeGoogleClientId,
    loaded: configLoaded,
  } = useStorefrontAuthConfig()
  const { step, googleLoading, googleError, setGoogleError, runGoogleSignIn } =
    useAuthGoogleBridge()
  const googleClientId = runtimeGoogleClientId || BAKED_GOOGLE
  const configured = Boolean(googleClientId)
  const originEligible = useGoogleOAuthOriginEligibility()

  useEffect(() => {
    setInApp(detectInAppBrowser())
  }, [])

  useLayoutEffect(() => {
    const host = googleHostRef.current
    if (!host) return

    /*
     * Measure the parent, not the host.
     *
     * `googleButtonWidth` is the `key` on <GoogleLogin>, and GIS renders its
     * iframe *inside* the host. Observing the host therefore let the button's
     * own layout feed back into the key that remounts it: GIS mounts → host
     * width shifts a pixel → key changes → GIS unmounts and remounts. That
     * loop is why the button was slow to settle, and why a click could land on
     * an iframe that was already being torn down.
     *
     * The parent is not touched by GIS, so its content box is a stable source
     * of the available width.
     */
    const target = host.parentElement ?? host
    const measure = () => {
      const styles = getComputedStyle(target)
      const inner =
        target.clientWidth -
        (parseFloat(styles.paddingLeft) || 0) -
        (parseFloat(styles.paddingRight) || 0)
      // GIS draws the pill at exactly `width` but its iframe carries ~10px of
      // transparent bleed (hence margin-left:-10px), so asking for the full
      // container width leaves the right cap outside the iframe and the outline
      // never closes. Give that bleed its room.
      const GIS_BLEED = 12
      return Math.max(200, Math.min(400, Math.round(inner) - GIS_BLEED))
    }
    const updateWidth = () => {
      const width = measure()
      // Remount only on a real layout change. Sub-pixel jitter must never
      // recreate a button the user may be in the middle of clicking.
      setGoogleButtonWidth((prev) => (Math.abs(prev - width) < 8 ? prev : width))
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(target)
    return () => observer.disconnect()
  }, [configured, originEligible, inApp?.inApp])

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

  const handleOpenBrowser = useCallback(() => {
    openInExternalBrowser(window.location.href)
  }, [])

  const handleCopyLink = useCallback(async () => {
    const ok = await copyTextToClipboard(window.location.href)
    setCopied(ok)
    if (ok) window.setTimeout(() => setCopied(false), 2500)
  }, [])

  if (step === 'google-phone') return null
  // Hide ONLY when config confirms disabled AND no client id exists (baked or runtime).
  // Never unmount a visible button — flash-then-vanish is worse than a brief loading state.
  if (configLoaded && !googleSignInEnabled && !googleClientId) return null

  // Loopback without LOCAL_ENABLED: honest hint (no GIS mount / no fake button / no console spam).
  const localBlocked = configured && originEligible === false
  // Still resolving hostname — keep layout stable with measuring shell, no GIS yet.
  const awaitingOrigin = configured && originEligible === null
  // Never mount GIS inside WhatsApp / Instagram / Telegram WebViews — Google shows a blank white page.
  const blockedByInApp = Boolean(inApp?.inApp)
  const showGoogle = configured && originEligible === true && !blockedByInApp

  const appLabel = inApp?.label ?? 'this app'

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

      {localBlocked ? (
        <p className="auth-google-glass__hint">
          Google sign-in is available on{' '}
          <a href="https://splaro.co/login" className="auth-google-glass__hint-link">
            splaro.co
          </a>
          . For local GIS, register localhost + 127.0.0.1 origins, then set{' '}
          <code className="auth-google-glass__hint-code">NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED=true</code>.
        </p>
      ) : null}

      {blockedByInApp && configured && !localBlocked ? (
        <div className="auth-google-inapp" role="status">
          <p className="auth-google-inapp__title">Open in Safari or Chrome</p>
          <p className="auth-google-inapp__body">
            Google doesn&apos;t work inside {appLabel}. Open this page in your phone browser, then
            continue with Google.
          </p>
          <p className="auth-google-inapp__body auth-google-inapp__body--bn" lang="bn">
            {appLabel}-এর ভিতরে Google কাজ করে না। Safari বা Chrome-এ খুলে Continue with Google
            চাপুন।
          </p>
          <button
            type="button"
            className="auth-google-inapp__cta"
            onClick={handleOpenBrowser}
          >
            <ExternalLink className="auth-google-inapp__cta-icon" strokeWidth={2.2} aria-hidden />
            Open in Safari / Chrome
          </button>
          <button type="button" className="auth-google-inapp__copy" onClick={() => void handleCopyLink()}>
            {copied ? 'Link copied · লিংক কপি হয়েছে' : 'Copy link · লিংক কপি করুন'}
          </button>
        </div>
      ) : null}

      {showGoogle ? (
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
              // FedCM path blanks / fails on several mobile browsers — classic button is reliable.
              use_fedcm_for_button={false}
            />
          ) : null}
          {googleLoading ? (
            <span className="auth-google-glass__loading-cover" aria-live="polite">
              <Loader2 className="auth-google-glass__spinner" strokeWidth={2.2} aria-hidden />
              Signing in…
            </span>
          ) : null}
        </div>
      ) : null}

      {awaitingOrigin && !blockedByInApp ? (
        <p className="auth-google-glass__hint auth-google-glass__hint--quiet" aria-live="polite">
          Preparing Google sign-in…
        </p>
      ) : null}

      {!configured ? (
        <p className="auth-google-glass__error">Google sign-in is not configured yet.</p>
      ) : null}
    </div>
  )
}
