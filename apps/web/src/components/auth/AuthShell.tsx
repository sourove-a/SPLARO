'use client'

import { useLayoutEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X } from 'lucide-react'
import { SplaroBrandLogo } from '@/components/brand/SplaroBrandLogo'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'
import {
  captureAuthReturnPath,
  clearAuthReturnPath,
  getAuthReturnPath,
  isAuthPath,
} from '@/lib/auth/auth-return'
import { useAuthStore } from '@/store/authStore'

interface AuthShellProps {
  children: ReactNode
  hideSkipLink?: boolean
}

function isAuthRequiredExit(pathname: string) {
  return (
    pathname === '/account' ||
    pathname.startsWith('/account/') ||
    pathname === '/checkout' ||
    pathname.startsWith('/checkout/')
  )
}

function sameOriginNonAuthReferrer(): string | null {
  try {
    const ref = typeof document !== 'undefined' ? document.referrer : ''
    if (!ref) return null
    const url = new URL(ref)
    if (url.origin !== window.location.origin) return null
    if (isAuthPath(url.pathname)) return null
    if (isAuthRequiredExit(url.pathname)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function AuthShell({ children, hideSkipLink = false }: AuthShellProps) {
  const router = useRouter()
  const signOut = useAuthStore((s) => s.signOut)
  const [skipCheckoutLink, setSkipCheckoutLink] = useState(hideSkipLink)
  const [returnPath, setReturnPath] = useState('/')

  useLayoutEffect(() => {
    document.body.classList.add('auth-page')
    captureAuthReturnPath()
    setReturnPath(getAuthReturnPath())
    return () => document.body.classList.remove('auth-page')
  }, [])

  useLayoutEffect(() => {
    if (hideSkipLink) {
      setSkipCheckoutLink(true)
      return
    }
    const next = new URLSearchParams(window.location.search).get('next')
    setSkipCheckoutLink(next === '/checkout')
  }, [hideSkipLink])

  /**
   * Incomplete Google signup leaves a half session (cookie + needsPhone, no Customer).
   * Clear it on leave so account/checkout don't look "broken."
   */
  const clearIncompleteGoogleSession = async () => {
    const user = useAuthStore.getState().user
    if (user?.needsPhone) {
      await signOut()
    }
  }

  /** Leave auth with SPA navigation; hard reload creates visible flash. */
  const leaveAuth = () => {
    void (async () => {
      await clearIncompleteGoogleSession()
      const dest = returnPath || '/'
      clearAuthReturnPath()
      safeClientNavigate(router, dest, 'replace')
    })()
  }

  const handleBack = () => {
    void (async () => {
      await clearIncompleteGoogleSession()
      const referrer = sameOriginNonAuthReferrer()
      if (referrer) {
        clearAuthReturnPath()
        safeClientNavigate(router, referrer, 'replace')
        return
      }
      const dest = returnPath || '/'
      clearAuthReturnPath()
      safeClientNavigate(router, dest, 'replace')
    })()
  }

  return (
    <main
      id="main-content"
      className="auth-shell auth-template-enter"
      tabIndex={-1}
      data-lenis-prevent
    >
      <div className="auth-shell__glow" aria-hidden="true" />

      {/* Plain buttons — framer motion wrappers were swallowing Close Link clicks. */}
      <header className="auth-topbar">
        <button
          type="button"
          onClick={handleBack}
          className="auth-topbar__back"
          aria-label={`Back to ${returnPath === '/' ? 'home' : 'previous page'}`}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          Back
        </button>
        <button
          type="button"
          onClick={leaveAuth}
          className="auth-topbar__close lux-icon-btn lux-icon-btn--round"
          aria-label="Close and return"
        >
          <X className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </header>

      <div className="auth-shell__inner">
        <div className="auth-shell__logo">
          <SplaroBrandLogo href="/" tone="light" size="footerLuxury" priority />
        </div>

        <div className="auth-glass-panel">
          <div className="auth-glass-panel__shine" aria-hidden="true" />
          {children}
        </div>

        {skipCheckoutLink ? null : (
          <Link href="/" className="auth-skip-link" onClick={() => clearAuthReturnPath()}>
            Continue without signing in
          </Link>
        )}
      </div>
    </main>
  )
}
