'use client'

import { useLayoutEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { SplaroBrandLogo } from '@/components/brand/SplaroBrandLogo'
import { AuthEarthBackground } from '@/components/earth/AuthEarthBackground'
import {
  captureAuthReturnPath,
  clearAuthReturnPath,
  getAuthReturnPath,
} from '@/lib/auth/auth-return'
import { authMotionTransition, authTapSpring, useAuthShowMotion } from '@/lib/auth/auth-motion'

interface AuthShellProps {
  children: ReactNode
  hideSkipLink?: boolean
}

export function AuthShell({ children, hideSkipLink = false }: AuthShellProps) {
  const router = useRouter()
  const showMotion = useAuthShowMotion()
  const tapTransition = authMotionTransition(!showMotion, 0.16)
  const pressMotion = showMotion ? { whileTap: authTapSpring, whileHover: { opacity: 0.82 } } : {}
  const iconPressMotion = showMotion ? { whileTap: authTapSpring } : {}
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

  const handleExit = () => {
    clearAuthReturnPath()
  }

  const handleBack = () => {
    clearAuthReturnPath()
    if (window.history.length > 1) {
      router.back()
      return
    }
    router.push(returnPath)
  }

  return (
    <div className="auth-shell">
      <div className="auth-shell__glow" aria-hidden="true" />
      <AuthEarthBackground />

      <header className="auth-topbar">
        {showMotion ? (
          <motion.button
            type="button"
            onClick={handleBack}
            className="auth-topbar__back"
            aria-label={`Back to ${returnPath === '/' ? 'home' : 'previous page'}`}
            {...pressMotion}
            transition={tapTransition}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
            Back
          </motion.button>
        ) : (
          <button
            type="button"
            onClick={handleBack}
            className="auth-topbar__back"
            aria-label={`Back to ${returnPath === '/' ? 'home' : 'previous page'}`}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
            Back
          </button>
        )}
        {showMotion ? (
          <motion.div {...iconPressMotion} transition={tapTransition}>
            <Link
              href={returnPath}
              onClick={handleExit}
              className="auth-topbar__close lux-icon-btn lux-icon-btn--round"
              aria-label="Close and return"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </Link>
          </motion.div>
        ) : (
          <Link
            href={returnPath}
            onClick={handleExit}
            className="auth-topbar__close lux-icon-btn lux-icon-btn--round"
            aria-label="Close and return"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </Link>
        )}
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
