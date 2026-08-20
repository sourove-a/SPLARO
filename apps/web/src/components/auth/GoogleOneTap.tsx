'use client'

import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  useGoogleOneTapLogin,
  useGoogleOAuth,
  type CredentialResponse,
  type PromptMomentNotification,
} from '@react-oauth/google'
import { useStorefrontAuthConfig } from '@/hooks/useStorefrontAuthConfig'
import { useGoogleOAuthOriginEligibility } from '@/hooks/useGoogleOAuthOriginEligibility'
import {
  dismissGoogleOneTap,
  isGoogleOneTapDismissed,
} from '@/lib/auth/google-one-tap-dismiss'
import { detectInAppBrowser } from '@/lib/auth/in-app-browser'
import { authFetch } from '@/lib/auth/auth-fetch'
import { isAuthPath } from '@/lib/auth/auth-return'
import { buildSignupPhonePath } from '@/lib/auth/signup-phone-path'
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-destination'
import { invalidateAuthSessionReconcile } from '@/lib/api/session'
import { navigateAfterAuth } from '@/lib/navigation/safe-client-navigate'
import { useAuthStore } from '@/store/authStore'

const BAKED_GOOGLE =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
  ''

const SKIP_PREFIXES = [
  '/checkout',
  '/account',
  '/maintenance',
  '/cart',
  '/order-confirmation',
]

function shouldSkipOneTapPath(pathname: string): boolean {
  if (isAuthPath(pathname)) return true
  if (pathname.startsWith('/verify-email')) return true
  return SKIP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function shouldPersistDismiss(notification: PromptMomentNotification): boolean {
  try {
    if (typeof notification.isNotDisplayed === 'function' && notification.isNotDisplayed()) {
      const reason = notification.getNotDisplayedReason?.()
      // User previously opted out / suppressed — don't keep retrying forever.
      return reason === 'suppressed_by_user' || reason === 'opt_out_or_no_session'
    }
    if (typeof notification.isDismissedMoment === 'function' && notification.isDismissedMoment()) {
      return notification.getDismissedReason?.() === 'cancel_called'
    }
    if (typeof notification.isSkippedMoment === 'function' && notification.isSkippedMoment()) {
      const reason = notification.getSkippedReason?.()
      return reason === 'user_cancel' || reason === 'tap_outside'
    }
  } catch {
    return false
  }
  return false
}

class OneTapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch() {
    // Optional UX — never take down the storefront.
  }

  override render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

function GoogleOneTapPrompt({
  enabled,
  onDismissed,
}: {
  enabled: boolean
  onDismissed: () => void
}) {
  const signIn = useAuthStore((s) => s.signIn)
  const router = useRouter()
  const busyRef = useRef(false)
  const { scriptLoadedSuccessfully } = useGoogleOAuth()

  const handleSuccess = useCallback(
    async (response: CredentialResponse) => {
      if (!response.credential || busyRef.current) return
      busyRef.current = true
      try {
        const res = await authFetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ credential: response.credential }),
        })
        const payload = (await res.json().catch(() => ({}))) as {
          user?: {
            id: string
            name: string
            email: string
            phone: string
            needsPhone?: boolean
          }
          needsPhone?: boolean
          isNewUser?: boolean
          error?: string
        }

        if (!res.ok || !payload.user) {
          // Silence here left the shopper tapping One Tap with nothing happening —
          // a rejected credential (e.g. unverified Google email) must be visible.
          toast.error(payload.error ?? 'Google sign-in failed. Try the sign-in page.', {
            id: 'google-one-tap',
          })
          return
        }

        dismissGoogleOneTap()
        onDismissed()
        invalidateAuthSessionReconcile()
        signIn(payload.user)

        if (payload.needsPhone || payload.user.needsPhone) {
          navigateAfterAuth(router, buildSignupPhonePath('/account'))
        } else {
          navigateAfterAuth(
            router,
            resolvePostAuthDestination('/account', payload.isNewUser ? 'signup' : 'login'),
          )
        }
      } catch {
        // Network failure — leave dismiss untouched so One Tap can retry.
        toast.error('Could not reach SPLARO — check your connection and try again.', {
          id: 'google-one-tap',
        })
      } finally {
        busyRef.current = false
      }
    },
    [onDismissed, router, signIn],
  )

  const handlePromptMoment = useCallback(
    (notification: PromptMomentNotification) => {
      if (!shouldPersistDismiss(notification)) return
      dismissGoogleOneTap()
      onDismissed()
    },
    [onDismissed],
  )

  useGoogleOneTapLogin({
    onSuccess: (credential) => {
      void handleSuccess(credential)
    },
    onError: () => {
      // GIS unavailable — do not permanent-dismiss.
    },
    promptMomentNotification: handlePromptMoment,
    cancel_on_tap_outside: true,
    auto_select: false,
    // Classic iframe One Tap — FedCM NetworkError on loopback crashes Next overlay.
    use_fedcm_for_prompt: false,
    disabled: !enabled || !scriptLoadedSuccessfully,
  })

  return null
}

/**
 * Storefront Google One Tap for guests.
 * Requires root AuthGoogleProvider (single GIS instance — no nested provider).
 * Close / suppress → localStorage dismiss (no repeat nag).
 */
export function GoogleOneTap() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const authHydrated = useAuthStore((s) => s._hydrated)
  const { googleClientId: runtimeId } = useStorefrontAuthConfig()
  const originEligible = useGoogleOAuthOriginEligibility()
  const clientId = runtimeId || BAKED_GOOGLE
  const providerReady = Boolean(clientId) && originEligible === true
  const [bootReady, setBootReady] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(isGoogleOneTapDismissed())
  }, [])

  // Embedded browsers (WhatsApp / Instagram / Telegram) cannot complete Google OAuth.
  useEffect(() => {
    if (detectInAppBrowser().inApp) {
      setDismissed(true)
      setBootReady(false)
    }
  }, [])

  useEffect(() => {
    if (!authHydrated || user || dismissed || !providerReady) return
    if (shouldSkipOneTapPath(pathname)) return
    if (detectInAppBrowser().inApp) return

    let cancelled = false
    const start = () => {
      if (!cancelled) setBootReady(true)
    }

    const win = /Windows/i.test(navigator.userAgent || '')
    const idleTimeout = win ? 4500 : 2200
    const fallbackMs = win ? 3500 : 1600

    const idle =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? window.requestIdleCallback(start, { timeout: idleTimeout })
        : null
    const fallback = window.setTimeout(start, fallbackMs)

    return () => {
      cancelled = true
      window.clearTimeout(fallback)
      if (idle != null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idle)
      }
    }
  }, [authHydrated, user, dismissed, pathname, providerReady])

  useEffect(() => {
    if (shouldSkipOneTapPath(pathname)) setBootReady(false)
  }, [pathname])

  if (!authHydrated || user || dismissed) return null
  if (!providerReady) return null
  if (shouldSkipOneTapPath(pathname)) return null
  if (!bootReady) return null

  return (
    <OneTapErrorBoundary>
      <GoogleOneTapPrompt enabled onDismissed={() => setDismissed(true)} />
    </OneTapErrorBoundary>
  )
}

export default GoogleOneTap
