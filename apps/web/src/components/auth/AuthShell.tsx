'use client'

import { useLayoutEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X } from 'lucide-react'
import { SplaroBrandLogo } from '@/components/brand/SplaroBrandLogo'
import {
  captureAuthReturnPath,
  clearAuthReturnPath,
  getAuthReturnPath,
  isAuthPath,
} from '@/lib/auth/auth-return'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'

interface AuthShellProps {
  children: ReactNode
  hideSkipLink?: boolean
}

export function AuthShell({ children, hideSkipLink = false }: AuthShellProps) {
  const router = useRouter()
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

  /** Always leave auth to a real destination — never rely on motion-wrapped Links. */
  const leaveAuth = () => {
    const dest = returnPath || '/'
    clearAuthReturnPath()
    safeClientNavigate(router, dest)
  }

  const handleBack = () => {
    // Prefer browser back only when referrer is same-origin and not another auth page.
    try {
      const ref = typeof document !== 'undefined' ? document.referrer : ''
      if (ref) {
        const url = new URL(ref)
        if (url.origin === window.location.origin && !isAuthPath(url.pathname)) {
          clearAuthReturnPath()
          router.back()
          // If history.back stalls on this page (common after direct /login open),
          // hard-leave after a short beat.
          window.setTimeout(() => {
            if (isAuthPath(window.location.pathname)) {
              safeClientNavigate(router, returnPath || '/', 'replace')
            }
          }, 350)
          return
        }
      }
    } catch {
      /* fall through */
    }
    leaveAuth()
  }

  return (
    <div className="auth-shell">
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
          <SplaroBrandLogo href="/" tone="dark" size="footerLuxury" />
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
    </div>
  )
}
